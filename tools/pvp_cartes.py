#!/usr/bin/env python3
"""Génère js/pvp-data.js : les 180 cartes en version match 1v1 (style Hearthstone).

Lancer : python3 tools/pvp_cartes.py
- Les joueurs (et clubs, casters, trophées) sont des « serviteurs » : coût, ATQ, PV, mots-clés, effets.
- Les moments, maps, jeux, ligues, événements et lieux sont des « sorts » : on les joue pour leur effet.
Les effets sont des données : le moteur les applique et écrit lui-même leur texte.
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'data/origines.js').read_text(encoding='utf-8')
rows = re.findall(r'\["([^"]+)", "(\w)", "([^"]+)", "([^"]+)"', src)
assert len(rows) == 180, len(rows)

GAME = {'Counter-Strike': 'CS', 'League of Legends': 'LoL', 'Dota 2': 'Dota', 'Valorant': 'Val', 'Call of Duty': 'CoD',
        'Rocket League': 'RL', 'StarCraft II': 'SC2', 'StarCraft: Brood War': 'BW', 'StarCraft': 'BW', 'Warcraft III': 'WC3',
        'Overwatch': 'OW', 'Fortnite': 'FN', 'Quake': 'Quake', 'Halo': 'Halo', 'Rainbow Six Siege': 'R6',
        'Super Smash Bros. Melee': 'Smash', 'Super Smash Bros.': 'Smash', 'Street Fighter': 'SF', 'Jeux de combat': 'FGC', 'Counter-Strike / Valorant': 'CS',
        'Multi-jeux': 'Multi'}
FAM = {'CS': 'FPS', 'Val': 'FPS', 'CoD': 'FPS', 'OW': 'FPS', 'FN': 'FPS', 'Quake': 'FPS', 'Halo': 'FPS', 'R6': 'FPS',
       'LoL': 'MOBA', 'Dota': 'MOBA', 'SC2': 'RTS', 'BW': 'RTS', 'WC3': 'RTS', 'Smash': 'COMBAT', 'SF': 'COMBAT', 'FGC': 'COMBAT',
       'RL': 'SPORT', 'Multi': 'MULTI'}
TYPE = {'Joueur': 'J', 'Joueuse': 'J', 'Logo de club': 'Club', 'Équipe': 'Club', 'Moment': 'Mom', 'Jeu': 'Jeu', 'Logo de ligue': 'Lig',
        'Logo de tournoi': 'Lig', 'Map': 'Map', 'Événement': 'Evt', 'Lieu': 'Lieu', 'Trophée': 'Tro', 'Média': 'Med',
        'Caster': 'Cast', 'Casters': 'Cast'}

CLUBS = {
    'Vitality': [177, 165, 153, 163, 178, 122, 41, 164, 167, 171, 72],
    'Astralis': [98, 100, 101, 125, 159, 76], 'NiP': [123, 124, 158, 77],
    'G2': [88, 118, 33, 34, 35, 99, 69], 'Fnatic': [119, 38, 36, 108, 109, 151, 67],
    'Liquid': [45, 103, 39, 40, 92, 150, 68], 'FaZe': [99, 40, 41, 75], 'Cloud9': [37, 39, 46, 148, 70],
    'NaVi': [126, 128, 166, 152, 71], 'OG': [127, 104, 105, 174, 180, 160], 'T1': [176, 91, 147, 172, 135, 73],
    'GenG': [94, 97, 74], 'OpTic': [114, 44, 179, 48], 'EG': [90, 143, 49], 'Secret': [128, 50], 'RNG': [117, 9],
    'KT': [156, 10], 'EnVyUs': [121, 14], 'MOUZ': [41, 6], 'Dignitas': [163, 178, 4], '4Kings': [157, 2],
}
STREAM = [46, 116, 175, 85]
CLUB_NAME = {'Vitality': 'Vitality', 'Astralis': 'Astralis', 'NiP': 'NiP', 'G2': 'G2', 'Fnatic': 'Fnatic', 'Liquid': 'Liquid',
             'FaZe': 'FaZe', 'Cloud9': 'Cloud9', 'NaVi': 'Na\'Vi', 'OG': 'OG', 'T1': 'T1', 'GenG': 'Gen.G', 'OpTic': 'OpTic',
             'EG': 'Evil Geniuses', 'Secret': 'Team Secret', 'RNG': 'RNG', 'KT': 'KT Rolster', 'EnVyUs': 'EnVyUs', 'MOUZ': 'MOUZ',
             'Dignitas': 'Dignitas', '4Kings': '4Kings'}

# ---------- Écriture des effets ----------
# w : quand l'effet agit — play (à l'entrée / sort), aura (tant qu'en jeu), end (fin de ton tour), death (dernier mot)
def play(o, **k): return dict(w='play', o=o, **k)
def aura(o, **k): return dict(w='aura', o=o, **k)
def end(o, **k): return dict(w='end', o=o, **k)
def death(o, **k): return dict(w='death', o=o, **k)
def club(c): return 'club:' + c
ALONE = {'alone': 1}           # tu n'as aucun autre serviteur
HURT = {'hurt': 1}             # ton héros a 12 PV ou moins
NOTHURT = {'nothurt': 1}
def has(f): return {'has': f}

C = {}
def unit(i, cost, atk, hp, kw=(), *fx): C[i] = dict(k='u', c=cost, a=atk, h=hp, kw=list(kw), fx=list(fx))
def spell(i, cost, *fx): C[i] = dict(k='s', c=cost, kw=[], fx=list(fx))

# ---- Clubs : des serviteurs qui renforcent leurs joueurs ----
for i, cl in ((67, 'Fnatic'), (68, 'Liquid'), (69, 'G2'), (70, 'Cloud9'), (71, 'NaVi'), (72, 'Vitality'), (73, 'T1'),
              (74, 'GenG'), (75, 'FaZe'), (76, 'Astralis'), (77, 'NiP')):
    unit(i, 3, 2, 4, (), aura('buff', a=1, h=1, f=club(cl)))
for i, cl in ((2, '4Kings'), (4, 'Dignitas'), (6, 'MOUZ'), (9, 'RNG'), (10, 'KT'), (14, 'EnVyUs'), (48, 'OpTic'), (49, 'EG'), (50, 'Secret')):
    unit(i, 2, 1, 3, (), aura('buff', a=1, h=1, f=club(cl)))
unit(1, 2, 2, 3, (), play('buff', a=1, h=1, t='friendMin'))            # mTw
unit(3, 1, 1, 2, ('taunt',))                                           # compLexity
unit(5, 2, 2, 2, (), play('draw', n=1, f='LoL'))                       # CLG
unit(7, 3, 2, 3, (), aura('buff', a=1, h=0, f='J&Dota'))               # Alliance
unit(8, 3, 3, 3, (), play('cost', v=1, f='Dota'))                      # Newbee
unit(11, 4, 3, 3, (), play('draw', n=2, f='*'))                        # 100 Thieves
unit(12, 2, 3, 2, ('charge',))                                         # FURIA
unit(13, 3, 2, 4, ('taunt',), aura('buff', a=1, h=0, f='J&CS'))        # MIBR
unit(47, 4, 4, 4, (), play('dmg', n=1, t='allEnemyMin'))               # Virtus.pro
unit(78, 2, 2, 2, (), death('draw', n=1, f='*'))                       # SK Gaming
unit(139, 5, 4, 6, ('taunt',), play('buff', a=1, h=1, t='allFriendMin', f='J&LoL'))   # ROX Tigers
unit(172, 4, 3, 5, (), aura('buff', a=2, h=2, f=club('T1')), aura('buff', a=1, h=0, f='J&LoL'))  # T1 6 étoiles

# ---- Ligues (sorts) ----
spell(15, 2, play('buff', a=1, h=1, t='allFriendMin', f='J&LoL'))      # LEC
spell(16, 3, play('draw', n=2, f='LoL'))                               # LCK
spell(17, 3, play('buff', a=2, h=0, t='allFriendMin', f='J&LoL'))      # LPL
spell(18, 1, play('draw', n=1, f='LoL'))                               # LCS
spell(19, 2, play('buff', a=1, h=1, t='allFriendMin', f='J&Val'))      # VCT
spell(20, 2, play('buff', a=2, h=2, t='friendMin'))                    # RLCS
spell(21, 2, play('buff', a=1, h=1, t='allFriendMin', f='J&CS'))       # ESL Pro League
spell(22, 3, play('draw', n=2, f='CS'))                                # BLAST Premier
spell(23, 3, play('buff', a=1, h=1, t='allFriendMin', f='J&FPS'))      # Overwatch League
spell(24, 2, play('buff', a=1, h=0, t='friendMin'), play('kw', k='charge', t='friendMin'))   # CDL

# ---- Maps (sorts) ----
spell(25, 1, play('dmg', n=2, t='min'))                                # Dust2
spell(26, 2, play('dmg', n=3, t='any'))                                # Mirage
spell(27, 4, play('dmg', n=2, t='allEnemyMin'))                        # Inferno
spell(28, 5, play('dmg', n=4, t='allMin'))                             # Nuke
spell(29, 2, play('buff', a=1, h=1, t='allFriendMin'))                 # Train
spell(30, 1, play('buff', a=2, h=0, t='friendMin'), play('kw', k='charge', t='friendMin'))   # Overpass : le boost
spell(31, 2, play('buff', a=1, h=1, t='allFriendMin', f='J&MOBA'))     # Faille de l'invocateur
spell(32, 3, play('dmg', n=2, t='min'), play('draw', n=1, f='*'))      # Ascent

# ---- Jeux (sorts) ----
spell(51, 1, play('dmg', n=1, t='enemy'), play('draw', n=1, f='*'))    # Quake
spell(52, 1, play('draw', n=1, f='RTS'))                               # Brood War
spell(53, 2, play('cost', v=1, f='CS'))                                # Counter-Strike
spell(54, 1, play('draw', n=1, f='RTS'))                               # Warcraft III
spell(55, 1, play('draw', n=1, f='COMBAT'))                            # Smash
spell(56, 2, play('dmg', n=2, t='enemy'))                              # Halo
spell(57, 3, play('draw', n=2, f='FPS'))                               # Call of Duty
spell(58, 2, play('cost', v=1, f='LoL'))                               # League of Legends
spell(59, 2, play('draw', n=2, f='RTS'))                               # StarCraft II
spell(60, 2, play('cost', v=1, f='Dota'))                              # Dota 2
spell(61, 1, play('draw', n=1, f='SPORT'))                             # Rocket League
spell(62, 2, play('buff', a=0, h=3, t='friendMin'), play('kw', k='taunt', t='friendMin'))   # Rainbow Six : barricade
spell(63, 2, play('heal', n=5, t='any'))                               # Overwatch : soin
spell(64, 3, play('dmg', n=2, t='allMin'))                             # Fortnite : battle royale
spell(65, 2, play('cost', v=1, f='Val'))                               # Valorant
spell(66, 1, play('draw', n=1, f='COMBAT'))                            # Street Fighter

# ---- Lieux, événements, médias, casters ----
spell(79, 3, play('buff', a=2, h=2, t='friendMin', f='FPS'))           # Spodek
spell(80, 4, play('buff', a=2, h=2, t='allFriendMin', f='J&CS'))       # Lanxess Arena
spell(81, 3, play('draw', n=2, f='*'))                                 # DreamHack
spell(82, 2, play('draw', n=2, f='RTS'))                               # BlizzCon
spell(83, 2, play('draw', n=2, f='COMBAT'))                            # Evo
spell(84, 2, play('silence', t='min'), play('draw', n=1, f='*'))       # OGN : coupe le direct
spell(85, 2, play('summon', n=2, tok=901))                             # Twitch : deux fans
unit(86, 3, 2, 3, (), play('buff', a=1, h=1, t='allFriendMin', f='J&CS'))   # Anders Blume
unit(87, 3, 2, 3, (), play('draw', n=2, f='RTS'))                      # Tasteless & Artosis
spell(135, 3, play('draw', n=1, f=club('T1')), play('buff', a=1, h=1, t='allFriendMin', f=club('T1')))   # Worlds 2013
spell(136, 4, play('destroy', t='enemyMin', min=5))                    # Worlds 2017 : l'exploit
spell(137, 3, play('dmg', n=1, t='randEnemy', times=3))                # Worlds 2019 : le 3-0
spell(138, 4, play('buff', a=2, h=2, t='allFriendMin', f='J&Dota'))    # TI4
spell(142, 5, play('dmg', n=3, t='allMin'))                            # Fortnite World Cup

# ---- Moments (sorts) ----
spell(134, 3, play('buff', a=2, h=0, t='allFriendMin', f='J&Val'))     # Sentinels
spell(140, 7, play('dmg', n=5, t='allEnemyMin'))                       # Le dragon des Worlds 2017
spell(141, 3, play('buff', a=2, h=2, t='friendMin'), play('kw', k='shield', t='friendMin'))   # Luminosity
spell(143, 4, play('draw', n=3, f='*'))                                # EG — TI5
spell(144, 5, play('buff', a=2, h=2, t='allFriendMin', f='J&LoL'))     # Invictus Gaming
spell(145, 4, play('heal', n=8, t='myHero'), play('draw', n=1, f='*')) # Team Spirit — le miracle
spell(146, 4, play('destroy', t='enemyMin'))                           # Taipei Assassins — le hold-up
spell(147, 4, play('buff', a=2, h=2, t='friendMin'), play('kw', k='wind', t='friendMin'))   # SKT — le doublé
spell(148, 3, play('dmg', n=4, t='min'))                               # Cloud9 — Boston
spell(150, 4, play('buff', a=2, h=2, t='allFriendMin', f=club('Liquid')), play('draw', n=1, f='*'))
spell(151, 2, play('draw', n=1, f=club('Fnatic')), play('buff', a=1, h=1, t='allFriendMin', f=club('Fnatic')))
spell(152, 2, play('ramp', n=1))                                       # Na'Vi — le premier million : +1 cristal
spell(158, 4, play('kw', k='shield', t='allFriendMin'))                # NiP — 87-0
spell(159, 5, play('buff', a=2, h=2, t='allFriendMin'))                # Astralis — la dynastie
spell(160, 5, play('revive', n=2))                                     # OG — le doublé
spell(162, 4, play('dmg', n=6, t='enemy'))                             # Bugha
spell(164, 5, play('dmg', n=2, t='allEnemy'))                          # ZywOo — triple champion
spell(166, 3, play('dmg', n=4, t='enemyMin'), play('dmg', n=2, t='foeHero'))   # s1mple — Stockholm
spell(167, 4, play('buff', a=2, h=2, t='allFriendMin', f=club('Vitality')), play('draw', n=1, f=club('Vitality')))
spell(171, 6, play('buff', a=3, h=3, t='allFriendMin'))                # Vitality — la saison record
spell(173, 2, play('heal', n=10, t='myHero', **{'if': HURT}), play('draw', n=2, f='*', **{'if': HURT}), play('draw', n=1, f='*', **{'if': NOTHURT}))

# ---- Trophées : on les pose sur la table ----
unit(168, 5, 0, 8, ('taunt',), aura('buff', a=2, h=0, f='J&LoL'))
unit(169, 5, 0, 8, ('taunt',), aura('buff', a=2, h=0, f='J&Dota'))
unit(170, 5, 0, 8, ('taunt',), aura('buff', a=2, h=0, f='J&CS'))

# ---- Joueurs ----
unit(33, 2, 3, 1, ('charge',))                                         # Jankos — first blood
unit(34, 3, 2, 5, ('taunt',))                                          # Wunder
unit(35, 1, 1, 2, (), play('kw', k='shield', t='friendMin'))           # Mikyx
unit(36, 3, 3, 3, (), play('buff', a=1, h=1, t='self', **{'if': has('J&LoL')}))   # Upset
unit(37, 2, 3, 2)                                                      # Sneaky
unit(38, 2, 2, 3, (), play('buff', a=2, h=0, t='self', **{'if': has(club('Fnatic'))}))   # Bwipo
unit(39, 3, 3, 2, ('charge',))                                         # Stewie2K
unit(40, 3, 3, 3, (), play('dmg', n=1, t='enemy'))                     # Twistzz
unit(41, 2, 2, 2, ('stealth',))                                        # ropz
unit(42, 4, 4, 5)                                                      # Hiko
unit(43, 3, 3, 2, (), play('dmg', n=2, t='min'))                       # yay
unit(44, 4, 3, 5, ('taunt',))                                          # Crimsix
unit(45, 3, 2, 4, (), aura('buff', a=1, h=0, f='J&Dota'))              # KuroKy — capitaine
unit(46, 3, 3, 3, (), play('draw', n=1, f='*'))                        # Shroud
unit(88, 3, 3, 3, (), play('buffPer', a=1, h=1, f=club('G2')))         # Perkz
unit(89, 4, 4, 4, (), play('draw', n=1, f='LoL'))                      # Bjergsen
unit(90, 5, 4, 4, ('wind',))                                           # Arteezy
unit(91, 2, 3, 2, (), play('buff', a=1, h=1, t='self', **{'if': has(club('T1'))}))   # Gumayusi
unit(92, 3, 5, 2, (), play('kw', k='charge', t='self', **{'if': ALONE}))   # Doublelift
unit(93, 2, 1, 3, (), play('dmg', n=2, t='enemyMin'))                  # Madlife — le hook
unit(94, 4, 4, 4, (), play('buffPer', a=1, h=0, f='J&LoL'))            # Ruler
unit(95, 2, 1, 3, (), end('buff', a=1, h=1, t='self'))                 # Rookie
unit(96, 4, 5, 3, ('charge',))                                         # TheShy
unit(97, 3, 2, 4, (), end('buff', a=1, h=0, t='self'))                 # Chovy
unit(98, 3, 2, 4, ('shield',), play('buff', a=2, h=2, t='self', **{'if': HURT}))   # Xyp9x — le clutch
unit(99, 4, 4, 4, (), play('dmg', n=2, t='min'))                       # NiKo
unit(100, 3, 3, 3, (), play('buffPer', a=1, h=1, f=club('Astralis')))  # dupreeh
unit(101, 3, 2, 4, (), aura('buff', a=1, h=0, f='J&CS'))               # gla1ve — IGL
unit(102, 4, 3, 3, (), play('dmg', n=3, t='min'))                      # ScreaM
unit(103, 4, 3, 4, (), end('buff', a=1, h=1, t='self'))                # Miracle-
unit(104, 3, 3, 4, ('taunt',))                                         # Ceb
unit(105, 5, 5, 5, ('stealth',))                                       # Ana
unit(106, 3, 3, 3, ('stealth',))                                       # cNed
unit(107, 4, 3, 3, ('wind',))                                          # aspas
unit(108, 3, 3, 3, (), play('kw', k='charge', t='self', **{'if': has(club('Fnatic'))}))   # Derke
unit(109, 2, 1, 3, (), aura('buff', a=1, h=0, f='J&Val'))              # Boaster
unit(110, 2, 2, 2, (), aura('self', a=2, h=2, **{'if': ALONE}))        # MarineKing
unit(111, 3, 3, 3, (), aura('self', a=2, h=2, **{'if': ALONE}))        # Scarlett
unit(112, 3, 4, 3, (), play('duel', t='enemyMin'))                     # Tokido
unit(113, 2, 3, 2, (), play('duel', t='enemyMin'))                     # Mang0
unit(114, 4, 4, 4, (), play('buff', a=1, h=1, t='allFriendMin', f='J&CoD'))   # Scump
unit(115, 3, 3, 2, ('charge',))                                        # Sinatraa
unit(116, 3, 2, 3, (), play('draw', n=2, f='*'))                       # Ninja
unit(117, 5, 7, 4)                                                     # Uzi
unit(118, 4, 4, 3, (), play('dmg', n=1, t='allEnemyMin'))              # Caps
unit(119, 4, 4, 3, (), play('buffPer', a=1, h=1, f=club('Fnatic')))   # Rekkles
unit(120, 4, 3, 5, (), play('buff', a=1, h=1, t='allFriendMin'))       # ShowMaker
unit(121, 4, 2, 3, (), play('dmg', n=4, t='min'))                      # kennyS — l'AWP
unit(122, 3, 3, 3, (), play('buff', a=2, h=2, t='self', **{'if': has(club('Vitality'))}))   # shox
unit(123, 3, 3, 3, ('stealth',))                                       # GeT_RiGhT
unit(124, 3, 3, 3, (), play('buff', a=2, h=2, t='self', **{'if': has('id:123')}))   # f0rest + GeT_RiGhT
unit(125, 4, 3, 4, (), play('dmg', n=3, t='min'))                      # device
unit(126, 3, 3, 3, (), play('dmg', n=2, t='enemy'))                    # Dendi
unit(127, 4, 3, 5, (), aura('buff', a=1, h=1, f=club('OG')))           # N0tail (épique)
unit(128, 3, 2, 4, (), play('draw', n=1, f='Dota'))                    # Puppey
unit(129, 3, 3, 3, (), aura('self', a=2, h=2, **{'if': ALONE}))        # Jaedong
unit(130, 4, 4, 4, (), aura('self', a=3, h=3, **{'if': ALONE}))        # Mvp
unit(131, 3, 3, 2, (), play('dmg', n=2, t='enemy'))                    # TenZ
unit(132, 3, 2, 5, ('taunt', 'shield'))                                # Armada
unit(133, 2, 2, 3, (), play('duel', t='enemyMin'))                     # Justin Wong
unit(149, 5, 3, 5, ('charge', 'wind'))                                 # Fatal1ty
unit(153, 3, 3, 3, (), end('buff', a=1, h=1, t='self'))                # Zen
unit(154, 5, 5, 5, ('charge',), play('dmg', n=1, t='allEnemyMin'))     # donk
unit(155, 4, 4, 4, (), aura('self', a=3, h=3, **{'if': ALONE}))        # BoxeR
unit(156, 6, 6, 6, (), play('destroy', t='enemyMin'))                  # Flash — le Dieu
unit(157, 4, 4, 5, (), aura('buff', a=1, h=1, f='RTS'))                # Grubby
unit(161, 6, 4, 5, (), play('summon', n=2, tok=904))                   # Serral — l'essaim de zerglings
unit(163, 4, 4, 4, (), aura('buff', a=2, h=2, f='SPORT'), play('draw', n=1, f='SPORT'))   # Kaydop (secrète)
unit(165, 5, 3, 5, ('taunt',), aura('buff', a=1, h=1, f='J&CS'))       # apEX — le capitaine
unit(174, 4, 3, 6, ('taunt',), death('summon', n=1, tok=902))          # Ceb (secrète)
unit(175, 4, 4, 4, (), play('draw', n=2, f='FPS'))                     # Gotaga
# GOAT
unit(176, 7, 7, 7, ('shield',), play('buff', a=1, h=1, t='allFriendMin', f='J&LoL'))   # Faker
unit(177, 7, 6, 6, (), play('dmg', n=5, t='enemy'))                    # ZywOo
unit(178, 7, 5, 6, ('charge', 'wind'))                                 # Kaydop
unit(179, 6, 6, 5, (), play('dmg', n=2, t='allEnemy'))                 # Shotzzy
unit(180, 7, 5, 7, ('taunt',), aura('buff', a=1, h=1, f='*'))          # N0tail

assert sorted(C) == list(range(1, 181)), [i for i in range(1, 181) if i not in C]

out = []
for i, (name, rar, typ, game) in enumerate(rows, 1):
    g = GAME.get(game, game)
    tags = [club(k) for k, ids in CLUBS.items() if i in ids] + (['stream'] if i in STREAM else [])
    assert g in FAM, (i, name, game)          # chaque carte doit appartenir à une famille connue
    d = dict(id=i, **C[i], g=g, fam=FAM[g], t=TYPE[typ], r=rar, tags=tags)
    out.append(d)
# jetons invoqués par certains effets
out.append(dict(id=901, k='u', c=1, a=1, h=1, kw=[], fx=[], g='Multi', fam='MULTI', t='Tok', r='C', tags=[], nom='Fan', src=85))
out.append(dict(id=904, k='u', c=1, a=1, h=1, kw=['charge'], fx=[], g='SC2', fam='RTS', t='Tok', r='C', tags=[], nom='Zergling', src=161))
out.append(dict(id=903, k='s', c=0, kw=[], fx=[play('mana', n=1)], g='Multi', fam='MULTI', t='Tok', r='C', tags=[], nom='Pause technique'))
out.append(dict(id=902, k='u', c=2, a=2, h=2, kw=[], fx=[], g='Multi', fam='MULTI', t='Tok', r='C', tags=[], nom='Remplaçant', src=174))

clubs = {k: CLUB_NAME[k] for k in CLUBS}
js = ('// Généré par tools/pvp_cartes.py — ne pas modifier à la main.\n'
      '(function (root) {\n  root.PVP_CARDS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
      '  root.PVP_CLUBS = ' + json.dumps(clubs, ensure_ascii=False) + ';\n'
      '})(typeof window !== \'undefined\' ? window : globalThis);\n')
(ROOT / 'js/pvp-data.js').write_text(js, encoding='utf-8')
print('ok', len(out), 'cartes')

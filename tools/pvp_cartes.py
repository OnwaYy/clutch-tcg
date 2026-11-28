#!/usr/bin/env python3
"""Génère js/pvp-data.js : les stats PvP des 180 cartes (coût, puissance, effets, synergies).

Lancer : python3 tools/pvp_cartes.py
Les effets sont des données (pas du texte) : le moteur les applique et en écrit lui-même la description,
donc le texte affiché correspond toujours à ce que fait la carte.
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'data/origines.js').read_text(encoding='utf-8')
rows = re.findall(r'\["([^"]+)", "(\w)", "([^"]+)", "([^"]+)"', src)
assert len(rows) == 180, len(rows)

# ---------- Jeu et famille de chaque carte ----------
GAME = {'Counter-Strike': 'CS', 'League of Legends': 'LoL', 'Dota 2': 'Dota', 'Valorant': 'Val', 'Call of Duty': 'CoD',
        'Rocket League': 'RL', 'StarCraft II': 'SC2', 'StarCraft: Brood War': 'BW', 'StarCraft': 'BW', 'Warcraft III': 'WC3',
        'Overwatch': 'OW', 'Fortnite': 'FN', 'Quake': 'Quake', 'Halo': 'Halo', 'Rainbow Six Siege': 'R6',
        'Super Smash Bros. Melee': 'Smash', 'Street Fighter': 'SF', 'Jeux de combat': 'FGC', 'Counter-Strike / Valorant': 'CS',
        'Multi-jeux': 'Multi'}
FAM = {'CS': 'FPS', 'Val': 'FPS', 'CoD': 'FPS', 'OW': 'FPS', 'FN': 'FPS', 'Quake': 'FPS', 'Halo': 'FPS', 'R6': 'FPS',
       'LoL': 'MOBA', 'Dota': 'MOBA', 'SC2': 'RTS', 'BW': 'RTS', 'WC3': 'RTS', 'Smash': 'COMBAT', 'SF': 'COMBAT', 'FGC': 'COMBAT',
       'RL': 'SPORT', 'Multi': 'MULTI'}
TYPE = {'Joueur': 'J', 'Joueuse': 'J', 'Logo de club': 'Club', 'Équipe': 'Club', 'Moment': 'Mom', 'Jeu': 'Jeu', 'Logo de ligue': 'Lig',
        'Logo de tournoi': 'Lig', 'Map': 'Map', 'Événement': 'Evt', 'Lieu': 'Lieu', 'Trophée': 'Tro', 'Média': 'Med',
        'Caster': 'Cast', 'Casters': 'Cast'}

# ---------- Clubs (pour les synergies d'organisation) ----------
CLUBS = {
    'Vitality': [177, 165, 153, 163, 178, 122, 41, 164, 167, 171, 72],
    'Astralis': [98, 100, 101, 125, 159, 76],
    'NiP': [123, 124, 158, 77],
    'G2': [88, 118, 33, 34, 35, 99, 69],
    'Fnatic': [119, 38, 36, 108, 109, 151, 67],
    'Liquid': [45, 103, 39, 40, 92, 150, 68],
    'FaZe': [99, 40, 41, 75],
    'Cloud9': [37, 39, 46, 148, 70],
    'NaVi': [126, 128, 166, 152, 71],
    'OG': [127, 104, 105, 174, 180, 160],
    'T1': [176, 91, 147, 172, 135, 73],
    'GenG': [94, 97, 74],
    'OpTic': [114, 44, 179, 48],
    'EG': [90, 143, 49],
    'Secret': [128, 50],
    'RNG': [117, 9],
    'KT': [156, 10],
    'EnVyUs': [121, 14],
    'MOUZ': [41, 6],
    'Dignitas': [163, 178, 4],
    '4Kings': [157, 2],
}
STREAM = [46, 116, 175, 85]          # streamers (Shroud, Ninja, Gotaga) + Twitch
CLUB_NAME = {'Vitality': 'Vitality', 'Astralis': 'Astralis', 'NiP': 'NiP', 'G2': 'G2', 'Fnatic': 'Fnatic', 'Liquid': 'Liquid',
             'FaZe': 'FaZe', 'Cloud9': 'Cloud9', 'NaVi': 'Na\'Vi', 'OG': 'OG', 'T1': 'T1', 'GenG': 'Gen.G', 'OpTic': 'OpTic',
             'EG': 'Evil Geniuses', 'Secret': 'Team Secret', 'RNG': 'RNG', 'KT': 'KT Rolster', 'EnVyUs': 'EnVyUs', 'MOUZ': 'MOUZ',
             'Dignitas': 'Dignitas', '4Kings': '4Kings'}

# ---------- Petites aides pour écrire les effets ----------
def rev(o, **k): return dict(k='rev', o=o, **k)      # à la révélation
def cont(o, **k): return dict(k='cont', o=o, **k)    # continu
def ter(o, **k): return dict(k='ter', o=o, **k)      # terrain (s'applique aux deux joueurs sur cette map)
def turn(o, **k): return dict(k='turn', o=o, **k)    # à la fin de chaque tour

ALONE = {'alone': 1}          # seule carte de ton côté ici
DUEL = {'duel': 1}            # une seule carte adverse ici
LOSING = {'losing': 1}        # tu perds cette map
LATE = {'late': 1}            # joué au tour 5 ou 6
def has(f, at='here', n=1): return {'min': [f, n, at]}
def duo(i): return {'duo': i}
def club(c): return 'club:' + c

# id : (coût, puissance, [effets])
C = {}
def card(i, cost, power, *fx): C[i] = (cost, power, list(fx))

# ---- Clubs ----
card(1, 2, 2, cont('aura', v=1, f='J', at='here'))                        # mTw
card(2, 2, 1, cont('aura', v=2, f=club('4Kings'), at='all'), cont('aura', v=1, f='RTS', at='all'))
card(3, 1, 1, cont('aura', v=1, f='CS&c<=2', at='all'))                   # compLexity
card(4, 1, 1, rev('draw', n=1, f='SPORT'))                                # Dignitas
card(5, 2, 2, cont('aura', v=1, f='LoL', at='here'))                      # CLG
card(6, 2, 2, cont('aura', v=2, f=club('MOUZ'), at='all'), rev('draw', n=1, f='J&CS'))
card(7, 2, 2, cont('aura', v=1, f='Dota', at='here'))                     # Alliance
card(8, 3, 3, rev('cost', v=1, f='Dota'))                                 # Newbee
card(9, 2, 1, cont('aura', v=3, f=club('RNG'), at='all'), cont('aura', v=1, f='LoL', at='here'))
card(10, 2, 1, cont('aura', v=3, f=club('KT'), at='all'), cont('aura', v=1, f='RTS', at='all'))
card(11, 2, 1, rev('nrg', n=1))                                           # 100 Thieves
card(12, 2, 2, cont('pow', v=3, **{'if': LOSING}))                        # FURIA
card(13, 3, 3, cont('aura', v=1, f='CS', at='all'))                       # MIBR
card(14, 2, 1, cont('aura', v=3, f=club('EnVyUs'), at='all'), cont('aura', v=1, f='FPS', at='here'))
card(47, 3, 2, rev('per', v=1, f='FPS', at='here'))                       # Virtus.pro
card(48, 2, 1, cont('aura', v=2, f=club('OpTic'), at='all'), cont('aura', v=1, f='CoD', at='all'))
card(49, 2, 1, cont('aura', v=2, f=club('EG'), at='all'), rev('cost', v=1, f='MOBA&c>=4'))
card(50, 2, 1, cont('aura', v=2, f=club('Secret'), at='all'), cont('aura', v=1, f='Dota', at='here'))
for i, cl in ((67, 'Fnatic'), (68, 'Liquid'), (69, 'G2'), (70, 'Cloud9'), (71, 'NaVi'), (72, 'Vitality'), (73, 'T1'),
              (74, 'GenG'), (75, 'FaZe'), (76, 'Astralis'), (77, 'NiP')):
    card(i, 3, 2, cont('aura', v=2, f=club(cl), at='all'))
card(78, 2, 2, rev('draw', n=1, f='J'))                                   # SK Gaming

# ---- Ligues et circuits ----
card(15, 1, 1, rev('cost', v=1, f='LoL'))                                 # LEC
card(16, 3, 1, cont('aura', v=1, f='LoL', at='all'))                      # LCK
card(17, 3, 2, rev('per', v=1, f='LoL', at='here'))                       # LPL
card(18, 1, 1, rev('draw', n=1, f='LoL'))                                 # LCS
card(19, 2, 1, cont('aura', v=1, f='Val', at='all'))                      # VCT
card(20, 2, 1, cont('aura', v=2, f='RL', at='all'))                       # RLCS
card(21, 2, 2, cont('aura', v=1, f='CS', at='here'))                      # ESL Pro League
card(22, 3, 2, rev('cost', v=1, f='CS'))                                  # BLAST Premier
card(23, 2, 2, cont('aura', v=1, f='FPS', at='here'))                     # Overwatch League
card(24, 2, 1, cont('aura', v=2, f='CoD', at='all'))                      # Call of Duty League

# ---- Maps : terrain, pour les deux joueurs ----
card(25, 1, 0, ter('all', v=2, f='CS'))                                   # Dust2
card(26, 1, 0, ter('all', v=2, f='c<=2'))                                 # Mirage
card(27, 1, 0, ter('all', v=-2, f='c>=4'))                                # Inferno
card(28, 1, 1, ter('cap', n=3))                                           # Nuke
card(29, 1, 0, ter('all', v=1, f='J'))                                    # Train
card(30, 1, 0, ter('all', v=3, f='alone'))                                # Overpass
card(31, 1, 0, ter('all', v=2, f='MOBA'))                                 # Faille de l'invocateur
card(32, 1, 0, ter('all', v=3, f='Val'))                                  # Ascent

# ---- Jeux ----
card(51, 1, 1, rev('draw', n=1, f='FPS'))                                 # Quake
card(52, 2, 1, rev('cost', v=1, f='RTS'))                                 # Brood War
card(53, 2, 1, cont('aura', v=1, f='CS', at='all'))                       # Counter-Strike
card(54, 1, 1, rev('draw', n=1, f='RTS'))                                 # Warcraft III
card(55, 2, 1, cont('aura', v=1, f='COMBAT', at='all'))                   # Smash
card(56, 2, 2, cont('aura', v=1, f='FPS', at='here'))                     # Halo
card(57, 2, 1, cont('aura', v=1, f='CoD', at='all'))                      # Call of Duty
card(58, 2, 1, cont('aura', v=1, f='LoL', at='all'))                      # League of Legends
card(59, 2, 1, cont('aura', v=1, f='RTS', at='all'))                      # StarCraft II
card(60, 2, 1, cont('aura', v=1, f='Dota', at='all'))                     # Dota 2
card(61, 2, 1, cont('aura', v=1, f='SPORT', at='all'))                    # Rocket League
card(62, 3, 3, rev('lock'))                                               # Rainbow Six Siege : on barricade
card(63, 2, 1, rev('cost', v=1, f='FPS'))                                 # Overwatch
card(64, 2, 1, rev('hit', v=1, f='*', at='here'))                         # Fortnite : battle royale
card(65, 2, 1, cont('aura', v=1, f='Val', at='all'))                      # Valorant
card(66, 1, 1, rev('draw', n=1, f='COMBAT'))                              # Street Fighter

# ---- Lieux, événements, médias, casters ----
card(79, 3, 2, ter('all', v=2, f='FPS'))                                  # Spodek
card(80, 3, 2, cont('aura', v=2, f='CS', at='here'))                      # Lanxess Arena
card(81, 3, 1, rev('draw', n=2, f='*'))                                   # DreamHack
card(82, 2, 1, cont('aura', v=2, f='RTS', at='here'))                     # BlizzCon
card(83, 2, 1, cont('aura', v=2, f='COMBAT', at='all'))                   # Evo
card(84, 3, 2, rev('mute'))                                               # OGN : coupe le direct adverse
card(85, 1, 1, cont('aura', v=3, f='stream', at='all'))                   # Twitch
card(86, 2, 1, rev('aura', v=2, f='CS', at='here'))                       # Anders Blume
card(87, 2, 1, rev('aura', v=2, f='RTS', at='all'))                       # Tasteless & Artosis
card(135, 4, 3, rev('aura', v=2, f=club('T1'), at='all'))                 # Worlds 2013
card(136, 3, 3, cont('dbl'))                                              # Worlds 2017 : finale, la map compte double
card(137, 4, 4, rev('hit', v=1, f='*', at='here'))                        # Worlds 2019 : le 3-0
card(138, 3, 2, rev('per', v=1, f='Dota', at='all'))                      # TI4
card(142, 4, 3, cont('dbl'), rev('pow', v=3, **{'if': ALONE}))            # Fortnite World Cup

# ---- Moments ----
card(134, 3, 3, rev('per', v=2, f='Val', at='here'))                      # Sentinels Reykjavík
card(139, 4, 4, cont('per', v=1, f='LoL', at='here'))                     # ROX Tigers
card(140, 4, 2, rev('aura', v=3, f='*', at='here'))                       # Le dragon des Worlds 2017
card(141, 3, 3, rev('swing', v=3))                                        # Luminosity
card(143, 4, 2, rev('nrg', n=2))                                          # EG — TI5, 6 millions
card(144, 4, 4, rev('aura', v=2, f='LoL', at='here'))                     # Invictus Gaming
card(145, 3, 0, rev('swing', v=4))                                        # Team Spirit — le miracle
card(146, 2, 1, rev('hitTop', v=4))                                       # Taipei Assassins — le hold-up
card(147, 4, 4, rev('aura', v=2, f=club('T1'), at='all'))                 # SKT — le doublé
card(148, 3, 2, rev('pow', v=6, **{'if': LOSING}))                        # Cloud9 — Boston
card(150, 4, 3, rev('per', v=2, f=club('Liquid'), at='all'))              # Liquid — TI7
card(151, 2, 2, rev('aura', v=2, f=club('Fnatic'), at='all'), rev('draw', n=1, f=club('Fnatic')))
card(152, 3, 1, rev('nrg', n=3))                                          # Na'Vi — le premier million
card(158, 4, 4, rev('lock'))                                              # NiP — 87-0 : map verrouillée
card(159, 5, 4, cont('aura', v=2, f='J&CS', at='all'))                    # Astralis — la dynastie
card(160, 4, 3, rev('rerev'))                                             # OG — le doublé
card(162, 2, 2, rev('pow', v=6, **{'if': ALONE}))                         # Bugha
card(164, 5, 5, rev('aura', v=2, f='J&CS', at='all'))                     # ZywOo — triple champion
card(166, 4, 3, rev('auraWin', v=2))                                      # s1mple — sans perdre une map
card(167, 3, 3, cont('aura', v=2, f=club('Vitality'), at='here'))          # Vitality — Paris
card(171, 6, 7, cont('per', v=1, f=club('Vitality'), at='all'))           # Vitality — la saison record
card(173, 3, 2, rev('pow', v=7, **{'if': LOSING}))                        # Deft — le rêve de DRX

# ---- Trophées ----
card(168, 4, 2, cont('dbl'), cont('aura', v=1, f='LoL', at='here'))
card(169, 4, 2, cont('dbl'), cont('aura', v=1, f='Dota', at='here'))
card(170, 4, 2, cont('dbl'), cont('aura', v=1, f='CS', at='here'))
card(172, 4, 3, cont('aura', v=3, f=club('T1'), at='all'))               # T1 — 6 étoiles

# ---- Joueurs : communs ----
card(33, 2, 2, rev('hitTop', v=2))                                        # Jankos — first blood
card(34, 3, 3, cont('pow', v=3, **{'if': ALONE}))                         # Wunder — top lane, seul
card(35, 1, 1, cont('aura', v=1, f='J', at='here'))                       # Mikyx — support
card(36, 3, 3, cont('pow', v=2, **{'if': has('LoL')}))                    # Upset
card(37, 2, 3)                                                            # Sneaky
card(38, 2, 2, rev('pow', v=2, **{'if': has(club('Fnatic'), 'all')}))     # Bwipo
card(39, 2, 2, cont('per', v=1, f='CS', at='here'))                       # Stewie2K
card(40, 3, 3, rev('pow', v=3, **{'if': LATE}))                           # Twistzz
card(41, 2, 2, cont('pow', v=2, **{'if': ALONE}))                         # ropz — lurker
card(42, 4, 6)                                                            # Hiko
card(43, 3, 3, rev('hitTop', v=2))                                        # yay
card(44, 3, 3, cont('per', v=1, f='CoD', at='here'))                      # Crimsix
card(45, 2, 2, cont('aura', v=1, f='Dota', at='here'))                    # KuroKy — capitaine
card(46, 2, 3, rev('draw', n=1, f='*'))                                   # Shroud
# peu communs
card(88, 3, 3, rev('per', v=1, f=club('G2'), at='all'))                   # Perkz
card(89, 3, 3, cont('aura', v=1, f='LoL', at='here'))                     # Bjergsen
card(90, 4, 5, cont('pow', v=3, **{'if': ALONE}))                         # Arteezy
card(91, 2, 2, cont('pow', v=2, **{'if': has(club('T1'))}))               # Gumayusi
# épiques
card(92, 3, 3, cont('pow', v=4, **{'if': ALONE}))                         # Doublelift
card(93, 2, 1, rev('hitLow', v=3))                                        # Madlife — le hook
card(94, 4, 4, rev('per', v=1, f='LoL', at='here'))                       # Ruler
card(95, 2, 1, turn('grow', v=1))                                         # Rookie
card(96, 3, 3, rev('hitTop', v=3))                                        # TheShy
card(97, 3, 2, turn('grow', v=1))                                         # Chovy
card(98, 3, 2, rev('pow', v=5, **{'if': LOSING}))                         # Xyp9x — le roi des clutchs
card(99, 4, 4, cont('pow', v=3, **{'if': has('J&CS')}))                   # NiKo
card(100, 3, 2, rev('per', v=2, f=club('Astralis'), at='all'))           # dupreeh
card(101, 3, 2, cont('aura', v=2, f='J', at='here'))                      # gla1ve — IGL
card(102, 2, 2, rev('hitTop', v=3))                                       # ScreaM — headshot
card(103, 4, 4, turn('grow', v=1))                                        # Miracle-
card(104, 3, 3, rev('swing', v=2))                                        # Ceb
card(105, 4, 4, rev('pow', v=3, **{'if': LATE}))                          # Ana
card(106, 3, 3, cont('pow', v=3, **{'if': ALONE}))                        # cNed
card(107, 3, 3, rev('hit', v=1, f='*', at='here'))                        # aspas
card(108, 3, 3, rev('pow', v=3, **{'if': has(club('Fnatic'), 'all')}))   # Derke
card(109, 2, 1, cont('aura', v=2, f='Val', at='here'))                    # Boaster — capitaine
card(110, 2, 2, cont('pow', v=4, **{'if': ALONE}))                        # MarineKing
card(111, 3, 3, cont('pow', v=4, **{'if': ALONE}))                        # Scarlett
card(112, 3, 3, cont('pow', v=4, **{'if': DUEL}))                         # Tokido
card(113, 2, 2, cont('pow', v=3, **{'if': DUEL}))                         # Mang0
card(114, 4, 4, cont('per', v=1, f='CoD', at='all'))                      # Scump
card(115, 3, 3, rev('pow', v=3, **{'if': LATE}))                          # Sinatraa
card(116, 3, 2, rev('draw', n=2, f='*'))                                  # Ninja
card(117, 5, 8)                                                           # Uzi
card(118, 3, 2, rev('per', v=2, f=club('G2'), at='all'))                 # Caps
card(119, 3, 3, cont('per', v=1, f=club('Fnatic'), at='all'))            # Rekkles
card(120, 4, 4, rev('aura', v=1, f='J', at='here'))                       # ShowMaker
card(121, 3, 2, rev('hitTop', v=4))                                       # kennyS — l'AWP
card(122, 3, 3, rev('pow', v=3, **{'if': has(club('Vitality'), 'all')})) # shox
card(123, 3, 3, cont('pow', v=4, **{'if': ALONE}))                        # GeT_RiGhT
card(124, 3, 3, cont('pow', v=3, **{'if': duo(123)}))                     # f0rest — duo avec GeT_RiGhT
card(125, 4, 4, rev('hitTop', v=3))                                       # device
card(126, 3, 3, rev('hitLow', v=3))                                       # Dendi
card(127, 3, 2, cont('aura', v=2, f=club('OG'), at='all'))                # N0tail (épique)
card(128, 2, 1, cont('aura', v=1, f='Dota', at='all'))                    # Puppey
card(129, 3, 3, cont('pow', v=4, **{'if': DUEL}))                         # Jaedong
card(130, 4, 4, cont('pow', v=4, **{'if': ALONE}))                        # Mvp
card(131, 3, 3, rev('hitTop', v=3))                                       # TenZ
card(132, 3, 4, cont('shield'))                                           # Armada
card(133, 2, 2, cont('pow', v=3, **{'if': DUEL}))                         # Justin Wong
# légendaires et secrètes
card(149, 3, 3, cont('pow', v=4, **{'if': ALONE}), rev('draw', n=1, f='FPS'))  # Fatal1ty
card(153, 3, 2, turn('grow', v=2))                                        # Zen
card(154, 5, 6, rev('hit', v=2, f='*', at='here'))                        # donk
card(155, 4, 4, cont('pow', v=5, **{'if': ALONE}))                        # BoxeR
card(156, 5, 5, cont('perEnemy', v=2))                                    # Flash
card(157, 3, 3, cont('aura', v=2, f='RTS', at='all'))                     # Grubby
card(161, 4, 3, rev('perEnemy', v=2))                                     # Serral
card(163, 4, 4, cont('aura', v=2, f='SPORT', at='all'), cont('pow', v=2, **{'if': has(club('Vitality'), 'all')}))
card(165, 3, 3, cont('aura', v=1, f=club('Vitality'), at='all'), cont('aura', v=1, f='J', at='here'))   # apEX
card(174, 4, 3, rev('swing', v=4))                                        # Ceb (secrète)
card(175, 4, 3, rev('per', v=1, f='FPS', at='all'))                       # Gotaga
# GOAT
card(176, 6, 8, cont('shield'), cont('aura', v=1, f='LoL', at='all'))    # Faker
card(177, 6, 8, rev('per', v=2, f='J&CS', at='here'))                     # ZywOo
card(178, 6, 7, rev('aura', v=3, f='*', at='here'))                       # Kaydop
card(179, 6, 8, rev('hit', v=2, f='*', at='here'))                        # Shotzzy
card(180, 6, 7, cont('aura', v=2, f='*', at='here'))                      # N0tail

assert sorted(C) == list(range(1, 181)), [i for i in range(1, 181) if i not in C]

out = []
for i, (name, rar, typ, game) in enumerate(rows, 1):
    g = GAME.get(game, game)
    tags = [club(k) for k, ids in CLUBS.items() if i in ids] + (['stream'] if i in STREAM else [])
    cost, power, fx = C[i]
    out.append({'id': i, 'c': cost, 'p': power, 'fx': fx, 'g': g, 'fam': FAM.get(g, 'MULTI'),
                't': TYPE[typ], 'r': rar, 'tags': tags})

clubs = {k: CLUB_NAME[k] for k in CLUBS}
js = ('// Généré par tools/pvp_cartes.py — ne pas modifier à la main.\n'
      '(function (root) {\n  root.PVP_CARDS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
      '  root.PVP_CLUBS = ' + json.dumps(clubs, ensure_ascii=False) + ';\n'
      '})(typeof window !== \'undefined\' ? window : globalThis);\n')
(ROOT / 'js/pvp-data.js').write_text(js, encoding='utf-8')
print('ok', len(out), 'cartes')

// Moteur de match 1v1 de Clutch TCG (style Hearthstone) — partagé entre le site et le serveur.
// Chacun son tour : on pose des joueurs sur le plateau, ils attaquent les cartes ou le héros adverse.
// On gagne quand le héros adverse tombe à 0 PV.
(function (root) {
  'use strict';
  const DEFS = {}; (root.PVP_CARDS || []).forEach(function (d) { DEFS[d.id] = d; });
  const CLUBS = root.PVP_CLUBS || {};
  const HERO_HP = 25, BOARD_MAX = 6, HAND_MAX = 10, MANA_MAX = 10, DECK_SIZE = 20, TURN_CAP = 50, HURT_AT = 12;
  const CHOICE = { any: 1, enemy: 1, enemyMin: 1, min: 1, friendMin: 1 };

  // ---------- Hasard reproductible ----------
  function rnd(st) { let t = (st.rng = (st.rng + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  // ---------- Filtres de cartes ----------
  const GAMES = ['CS', 'LoL', 'Dota', 'Val', 'CoD', 'RL', 'SC2', 'BW', 'WC3', 'OW', 'FN', 'Quake', 'Halo', 'R6', 'Smash', 'SF', 'FGC'];
  const FAMS = ['FPS', 'MOBA', 'RTS', 'COMBAT', 'SPORT', 'MULTI'];
  const TYPES = ['J', 'Club', 'Mom', 'Jeu', 'Lig', 'Map', 'Evt', 'Lieu', 'Tro', 'Med', 'Cast', 'Tok'];
  function test1(t, d) {
    if (t === '*') return true;
    if (t.indexOf('club:') === 0 || t === 'stream') return d.tags.indexOf(t) >= 0;
    if (t.indexOf('id:') === 0) return d.id === +t.slice(3);
    if (FAMS.indexOf(t) >= 0) return d.fam === t;
    if (GAMES.indexOf(t) >= 0) return d.g === t;
    if (TYPES.indexOf(t) >= 0) return d.t === t;
    return false;
  }
  function match(f, cid) { const d = DEFS[cid]; return !!d && String(f || '*').split('&').every(function (t) { return test1(t, d); }); }

  // ---------- Textes ----------
  const GNAME = { CS: 'Counter-Strike', LoL: 'LoL', Dota: 'Dota 2', Val: 'Valorant', CoD: 'Call of Duty', RL: 'Rocket League', SC2: 'StarCraft II', BW: 'Brood War', WC3: 'Warcraft III', OW: 'Overwatch', FN: 'Fortnite', Quake: 'Quake', Halo: 'Halo', R6: 'Rainbow Six', Smash: 'Smash', SF: 'Street Fighter', FGC: 'jeux de combat' };
  const FNAME = { FPS: 'FPS', MOBA: 'MOBA', RTS: 'de stratégie', COMBAT: 'de jeux de combat', SPORT: 'Rocket League', MULTI: 'multi-jeux' };
  const KWN = { taunt: 'Provocation', charge: 'Charge', shield: 'Armure', stealth: 'Camouflage', wind: 'Double attaque' };
  const KWD = { taunt: 'les ennemis doivent l\'attaquer en premier', charge: 'peut attaquer dès qu\'il arrive', shield: 'ignore les premiers dégâts subis', stealth: 'ne peut pas être ciblé tant qu\'il n\'a pas attaqué', wind: 'peut attaquer deux fois par tour' };
  function fLabel(f, one) {
    const toks = String(f || '*').split('&'); let noun = one ? 'carte' : 'cartes'; const q = [];
    toks.forEach(function (t) {
      if (t === 'J') noun = one ? 'joueur' : 'joueurs';
      else if (t === '*') {}
      else if (t.indexOf('club:') === 0) q.push(CLUBS[t.slice(5)] || t.slice(5));
      else if (t.indexOf('id:') === 0) { noun = ''; q.push(root.PVP_NAMES ? root.PVP_NAMES[+t.slice(3)] : '#' + t.slice(3)); }
      else if (GNAME[t]) q.push(noun.indexOf('joueur') === 0 ? 'de ' + GNAME[t] : GNAME[t]);
      else if (FNAME[t]) q.push(FNAME[t]);
    });
    return (noun + ' ' + q.join(' ')).trim();
  }
  const TGT = { any: 'un personnage', enemy: 'un ennemi', enemyMin: 'un serviteur adverse', min: 'un serviteur', friendMin: 'un serviteur allié', self: 'ce serviteur',
    myHero: 'ton héros', foeHero: 'le héros adverse', allEnemyMin: 'tous les serviteurs adverses', allFriendMin: 'tes autres serviteurs', allMin: 'tous les autres serviteurs', allEnemy: 'tous les ennemis', randEnemy: 'un ennemi au hasard' };
  function tgtText(e) {
    if (e.f && e.f !== '*' && (e.t === 'allFriendMin' || e.t === 'friendMin')) return (e.t === 'friendMin' ? 'un(e) ' + fLabel(e.f, true) + ' allié(e)' : 'tes ' + fLabel(e.f));
    return TGT[e.t] || '';
  }
  function condText(c) {
    if (!c) return '';
    if (c.alone) return 'tu n\'as aucun autre serviteur';
    if (c.hurt) return 'ton héros a ' + HURT_AT + ' PV ou moins';
    if (c.nothurt) return 'ton héros a plus de ' + HURT_AT + ' PV';
    if (c.has) return 'tu contrôles ' + (c.has.indexOf('id:') === 0 ? fLabel(c.has) : 'un(e) autre ' + fLabel(c.has, true));
    return '';
  }
  function opText(e) {
    const tg = tgtText(e);
    switch (e.o) {
      case 'dmg': return 'inflige ' + e.n + ' dégât' + (e.n > 1 ? 's' : '') + ' à ' + tg + (e.times ? ', ' + e.times + ' fois' : '');
      case 'heal': return 'rend ' + e.n + ' PV à ' + tg;
      case 'buff': return (e.t === 'self' ? 'gagne ' : 'donne ') + '+' + e.a + '/+' + e.h + (e.t === 'self' ? '' : ' à ' + tg);
      case 'buffPer': return 'gagne +' + e.a + '/+' + e.h + ' pour chaque autre ' + fLabel(e.f, true) + ' que tu contrôles';
      case 'kw': return (e.t === 'self' ? 'gagne ' : 'donne ') + KWN[e.k] + (e.t === 'self' ? '' : ' à ' + tg);
      case 'draw': return 'pioche ' + (e.n > 1 ? e.n + ' ' + fLabel(e.f) : (e.f === '*' ? 'une carte' : 'un(e) ' + fLabel(e.f, true)));
      case 'cost': return 'tes ' + fLabel(e.f) + ' en main coûtent ' + e.v + ' de moins';
      case 'ramp': return 'gagne ' + e.n + ' cristal d\'énergie';
      case 'mana': return 'gagne ' + e.n + ' énergie pour ce tour';
      case 'silence': return 'réduit au silence ' + tg + ' (il perd ses effets)';
      case 'destroy': return 'détruit ' + tg + (e.min ? ' qui a ' + e.min + ' ATQ ou plus' : '');
      case 'summon': return 'invoque ' + (e.n > 1 ? e.n + ' ' : 'un ') + (DEFS[e.tok] ? DEFS[e.tok].nom + (e.n > 1 ? 's' : '') + ' ' + DEFS[e.tok].a + '/' + DEFS[e.tok].h : '');
      case 'revive': return 'ramène en jeu tes ' + e.n + ' derniers serviteurs morts';
      case 'duel': return 'affronte ' + tg + ' : ils s\'infligent leurs dégâts';
    }
    return '';
  }
  function cardText(cid) {
    const d = DEFS[cid]; if (!d) return [];
    const out = [];
    d.kw.forEach(function (k) { out.push({ kw: KWN[k], txt: KWD[k].charAt(0).toUpperCase() + KWD[k].slice(1) + '.' }); });
    const groups = {};
    d.fx.forEach(function (e) {
      let t;
      if (e.w === 'aura') t = e.o === 'self' ? 'a +' + e.a + '/+' + e.h + ' tant que ' + condText(e.if) : 'tes autres ' + fLabel(e.f) + ' ont +' + e.a + '/+' + e.h;
      else t = opText(e) + (e.if ? ' si ' + condText(e.if) : '');
      const kw = d.k === 's' ? 'Sort' : { play: 'Entrée', aura: 'Aura', end: 'Fin de tour', death: 'Dernier mot' }[e.w];
      (groups[kw] = groups[kw] || []).push(t);
    });
    Object.keys(groups).forEach(function (k) { const s = groups[k].join(', puis '); out.push({ kw: k, txt: s.charAt(0).toUpperCase() + s.slice(1) + '.' }); });
    return out;
  }

  // ---------- Création ----------
  function newMatch(deckA, deckB, opts) {
    opts = opts || {};
    const st = { v: 2, rng: (opts.seed >>> 0) || 1, n: 0, turn: 0, cur: 0, over: false, res: null, names: opts.names || ['Toi', 'Adversaire'], pl: [] };
    [deckA, deckB].forEach(function (deck, p) { st.pl[p] = { hp: HERO_HP, max: 0, mana: 0, deck: shuffle(st, deck.slice()), hand: [], board: [], grave: [], fat: 0 }; });
    const first = rnd(st) < .5 ? 0 : 1;
    const ev = [];
    for (let i = 0; i < 3; i++) { draw(st, first, '*', ev); draw(st, 1 - first, '*', ev); }
    draw(st, 1 - first, '*', ev);                         // le second joueur commence avec une carte de plus
    st.pl[1 - first].hand.push({ c: 903, m: 0 });          // … et une « Pause technique » (+1 énergie une fois)
    st.first = first;
    startTurn(st, first, ev);
    return st;
  }
  function draw(st, p, f, ev) {
    const pl = st.pl[p];
    const i = pl.deck.findIndex(function (c) { return match(f, c); });
    if (i < 0) {
      if (f !== '*') return;
      pl.fat++; damageHero(st, p, pl.fat, ev); ev.push({ t: 'fatigue', p: p, n: pl.fat }); return;
    }
    const c = pl.deck.splice(i, 1)[0];
    if (pl.hand.length >= HAND_MAX) { ev.push({ t: 'burn', p: p, c: c }); return; }
    pl.hand.push({ c: c, m: 0 }); ev.push({ t: 'draw', p: p, c: c });
  }
  function startTurn(st, p, ev) {
    st.cur = p; st.turn++;
    const pl = st.pl[p];
    pl.max = Math.min(MANA_MAX, pl.max + 1); pl.mana = pl.max;
    pl.board.forEach(function (m) { m.sick = 0; m.atks = 0; });
    ev.push({ t: 'turn', p: p, n: st.turn });
    draw(st, p, '*', ev);
    checkEnd(st, ev);
  }

  // ---------- Serviteurs ----------
  const D = function (m) { return DEFS[m.c]; };
  function auraOf(st, m) {
    let a = 0, h = 0;
    if (m.sil) return [0, 0];
    st.pl[m.o].board.forEach(function (x) {
      if (x.sil) return;
      D(x).fx.forEach(function (e) {
        if (e.w !== 'aura') return;
        if (x === m && e.o === 'self' && st.pl[m.o].board.length === 1) { a += e.a; h += e.h; }
        else if (x !== m && e.o === 'buff' && match(e.f, m.c)) { a += e.a; h += e.h; }
      });
    });
    return [a, h];
  }
  function atkOf(st, m) { return Math.max(0, D(m).a + m.da + auraOf(st, m)[0]); }
  function maxHpOf(st, m) { return D(m).h + m.dh + auraOf(st, m)[1]; }
  function hpOf(st, m) { return maxHpOf(st, m) - m.dmg; }
  function kw(m, k) { return !!m.kw[k]; }
  function findMin(st, u) { for (let p = 0; p < 2; p++) { const m = st.pl[p].board.find(function (x) { return x.u === u; }); if (m) return m; } return null; }
  function summon(st, p, cid, ev) {
    const pl = st.pl[p]; if (pl.board.length >= BOARD_MAX) return null;
    const d = DEFS[cid], m = { u: ++st.n, c: cid, o: p, da: 0, dh: 0, dmg: 0, kw: {}, sil: 0, sick: 1, atks: 0 };
    d.kw.forEach(function (k) { m.kw[k] = 1; });
    pl.board.push(m); ev.push({ t: 'summon', p: p, u: m.u, c: cid });
    return m;
  }

  // ---------- Dégâts, soins, morts ----------
  function damageHero(st, p, n, ev) { if (n <= 0) return; st.pl[p].hp -= n; ev.push({ t: 'dmg', id: 'h' + p, n: n }); }
  function damage(st, id, n, ev) {
    if (n <= 0) return;
    if (id === 'h0' || id === 'h1') return damageHero(st, +id[1], n, ev);
    const m = findMin(st, id); if (!m) return;
    if (m.kw.shield) { m.kw.shield = 0; ev.push({ t: 'shield', id: id }); return; }
    m.dmg += n; ev.push({ t: 'dmg', id: id, n: n });
  }
  function heal(st, id, n, ev) {
    if (id === 'h0' || id === 'h1') { const pl = st.pl[+id[1]], v = Math.min(n, HERO_HP - pl.hp); if (v > 0) { pl.hp += v; ev.push({ t: 'heal', id: id, n: v }); } return; }
    const m = findMin(st, id); if (!m) return; const v = Math.min(n, m.dmg); if (v > 0) { m.dmg -= v; ev.push({ t: 'heal', id: id, n: v }); }
  }
  function resolveDeaths(st, ev) {
    for (let loop = 0; loop < 20; loop++) {
      const dead = [];
      for (let p = 0; p < 2; p++) st.pl[p].board.forEach(function (m) { if (hpOf(st, m) <= 0) dead.push(m); });
      if (!dead.length) break;
      dead.sort(function (a, b) { return a.u - b.u; });
      dead.forEach(function (m) {
        const pl = st.pl[m.o]; pl.board.splice(pl.board.indexOf(m), 1);
        if (D(m).t !== 'Tok') pl.grave.push(m.c);
        ev.push({ t: 'die', u: m.u });
      });
      dead.forEach(function (m) { if (!m.sil) D(m).fx.forEach(function (e) { if (e.w === 'death') runOp(st, m.o, e, null, m, ev); }); });
    }
    checkEnd(st, ev);
  }
  function checkEnd(st, ev) {
    if (st.over) return;
    const a = st.pl[0].hp <= 0, b = st.pl[1].hp <= 0;
    if (a || b || st.turn > TURN_CAP) {
      st.over = true;
      st.res = { w: a && b ? -1 : a ? 1 : b ? 0 : st.pl[0].hp > st.pl[1].hp ? 0 : st.pl[1].hp > st.pl[0].hp ? 1 : -1 };
      ev.push({ t: 'end', res: st.res });
    }
  }

  // ---------- Cibles ----------
  function targetable(st, p, id) {                            // un ennemi camouflé ne peut pas être ciblé
    if (id === 'h0' || id === 'h1') return true;
    const m = findMin(st, id); return !!m && (m.o === p || !m.kw.stealth);
  }
  function choiceOp(cid) { return DEFS[cid].fx.find(function (e) { return e.w === 'play' && CHOICE[e.t]; }); }
  function legalTargets(st, p, cid) {
    const e = choiceOp(cid); if (!e) return null;
    const foe = 1 - p, out = [];
    const addMins = function (q) { st.pl[q].board.forEach(function (m) {
      if (!targetable(st, p, m.u)) return;
      if (e.f && e.f !== '*' && e.t === 'friendMin' && !match(e.f, m.c)) return;
      if (e.o === 'destroy' && e.min && atkOf(st, m) < e.min) return;
      out.push(m.u);
    }); };
    if (e.t === 'any') { addMins(p); addMins(foe); out.push('h' + p, 'h' + foe); }
    else if (e.t === 'enemy') { addMins(foe); out.push('h' + foe); }
    else if (e.t === 'enemyMin') addMins(foe);
    else if (e.t === 'min') { addMins(p); addMins(foe); }
    else if (e.t === 'friendMin') addMins(p);
    return out;
  }
  function autoTargets(st, p, e, self) {
    const foe = 1 - p, mins = function (q) { return st.pl[q].board.filter(function (m) { return m !== self && (!e.f || e.f === '*' || match(e.f, m.c)); }).map(function (m) { return m.u; }); };
    switch (e.t) {
      case 'self': return self ? [self.u] : [];
      case 'myHero': return ['h' + p];
      case 'foeHero': return ['h' + foe];
      case 'allEnemyMin': return mins(foe);
      case 'allFriendMin': return mins(p);
      case 'allMin': return mins(p).concat(mins(foe));
      case 'allEnemy': return mins(foe).concat(['h' + foe]);
    }
    return [];
  }
  function cond(st, p, c, self) {
    if (!c) return true;
    const others = st.pl[p].board.filter(function (m) { return m !== self; });
    if (c.alone) return others.length === 0;
    if (c.hurt) return st.pl[p].hp <= HURT_AT;
    if (c.nothurt) return st.pl[p].hp > HURT_AT;
    if (c.has) return others.some(function (m) { return match(c.has, m.c); });
    return true;
  }

  // ---------- Effets ----------
  function runOp(st, p, e, tgt, self, ev) {
    if (!cond(st, p, e.if, self)) return;
    let ids = CHOICE[e.t] ? (tgt != null ? [tgt] : []) : autoTargets(st, p, e, self);
    switch (e.o) {
      case 'dmg':
        if (e.t === 'randEnemy') {
          for (let k = 0; k < (e.times || 1); k++) {
            const pool = st.pl[1 - p].board.filter(function (m) { return hpOf(st, m) > 0; }).map(function (m) { return m.u; }).concat(['h' + (1 - p)]);
            damage(st, pool[Math.floor(rnd(st) * pool.length)], e.n, ev);
          }
        } else for (let k = 0; k < (e.times || 1); k++) ids.forEach(function (id) { damage(st, id, e.n, ev); });
        break;
      case 'heal': ids.forEach(function (id) { heal(st, id, e.n, ev); }); break;
      case 'buff': ids.forEach(function (id) { const m = findMin(st, id); if (m) { m.da += e.a; m.dh += e.h; ev.push({ t: 'buff', id: id, a: e.a, h: e.h }); } }); break;
      case 'buffPer': if (self) { const n = st.pl[p].board.filter(function (m) { return m !== self && match(e.f, m.c); }).length; if (n) { self.da += e.a * n; self.dh += e.h * n; ev.push({ t: 'buff', id: self.u, a: e.a * n, h: e.h * n }); } } break;
      case 'kw': ids.forEach(function (id) { const m = findMin(st, id); if (m) { m.kw[e.k] = 1; ev.push({ t: 'kw', id: id, k: e.k }); } }); break;
      case 'draw': for (let k = 0; k < e.n; k++) draw(st, p, e.f, ev); break;
      case 'cost': st.pl[p].hand.forEach(function (h) { if (match(e.f, h.c)) h.m += e.v; }); ev.push({ t: 'cost', p: p }); break;
      case 'ramp': st.pl[p].max = Math.min(MANA_MAX, st.pl[p].max + e.n); ev.push({ t: 'ramp', p: p }); break;
      case 'mana': st.pl[p].mana += e.n; ev.push({ t: 'ramp', p: p }); break;
      case 'silence': ids.forEach(function (id) { const m = findMin(st, id); if (m) { m.sil = 1; m.kw = {}; m.da = 0; m.dh = 0; ev.push({ t: 'silence', id: id }); } }); break;
      case 'destroy': ids.forEach(function (id) { const m = findMin(st, id); if (m) { m.dmg = 999; m.kw.shield = 0; ev.push({ t: 'destroy', id: id }); } }); break;
      case 'summon': for (let k = 0; k < e.n; k++) summon(st, p, e.tok, ev); break;
      case 'revive': st.pl[p].grave.slice(-e.n).forEach(function (c) { summon(st, p, c, ev); }); break;
      case 'duel': ids.forEach(function (id) { const m = findMin(st, id); if (m && self) { const a1 = atkOf(st, self), a2 = atkOf(st, m); ev.push({ t: 'atk', from: self.u, to: id }); damage(st, id, a1, ev); damage(st, self.u, a2, ev); } }); break;
    }
  }

  // ---------- Coups ----------
  function costOf(st, p, h) { return Math.max(0, DEFS[h.c].c - h.m); }
  function canAttack(st, m) { return st.cur === m.o && !st.over && atkOf(st, m) > 0 && (!m.sick || m.kw.charge) && m.atks < (m.kw.wind ? 2 : 1); }
  function attackTargets(st, m) {
    const foe = 1 - m.o, enemies = st.pl[foe].board.filter(function (x) { return !x.kw.stealth; });
    const taunts = enemies.filter(function (x) { return x.kw.taunt; });
    return taunts.length ? taunts.map(function (x) { return x.u; }) : enemies.map(function (x) { return x.u; }).concat(['h' + foe]);
  }
  // a : { t: 'play', h, tgt } | { t: 'atk', from, to } | { t: 'end' }
  function check(st, p, a) {
    if (st.over) return 'Le match est terminé.';
    if (st.cur !== p) return 'Ce n\'est pas ton tour.';
    if (!a || typeof a !== 'object') return 'Action invalide.';
    const pl = st.pl[p];
    if (a.t === 'end') return null;
    if (a.t === 'play') {
      const h = pl.hand[a.h]; if (!h) return 'Carte introuvable.';
      const d = DEFS[h.c];
      if (costOf(st, p, h) > pl.mana) return 'Pas assez d\'énergie.';
      if (d.k === 'u' && pl.board.length >= BOARD_MAX) return 'Ton plateau est plein.';
      const lt = legalTargets(st, p, h.c);
      if (lt) {
        if (a.tgt != null && lt.indexOf(a.tgt) < 0) return 'Cible invalide.';
        if (a.tgt == null && lt.length && d.k === 's') return 'Choisis une cible.';
        if (!lt.length && d.k === 's') return 'Aucune cible possible.';
      }
      return null;
    }
    if (a.t === 'atk') {
      const m = pl.board.find(function (x) { return x.u === a.from; });
      if (!m) return 'Attaquant introuvable.';
      if (!canAttack(st, m)) return m.sick ? 'Ce joueur vient d\'arriver : il attaquera au prochain tour.' : 'Ce joueur a déjà attaqué.';
      if (attackTargets(st, m).indexOf(a.to) < 0) return 'Cible invalide (une Provocation protège peut-être l\'adversaire).';
      return null;
    }
    return 'Action invalide.';
  }
  function act(st, p, a) {
    const err = check(st, p, a); if (err) throw new Error(err);
    const ev = [], pl = st.pl[p];
    if (a.t === 'play') {
      const h = pl.hand.splice(a.h, 1)[0], d = DEFS[h.c];
      pl.mana -= costOf(st, p, h);
      ev.push({ t: 'play', p: p, c: h.c, tgt: a.tgt != null ? a.tgt : null });
      let self = null;
      if (d.k === 'u') self = summon(st, p, h.c, ev);
      d.fx.forEach(function (e) { if (e.w === 'play') runOp(st, p, e, a.tgt != null ? a.tgt : null, self, ev); });
      if (d.k === 's') pl.grave.length = pl.grave.length;      // les sorts ne vont pas au cimetière des serviteurs
      resolveDeaths(st, ev);
    } else if (a.t === 'atk') {
      const m = pl.board.find(function (x) { return x.u === a.from; });
      m.atks++; if (m.kw.stealth) m.kw.stealth = 0;
      ev.push({ t: 'atk', from: m.u, to: a.to });
      const atk = atkOf(st, m);
      if (a.to === 'h0' || a.to === 'h1') damage(st, a.to, atk, ev);
      else { const t = findMin(st, a.to), back = atkOf(st, t); damage(st, a.to, atk, ev); damage(st, m.u, back, ev); }
      resolveDeaths(st, ev);
    } else {
      pl.board.slice().forEach(function (m) { if (!m.sil && findMin(st, m.u)) D(m).fx.forEach(function (e) { if (e.w === 'end') runOp(st, p, e, null, m, ev); }); });
      resolveDeaths(st, ev);
      if (!st.over) startTurn(st, 1 - p, ev);
    }
    return ev;
  }

  // ---------- Adversaire joué par l'ordinateur ----------
  function clone(st) { return JSON.parse(JSON.stringify(st)); }
  function minVal(st, m) { const d = D(m); return atkOf(st, m) * 1.1 + hpOf(st, m) * .9 + (m.kw.taunt ? 1 : 0) + (m.kw.shield ? atkOf(st, m) * .5 + 1 : 0) + (m.kw.wind ? atkOf(st, m) * .6 : 0) + (m.kw.stealth ? .5 : 0) + (m.sil ? 0 : d.fx.filter(function (e) { return e.w === 'aura' || e.w === 'end'; }).length * 2) + .5; }
  function evalFor(st, p) {
    if (st.over) return st.res.w === p ? 1e4 : st.res.w === -1 ? 0 : -1e4;
    const me = st.pl[p], fo = st.pl[1 - p];
    let s = 0;
    me.board.forEach(function (m) { s += minVal(st, m); }); fo.board.forEach(function (m) { s -= minVal(st, m) * 1.05; });
    s += Math.sqrt(Math.max(0, me.hp)) * 4 - Math.sqrt(Math.max(0, fo.hp)) * 4.5 + me.hand.length * .8 - fo.hand.length * .4;
    if (fo.hp <= 10) s += (10 - fo.hp) * .6;                        // presser quand l'adversaire est bas
    return s;
  }
  function aiStep(st, p) {
    const base = evalFor(st, p), pl = st.pl[p];
    let best = null;
    const tryA = function (a, bonus) {
      if (check(st, p, a)) return;
      const s2 = clone(st); act(s2, p, a);
      const v = evalFor(s2, p) - base + (bonus || 0);
      if (!best || v > best.v) best = { v: v, a: a };
    };
    pl.hand.forEach(function (h, i) {
      if (costOf(st, p, h) > pl.mana) return;
      const lt = legalTargets(st, p, h.c);
      let bonus = costOf(st, p, h) * .35;                           // utiliser son énergie est une bonne chose
      if (DEFS[h.c].fx.some(function (e) { return e.o === 'mana'; }))   // la Pause technique : seulement si elle permet de jouer une carte de plus
        bonus = pl.hand.some(function (x) { return x !== h && costOf(st, p, x) === pl.mana + 1; }) ? 1.5 : -5;
      if (lt && lt.length) lt.forEach(function (t) { tryA({ t: 'play', h: i, tgt: t }, bonus); });
      else tryA({ t: 'play', h: i }, bonus);
    });
    pl.board.forEach(function (m) { if (canAttack(st, m)) attackTargets(st, m).forEach(function (t) { tryA({ t: 'atk', from: m.u, to: t }, .2); }); });
    return best && best.v > 0 ? best.a : null;
  }
  // Joue tout le tour de l'ordinateur ; renvoie une étape par action (pour l'animation)
  function aiTurn(st, p, viewFor) {
    const steps = [];
    for (let k = 0; k < 30 && !st.over && st.cur === p; k++) {
      const a = aiStep(st, p) || { t: 'end' };
      const ev = act(st, p, a);
      steps.push({ a: a, ev: ev, view: viewFor != null ? view(st, viewFor) : null });
      if (a.t === 'end') break;
    }
    return steps;
  }

  // ---------- Ce qu'un joueur voit ----------
  function minView(st, m, me) {
    return { u: m.u, c: m.c, o: m.o, a: atkOf(st, m), h: hpOf(st, m), mh: maxHpOf(st, m), ba: D(m).a, bh: D(m).h, kw: Object.keys(m.kw).filter(function (k) { return m.kw[k]; }), sil: m.sil,
      can: m.o === me && canAttack(st, m), tg: m.o === me && canAttack(st, m) ? attackTargets(st, m) : null };
  }
  function view(st, p) {
    const me = st.pl[p], fo = st.pl[1 - p], my = st.cur === p && !st.over;
    return {
      me: p, turn: st.turn, mine: my, over: st.over, res: st.res, names: st.names,
      hero: [{ hp: me.hp, max: me.max, mana: me.mana, deck: me.deck.length, fat: me.fat }, { hp: fo.hp, max: fo.max, mana: fo.mana, deck: fo.deck.length, hand: fo.hand.length }],
      board: [me.board.map(function (m) { return minView(st, m, p); }), fo.board.map(function (m) { return minView(st, m, p); })],
      hand: me.hand.map(function (h) {
        const cost = costOf(st, p, h), lt = legalTargets(st, p, h.c);
        return { c: h.c, cost: cost, ok: my && !check(st, p, { t: 'play', h: me.hand.indexOf(h), tgt: lt && lt.length ? lt[0] : undefined }), tg: lt };
      })
    };
  }

  // ---------- Règles de deck ----------
  function deckError(deck, owned) {
    if (!Array.isArray(deck) || deck.length !== DECK_SIZE) return 'Un deck contient exactement ' + DECK_SIZE + ' cartes.';
    const n = {};
    for (const c of deck) {
      const d = DEFS[c]; if (!d || d.t === 'Tok') return 'Carte inconnue.';
      n[c] = (n[c] || 0) + 1;
      const max = d.r === 'L' || d.r === 'S' || d.r === 'G' ? 1 : 2;
      if (n[c] > max) return max === 1 ? 'Une seule copie de chaque légendaire, secrète ou GOAT.' : '2 copies maximum par carte.';
      if (owned && (owned[c] || 0) < n[c]) return 'Tu ne possèdes pas assez d\'exemplaires de certaines cartes.';
    }
    return null;
  }

  root.PVP = { DEFS: DEFS, HERO_HP: HERO_HP, BOARD_MAX: BOARD_MAX, DECK_SIZE: DECK_SIZE, KWN: KWN, newMatch: newMatch, check: check, act: act,
    aiStep: aiStep, aiTurn: aiTurn, view: view, cardText: cardText, deckError: deckError, match: match, legalTargets: legalTargets };
})(typeof window !== 'undefined' ? window : globalThis);

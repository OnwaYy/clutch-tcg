// Moteur de match PvP de Clutch TCG — partagé entre le site et le serveur (même code, mêmes règles).
// Un match : 3 maps, 6 tours, les deux joueurs posent leurs cartes en même temps puis on révèle.
// On gagne une map en y ayant plus de puissance ; on gagne le match avec le plus de points de map.
(function (root) {
  'use strict';
  const DEFS = {}; (root.PVP_CARDS || []).forEach(function (d) { DEFS[d.id] = d; });
  const CLUBS = root.PVP_CLUBS || {};
  const TURNS = 6, SLOTS = 4, HAND_MAX = 7, DECK_SIZE = 20;

  // ---------- Arènes : la règle de chaque map, révélée au fil des tours ----------
  const ARENAS = [
    { id: 'lan', nom: 'LAN de quartier', txt: 'Aucun effet.' },
    { id: 'spodek', nom: 'Spodek — Katowice', txt: 'Les cartes FPS ont +1 ici.', fx: { o: 'all', v: 1, f: 'FPS' } },
    { id: 'lck', nom: 'Studio de la LCK — Séoul', txt: 'Les cartes MOBA ont +1 ici.', fx: { o: 'all', v: 1, f: 'MOBA' } },
    { id: 'scene', nom: 'Scène principale', txt: '3 cartes maximum par joueur ici.', fx: { o: 'cap', n: 3 } },
    { id: 'bootcamp', nom: 'Bootcamp', txt: 'Les cartes jouées ici coûtent 1 de moins.' },
    { id: 'plateau', nom: 'Plateau télé', txt: 'Plus aucune carte ne peut être jouée ici après le tour 4.' },
    { id: 'stade', nom: 'Stade plein', txt: 'Les cartes qui coûtent 4 ou plus ont +2 ici.', fx: { o: 'all', v: 2, f: 'c>=4' } },
    { id: 'presse', nom: 'Salle de presse', txt: 'Quand tu joues une carte ici, pioche une carte.' },
    { id: 'echauffement', nom: 'Zone d\'échauffement', txt: 'Les cartes qui coûtent 1 ou 2 ont +2 ici.', fx: { o: 'all', v: 2, f: 'c<=2' } },
    { id: 'casters', nom: 'Cabine des casters', txt: 'Les effets Révélation se déclenchent deux fois ici.' },
    { id: 'finale', nom: 'Finale à guichets fermés', txt: 'Cette map compte double.' },
    { id: 'solo', nom: 'Coin des solistes', txt: 'Les cartes seules de leur côté ont +3 ici.', fx: { o: 'all', v: 3, f: 'alone' } }
  ];
  const AR = {}; ARENAS.forEach(function (a) { AR[a.id] = a; });

  // ---------- Hasard reproductible (le serveur et le site tirent la même chose) ----------
  function rnd(st) { let t = (st.rng = (st.rng + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  // ---------- Filtres : « CS », « J&CS », « club:Vitality », « c<=2 », « * »… ----------
  const GAMES = ['CS', 'LoL', 'Dota', 'Val', 'CoD', 'RL', 'SC2', 'BW', 'WC3', 'OW', 'FN', 'Quake', 'Halo', 'R6', 'Smash', 'SF', 'FGC'];
  const FAMS = ['FPS', 'MOBA', 'RTS', 'COMBAT', 'SPORT', 'MULTI'];
  const TYPES = ['J', 'Club', 'Mom', 'Jeu', 'Lig', 'Map', 'Evt', 'Lieu', 'Tro', 'Med', 'Cast'];
  function test1(tok, d, card, st) {
    if (tok === '*') return true;
    if (tok === 'alone') return !!(card && st && st.board[card.m][card.o].length === 1);
    if (tok.indexOf('club:') === 0 || tok === 'stream') return d.tags.indexOf(tok) >= 0;
    if (tok.indexOf('c<=') === 0) return d.c <= +tok.slice(3);
    if (tok.indexOf('c>=') === 0) return d.c >= +tok.slice(3);
    if (FAMS.indexOf(tok) >= 0) return d.fam === tok;
    if (GAMES.indexOf(tok) >= 0) return d.g === tok;
    if (TYPES.indexOf(tok) >= 0) return d.t === tok;
    return false;
  }
  function match(f, cid, card, st) { const d = DEFS[cid]; return !!d && String(f).split('&').every(function (t) { return test1(t, d, card, st); }); }

  // ---------- Textes des effets (générés depuis les données : toujours fidèles aux règles) ----------
  const GNAME = { CS: 'Counter-Strike', LoL: 'LoL', Dota: 'Dota 2', Val: 'Valorant', CoD: 'Call of Duty', RL: 'Rocket League', SC2: 'StarCraft II', BW: 'Brood War', WC3: 'Warcraft III', OW: 'Overwatch', FN: 'Fortnite', Quake: 'Quake', Halo: 'Halo', R6: 'Rainbow Six', Smash: 'Smash', SF: 'Street Fighter', FGC: 'jeux de combat' };
  const FNAME = { FPS: 'FPS', MOBA: 'MOBA', RTS: 'de stratégie', COMBAT: 'de jeux de combat', SPORT: 'Rocket League', MULTI: 'multi-jeux' };
  function fLabel(f, one) {
    const toks = String(f).split('&'); let noun = one ? 'carte' : 'cartes'; const q = [];
    toks.forEach(function (t) {
      if (t === 'J') noun = one ? 'joueur' : 'joueurs';
      else if (t === 'stream') noun = one ? 'streamer' : 'streamers';
      else if (t === '*') {}
      else if (t.indexOf('club:') === 0) q.push(CLUBS[t.slice(5)] || t.slice(5));
      else if (GNAME[t]) q.push(noun === 'cartes' || noun === 'carte' ? GNAME[t] : 'de ' + GNAME[t]);
      else if (FNAME[t]) q.push(FNAME[t]);
      else if (t.indexOf('c<=') === 0) q.push('qui ' + (one ? 'coûte ' : 'coûtent ') + t.slice(3) + ' ou moins');
      else if (t.indexOf('c>=') === 0) q.push('qui ' + (one ? 'coûte ' : 'coûtent ') + t.slice(3) + ' ou plus');
      else if (t === 'alone') q.push(one ? 'seule de son côté' : 'seules de leur côté');
    });
    return (noun + ' ' + q.join(' ')).trim();
  }
  const sg = function (v) { return (v > 0 ? '+' : '−') + Math.abs(v); };
  const AT = function (at) { return at === 'all' ? 'en jeu' : 'ici'; };
  function condText(c) {
    if (!c) return '';
    if (c.alone) return 'tu n\'as aucune autre carte ici';
    if (c.duel) return 'il n\'y a qu\'une seule carte adverse ici';
    if (c.losing) return 'tu perds cette map';
    if (c.late) return 'elle est jouée au tour 5 ou 6';
    if (c.min) return 'tu as ' + (c.min[1] > 1 ? c.min[1] + ' autres ' + fLabel(c.min[0]) : 'un(e) autre ' + fLabel(c.min[0], true)) + ' ' + AT(c.min[2]);
    if (c.duo) return 'tu as aussi ' + (root.PVP_NAMES ? root.PVP_NAMES[c.duo] : '#' + c.duo) + ' en jeu';
    return '';
  }
  function fxText(e) {
    const k = { rev: 'Révélation', cont: 'Continu', ter: 'Terrain', turn: 'Fin de tour' }[e.k];
    let t;
    switch (e.o) {
      case 'pow': t = e.k === 'cont' ? sg(e.v) + ' tant que ' + condText(e.if) + '.' : sg(e.v) + (e.if ? ' si ' + condText(e.if) : '') + '.'; break;
      case 'per': t = sg(e.v) + ' pour chaque autre ' + fLabel(e.f, true) + ' que tu as ' + AT(e.at) + '.'; break;
      case 'perEnemy': t = sg(e.v) + ' pour chaque carte adverse ici.'; break;
      case 'aura': t = e.k === 'cont' ? 'tes autres ' + fLabel(e.f) + ' ont ' + sg(e.v) + ' ' + (e.at === 'all' ? 'partout' : 'ici') + '.' : 'tes autres ' + fLabel(e.f) + ' ' + AT(e.at) + ' gagnent ' + sg(e.v) + '.'; break;
      case 'all': t = 'les ' + fLabel(e.f) + ' ont ' + sg(e.v) + ' ici, pour les deux joueurs.'; break;
      case 'cap': t = e.n + ' cartes maximum par joueur ici.'; break;
      case 'draw': t = 'pioche ' + (e.n > 1 ? e.n + ' ' + fLabel(e.f) : (e.f === '*' ? 'une carte' : 'un(e) ' + fLabel(e.f, true))) + ' de ton deck.'; break;
      case 'cost': t = 'tes ' + fLabel(e.f) + ' en main coûtent ' + e.v + ' de moins.'; break;
      case 'nrg': t = '+' + e.n + ' énergie au prochain tour.'; break;
      case 'lock': t = 'plus aucune carte ne peut être jouée ici.'; break;
      case 'mute': t = 'annule les effets Continu et Terrain des cartes adverses ici.'; break;
      case 'swing': t = 'si tu perds cette map, tes autres cartes ici gagnent ' + sg(e.v) + '.'; break;
      case 'rerev': t = 'relance les effets Révélation de tes autres cartes ici.'; break;
      case 'hit': t = 'les cartes adverses ' + AT(e.at) + ' perdent ' + e.v + '.'; break;
      case 'hitTop': t = 'la carte adverse la plus forte ici perd ' + e.v + '.'; break;
      case 'hitLow': t = 'la carte adverse la plus faible ici perd ' + e.v + '.'; break;
      case 'auraWin': t = 'tes cartes gagnent ' + sg(e.v) + ' sur chaque map que tu remportes.'; break;
      case 'dbl': t = 'cette map compte double.'; break;
      case 'shield': t = 'ne peut pas perdre de puissance.'; break;
      case 'grow': t = sg(e.v) + ' à cette carte.'; break;
      default: t = '';
    }
    return { kw: k, txt: t.charAt(0).toUpperCase() + t.slice(1) };
  }
  function cardText(cid) { const d = DEFS[cid]; return d ? d.fx.map(fxText) : []; }

  // ---------- Création d'un match ----------
  function newMatch(deckA, deckB, opts) {
    opts = opts || {};
    const st = { v: 1, turn: 1, rng: (opts.seed >>> 0) || 1, n: 0, over: false, res: null, locked: [0, 0, 0], log: [],
      names: opts.names || ['Toi', 'Adversaire'], board: [[[], []], [[], []], [[], []]], arenas: [], pl: [] };
    const pool = ARENAS.slice(); shuffle(st, pool);
    st.arenas = pool.slice(0, 3).map(function (a) { return a.id; });
    [deckA, deckB].forEach(function (deck, p) {
      const pl = { deck: shuffle(st, deck.slice()), hand: [], nrg: 0 };
      st.pl[p] = pl;
      for (let i = 0; i < 3; i++) draw(st, p, '*');
    });
    startTurn(st);
    return st;
  }
  function draw(st, p, f) {
    const pl = st.pl[p]; if (pl.hand.length >= HAND_MAX) return false;
    const i = pl.deck.findIndex(function (c) { return match(f, c); });
    if (i < 0) return false;
    pl.hand.push({ c: pl.deck.splice(i, 1)[0], m: 0 }); return true;
  }
  function startTurn(st) { for (let p = 0; p < 2; p++) draw(st, p, '*'); }
  const revealed = function (st, m) { return m < Math.min(st.turn, 3) || st.over; };
  const arenaAt = function (st, m) { return revealed(st, m) ? st.arenas[m] : null; };
  function energy(st, p) { return Math.min(st.turn, TURNS) + (st.pl[p].nrgNow || 0); }

  // ---------- Puissance ----------
  function capOf(st, m) {
    let cap = SLOTS; if (arenaAt(st, m) === 'scene') cap = 3;
    for (let p = 0; p < 2; p++) st.board[m][p].forEach(function (c) { if (!c.mute) DEFS[c.c].fx.forEach(function (e) { if (e.k === 'ter' && e.o === 'cap') cap = Math.min(cap, e.n); }); });
    return cap;
  }
  function others(st, card, f, at) {
    let n = 0;
    for (let m = 0; m < 3; m++) { if (at !== 'all' && m !== card.m) continue; st.board[m][card.o].forEach(function (x) { if (x !== card && match(f, x.c, x, st)) n++; }); }
    return n;
  }
  function cond(st, card, c, depth) {
    if (!c) return true;
    if (c.alone) return st.board[card.m][card.o].length === 1;
    if (c.duel) return st.board[card.m][1 - card.o].length === 1;
    if (c.late) return card.t >= 5;
    if (c.losing) return depth > 1 ? false : mapPower(st, card.m, card.o, depth + 1) < mapPower(st, card.m, 1 - card.o, depth + 1);
    if (c.min) return others(st, card, c.min[0], c.min[2]) >= c.min[1];
    if (c.duo) { for (let m = 0; m < 3; m++) if (st.board[m][card.o].some(function (x) { return x.c === c.duo; })) return true; return false; }
    return true;
  }
  function hasShield(card) { return !card.mute && DEFS[card.c].fx.some(function (e) { return e.o === 'shield'; }); }
  function cardPower(st, card, depth) {
    depth = depth || 0;
    const d = DEFS[card.c]; let pos = d.p + card.perm, neg = card.neg;
    if (!card.mute) d.fx.forEach(function (e) {
      if (e.k !== 'cont') return;
      if (e.o === 'pow' && cond(st, card, e.if, depth)) pos += e.v;
      else if (e.o === 'per') pos += e.v * others(st, card, e.f, e.at);
      else if (e.o === 'perEnemy') pos += e.v * st.board[card.m][1 - card.o].length;
    });
    // auras de mes autres cartes
    for (let m = 0; m < 3; m++) st.board[m][card.o].forEach(function (x) {
      if (x === card || x.mute) return;
      DEFS[x.c].fx.forEach(function (e) { if (e.k === 'cont' && e.o === 'aura' && (e.at === 'all' || m === card.m) && match(e.f, card.c, card, st)) pos += e.v; });
    });
    // terrains de cette map (des deux joueurs) et arène
    for (let p = 0; p < 2; p++) st.board[card.m][p].forEach(function (x) {
      if (x.mute) return;
      DEFS[x.c].fx.forEach(function (e) { if (e.k === 'ter' && e.o === 'all' && match(e.f, card.c, card, st)) { if (e.v > 0) pos += e.v; else neg -= e.v; } });
    });
    const a = AR[arenaAt(st, card.m)];
    if (a && a.fx && a.fx.o === 'all' && match(a.fx.f, card.c, card, st)) pos += a.fx.v;
    return Math.max(0, pos - (hasShield(card) ? 0 : neg));
  }
  function mapPower(st, m, p, depth) { return st.board[m][p].reduce(function (s, c) { return s + cardPower(st, c, depth); }, 0); }
  function mapWorth(st, m) {
    if (arenaAt(st, m) === 'finale') return 2;
    for (let p = 0; p < 2; p++) if (st.board[m][p].some(function (c) { return !c.mute && DEFS[c.c].fx.some(function (e) { return e.o === 'dbl'; }); })) return 2;
    return 1;
  }
  function score(st) {
    const maps = [0, 1, 2].map(function (m) { const a = mapPower(st, m, 0), b = mapPower(st, m, 1); return { a: a, b: b, w: a > b ? 0 : b > a ? 1 : -1, pts: mapWorth(st, m) }; });
    const pts = [0, 0]; maps.forEach(function (x) { if (x.w >= 0) pts[x.w] += x.pts; });
    return { maps: maps, pts: pts, tot: [maps.reduce(function (s, x) { return s + x.a; }, 0), maps.reduce(function (s, x) { return s + x.b; }, 0)] };
  }

  // ---------- Coûts et validité d'un coup ----------
  function costOf(st, p, h, m) { return Math.max(0, DEFS[h.c].c - h.m - (arenaAt(st, m) === 'bootcamp' ? 1 : 0)); }
  // plays : [{ h: index dans la main, m: map }]
  function check(st, p, plays) {
    if (st.over) return 'Le match est terminé.';
    if (!Array.isArray(plays)) return 'Coup invalide.';
    const used = {}, per = [0, 0, 0]; let spent = 0;
    for (const pl of plays) {
      const h = st.pl[p].hand[pl.h];
      if (!h || used[pl.h] || !(pl.m >= 0 && pl.m <= 2)) return 'Coup invalide.';
      used[pl.h] = 1;
      if (st.locked[pl.m]) return 'Cette map est verrouillée.';
      if (arenaAt(st, pl.m) === 'plateau' && st.turn > 4) return 'Plus aucune carte ne peut être jouée sur le plateau télé.';
      per[pl.m]++;
      if (st.board[pl.m][p].length + per[pl.m] > capOf(st, pl.m)) return 'Plus de place sur cette map.';
      spent += costOf(st, p, h, pl.m);
    }
    if (spent > energy(st, p)) return 'Pas assez d\'énergie.';
    return null;
  }

  // ---------- Effets à la révélation ----------
  function runRev(st, card, ev, skipRerev) {
    const d = DEFS[card.c], times = arenaAt(st, card.m) === 'casters' ? 2 : 1;
    for (let k = 0; k < times; k++) d.fx.forEach(function (e) {
      if (e.k !== 'rev') return;
      const me = card.o, foe = 1 - me, here = st.board[card.m];
      const mine = function (at) { const r = []; for (let m = 0; m < 3; m++) if (at === 'all' || m === card.m) st.board[m][me].forEach(function (x) { if (x !== card) r.push(x); }); return r; };
      const hurt = function (x, v) { if (!hasShield(x)) { x.neg += v; ev.push({ t: 'hit', u: x.u, v: v }); } };
      switch (e.o) {
        case 'pow': if (cond(st, card, e.if, 0)) { card.perm += e.v; ev.push({ t: 'buff', u: card.u, v: e.v }); } break;
        case 'per': { const v = e.v * others(st, card, e.f, e.at); if (v) { card.perm += v; ev.push({ t: 'buff', u: card.u, v: v }); } break; }
        case 'perEnemy': { const v = e.v * here[foe].length; if (v) { card.perm += v; ev.push({ t: 'buff', u: card.u, v: v }); } break; }
        case 'aura': mine(e.at).forEach(function (x) { if (match(e.f, x.c, x, st)) { x.perm += e.v; ev.push({ t: 'buff', u: x.u, v: e.v }); } }); break;
        case 'auraWin': for (let m = 0; m < 3; m++) if (mapPower(st, m, me) > mapPower(st, m, foe)) st.board[m][me].forEach(function (x) { x.perm += e.v; ev.push({ t: 'buff', u: x.u, v: e.v }); }); break;
        case 'swing': if (mapPower(st, card.m, me) < mapPower(st, card.m, foe)) here[me].forEach(function (x) { if (x !== card) { x.perm += e.v; ev.push({ t: 'buff', u: x.u, v: e.v }); } }); break;
        case 'hit': for (let m = 0; m < 3; m++) if (e.at === 'all' || m === card.m) st.board[m][foe].forEach(function (x) { if (match(e.f, x.c, x, st)) hurt(x, e.v); }); break;
        case 'hitTop': case 'hitLow': {
          let best = null, bp = 0;
          here[foe].forEach(function (x) { const pw = cardPower(st, x); if (!best || (e.o === 'hitTop' ? pw >= bp : pw < bp)) { best = x; bp = pw; } });
          if (best) hurt(best, e.v); break;
        }
        case 'draw': { let n = 0; for (let i = 0; i < e.n; i++) if (draw(st, me, e.f)) n++; if (n) ev.push({ t: 'draw', p: me, n: n }); break; }
        case 'cost': st.pl[me].hand.forEach(function (h) { if (match(e.f, h.c)) h.m += e.v; }); ev.push({ t: 'cost', p: me }); break;
        case 'nrg': st.pl[me].nrg += e.n; ev.push({ t: 'nrg', p: me, n: e.n }); break;
        case 'lock': st.locked[card.m] = 1; ev.push({ t: 'lock', m: card.m }); break;
        case 'mute': here[foe].forEach(function (x) { x.mute = 1; ev.push({ t: 'mute', u: x.u }); }); break;
        case 'rerev': if (!skipRerev) here[me].forEach(function (x) { if (x !== card) runRev(st, x, ev, true); }); break;
      }
    });
  }

  // ---------- Résolution d'un tour ----------
  function playTurn(st, plays0, plays1) {
    const P = [plays0 || [], plays1 || []];
    for (let p = 0; p < 2; p++) { const err = check(st, p, P[p]); if (err) throw new Error(err); }
    const ev = [], sc = score(st);
    const first = sc.pts[0] > sc.pts[1] ? 0 : sc.pts[1] > sc.pts[0] ? 1 : (rnd(st) < .5 ? 0 : 1);
    // on retire les cartes jouées des mains (indices décroissants)
    const out = [[], []];
    for (let p = 0; p < 2; p++) {
      const hand = st.pl[p].hand;
      out[p] = P[p].map(function (x) { return { h: hand[x.h], m: x.m }; });
      P[p].map(function (x) { return x.h; }).sort(function (a, b) { return b - a; }).forEach(function (i) { hand.splice(i, 1); });
    }
    ev.push({ t: 'order', first: first });
    [first, 1 - first].forEach(function (p) {
      out[p].forEach(function (x) {
        const m = x.m;
        if (st.locked[m] || st.board[m][p].length >= capOf(st, m)) {    // la map s'est fermée entre-temps : la carte revient en main
          if (st.pl[p].hand.length < HAND_MAX) st.pl[p].hand.push({ c: x.h.c, m: 0 });
          ev.push({ t: 'bounce', p: p, c: x.h.c, m: m }); return;
        }
        const card = { u: ++st.n, c: x.h.c, o: p, m: m, perm: 0, neg: 0, t: st.turn, mute: 0 };
        st.board[m][p].push(card);
        const e2 = [];
        runRev(st, card, e2);
        if (arenaAt(st, m) === 'presse' && draw(st, p, '*')) e2.push({ t: 'draw', p: p, n: 1 });
        ev.push({ t: 'rev', p: p, u: card.u, c: card.c, m: m, fx: e2, pw: [0, 1, 2].map(function (k) { return [mapPower(st, k, 0), mapPower(st, k, 1)]; }) });
      });
    });
    // fin du tour : cartes qui grandissent
    for (let m = 0; m < 3; m++) for (let p = 0; p < 2; p++) st.board[m][p].forEach(function (c) {
      if (!c.mute) DEFS[c.c].fx.forEach(function (e) { if (e.k === 'turn' && e.o === 'grow') { c.perm += e.v; ev.push({ t: 'grow', u: c.u, v: e.v }); } });
    });
    for (let p = 0; p < 2; p++) { st.pl[p].nrgNow = st.pl[p].nrg; st.pl[p].nrg = 0; }
    st.turn++;
    if (st.turn > TURNS) {
      st.over = true; const s = score(st);
      st.res = { pts: s.pts, tot: s.tot, maps: s.maps, w: s.pts[0] > s.pts[1] ? 0 : s.pts[1] > s.pts[0] ? 1 : s.tot[0] > s.tot[1] ? 0 : s.tot[1] > s.tot[0] ? 1 : -1 };
      ev.push({ t: 'end', res: st.res });
    } else {
      if (st.turn <= 3) ev.push({ t: 'arena', m: st.turn - 1, a: st.arenas[st.turn - 1] });
      startTurn(st);
    }
    st.log.push(ev);
    return ev;
  }

  // ---------- Adversaire joué par l'ordinateur ----------
  function clone(st) { const l = st.log; st.log = []; const c = JSON.parse(JSON.stringify(st)); st.log = l; return c; }
  function evalFor(st, p) {
    let s = 0;
    for (let m = 0; m < 3; m++) {
      const diff = mapPower(st, m, p) - mapPower(st, m, 1 - p);
      s += mapWorth(st, m) * Math.tanh(diff / 6);
    }
    return s;
  }
  function aiPlays(st, p, level) {
    const plan = [], usedH = {}, per = [0, 0, 0];
    let nrg = energy(st, p);
    const sim = clone(st);
    for (let iter = 0; iter < 6; iter++) {
      const base = evalFor(sim, p);
      let best = null;
      st.pl[p].hand.forEach(function (h, i) {
        if (usedH[i]) return;
        for (let m = 0; m < 3; m++) {
          if (st.locked[m] || sim.locked[m] || (arenaAt(st, m) === 'plateau' && st.turn > 4)) continue;
          if (sim.board[m][p].length + 1 > capOf(sim, m)) continue;
          const cost = costOf(st, p, h, m); if (cost > nrg) continue;
          const s2 = clone(sim);
          const card = { u: ++s2.n, c: h.c, o: p, m: m, perm: 0, neg: 0, t: s2.turn, mute: 0 };
          s2.board[m][p].push(card); runRev(s2, card, []);
          // on anticipe la croissance et on valorise l'énergie bien dépensée
          let val = evalFor(s2, p) - base + cost * .015 + (DEFS[h.c].fx.some(function (e) { return e.o === 'grow'; }) ? (TURNS - st.turn) * .05 : 0);
          if (level !== 'dur') val += (rnd(st) - .5) * .04;
          if (!best || val > best.val) best = { val: val, i: i, m: m, cost: cost, s2: s2 };
        }
      });
      if (!best || best.val <= 0.001) break;
      plan.push({ h: best.i, m: best.m }); usedH[best.i] = 1; per[best.m]++; nrg -= best.cost;
      Object.assign(sim, best.s2);
    }
    return check(st, p, plan) ? [] : plan;
  }

  // ---------- Ce qu'un joueur a le droit de voir ----------
  function view(st, p) {
    const sc = score(st);
    return {
      turn: Math.min(st.turn, TURNS), over: st.over, res: st.res, me: p, names: st.names,
      arenas: [0, 1, 2].map(function (m) { const a = arenaAt(st, m); return a ? { id: a, nom: AR[a].nom, txt: AR[a].txt } : null; }),
      locked: st.locked.slice(), worth: [0, 1, 2].map(function (m) { return mapWorth(st, m); }), caps: [0, 1, 2].map(function (m) { return capOf(st, m); }),
      board: st.board.map(function (sides, m) { return sides.map(function (cards) { return cards.map(function (c) { return { u: c.u, c: c.c, o: c.o, pw: cardPower(st, c), mute: c.mute, t: c.t }; }); }); }),
      pw: sc.maps.map(function (x) { return [x.a, x.b]; }), pts: sc.pts,
      hand: st.pl[p].hand.map(function (h) { return { c: h.c, m: h.m }; }), deck: st.pl[p].deck.length,
      foeHand: st.pl[1 - p].hand.length, foeDeck: st.pl[1 - p].deck.length,
      energy: st.over ? 0 : energy(st, p), bootcamp: [0, 1, 2].map(function (m) { return arenaAt(st, m) === 'bootcamp'; }),
      plateau: [0, 1, 2].map(function (m) { return arenaAt(st, m) === 'plateau' && st.turn > 4; })
    };
  }

  // ---------- Règles de deck ----------
  function deckError(deck, owned) {
    if (!Array.isArray(deck) || deck.length !== DECK_SIZE) return 'Un deck contient exactement ' + DECK_SIZE + ' cartes.';
    const n = {};
    for (const c of deck) {
      const d = DEFS[c]; if (!d) return 'Carte inconnue.';
      n[c] = (n[c] || 0) + 1;
      const max = d.r === 'L' || d.r === 'S' || d.r === 'G' ? 1 : 2;
      if (n[c] > max) return max === 1 ? 'Une seule copie de chaque légendaire, secrète ou GOAT.' : '2 copies maximum par carte.';
      if (owned && (owned[c] || 0) < n[c]) return 'Tu ne possèdes pas assez d\'exemplaires de certaines cartes.';
    }
    return null;
  }

  root.PVP = { DEFS: DEFS, ARENAS: ARENAS, AR: AR, TURNS: TURNS, SLOTS: SLOTS, DECK_SIZE: DECK_SIZE, newMatch: newMatch, check: check, playTurn: playTurn,
    aiPlays: aiPlays, view: view, score: score, cardPower: cardPower, mapPower: mapPower, costOf: costOf, cardText: cardText, fxText: fxText,
    deckError: deckError, match: match, fLabel: fLabel };
})(typeof window !== 'undefined' ? window : globalThis);

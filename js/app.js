(function () {
  'use strict';
  // =====================================================================
  // Données de la série
  // =====================================================================
  const SETS = [
    { id: 'ori', code: 'ORI', name: 'Origines', edition: 'Édition 1', desc: 'Les grands moments de l\'histoire de l\'e-sport', games: 'Tous les jeux', size: 150, secret: 25, status: 'on', note: 'Série de base', c: '#f2c25b', p: ['#2b1d5e', '#4b2a8c', '#1a1238'], edge: ['#f2c25b', '#8c6420'] }
  ];
  const STATUS = { on: 'Disponible', soon: 'Bientôt', off: 'Terminée' };
  const RAR = [
    { id: 'common', name: 'Commune', color: 'var(--c-common)', pts: 1, odds: '50 %', note: 'Clubs, ligues, maps, joueurs' },
    { id: 'uncommon', name: 'Peu commune', color: 'var(--c-uncommon)', pts: 2, odds: '30 %', note: 'Jeux, grands clubs, lieux' },
    { id: 'epic', name: 'Épique', color: 'var(--c-epic)', pts: 10, odds: '15 %', note: 'Stars et grands rendez-vous' },
    { id: 'legend', name: 'Légendaire', color: 'var(--c-legend)', pts: 50, odds: '4,5 %', note: 'Moments historiques' },
    { id: 'secret', name: 'Secrète', color: 'var(--c-secret)', pts: 100, odds: '0,49 %', note: 'Hors numérotation, 151 à 175' },
    { id: 'goat', name: 'GOAT', color: 'var(--c-goat)', pts: 500, odds: '0,01 %', note: 'Les plus grands de l\'histoire' }
  ];
  const RORDER = { common: 0, uncommon: 1, epic: 2, legend: 3, secret: 4, goat: 5 };
  const RCODE = { C: 'common', P: 'uncommon', E: 'epic', L: 'legend', S: 'secret', G: 'goat' };
  // Chaque carte a un identifiant : 1 à 175 dans l'ordre de la série, puis les GOAT (176, 177…)
  let goatN = 0;
  const ORI_ALL = window.ORIGINES ? window.ORIGINES.cards.concat(window.ORIGINES.goat || []) : [];
  const CATALOG = ORI_ALL.map(function (c, i) {
    const art = (window.ORIGINES.art || {})[c[0]] || {};
    return { id: i + 1, set: 'ori', num: c[1] === 'G' ? 'GOAT' + (++goatN > 1 ? goatN : '') : i + 1, rarity: RCODE[c[1]], name: c[0], type: c[2], game: c[3], year: c[4], note: c[5], img: art.img || null, color: art.color || null, dark: !!art.dark, map: !!art.map, fade: !!art.fade, player: !!art.player, photo: !!art.photo };
  });
  const BY_ID = {}; CATALOG.forEach(function (c) { BY_ID[c.id] = c; });
  const NAME_OK = /^[A-Za-z0-9_.-]{3,16}$/;

  // =====================================================================
  // Outils
  // =====================================================================
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  const fmt = function (n) { return Number(n || 0).toLocaleString('fr-FR'); };
  const esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  const initials = function (n) { n = n || '?'; const p = n.trim().split(/[\s_.-]+/).filter(Boolean); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : (p[0] || '')[1] || '')).toUpperCase(); };
  const setById = function (id) { return SETS.find(function (s) { return s.id === id; }); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const pad = function (n) { return String(n).padStart(2, '0'); };
  function countdown(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); }

  const toastEl = $('#toast');
  function toast(msg, err) {
    toastEl.textContent = msg; toastEl.classList.toggle('err', !!err); toastEl.classList.add('show');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
  }
  function bump(id) { const el = $(id); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function packHTML(s, mini) {
    return '<div class="pack' + (mini ? ' mini' : '') + (s.status === 'off' ? ' off' : '') + '" aria-label="Booster ' + esc(s.name) + '"><i class="pk-body"></i><i class="pk-top"></i><i class="pk-shine"></i></div>';
  }
  function gainHTML(p, b) {
    return (p ? '<span class="gain"><i class="coin"></i>+' + fmt(p) + '</span>' : '') + (b ? '<span class="gain"><i class="pk"></i>+' + b + ' booster' + (b > 1 ? 's' : '') + '</span>' : '');
  }

  // =====================================================================
  // Serveur : Supabase si branché, sinon mode démo dans le navigateur
  // =====================================================================
  const CFG = window.CLUTCH_CONFIG || {};
  const ONLINE = !!(CFG.url && CFG.cle && window.supabase);
  const sb = ONLINE ? window.supabase.createClient(CFG.url, CFG.cle, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;
  const SITE = location.origin + location.pathname;

  // Mode démo : reproduit les règles du serveur, sans sécurité (sert seulement à tester le site)
  const DEMO = (function () {
    const K = 'clutch-demo-v3';
    const W = [0, 1, 2, 3, 4], WP = [10, 40, 30, 15, 5];
    const CH = { common: 50000, uncommon: 30000, epic: 15000, legend: 4500, secret: 490, goat: 10 };
    const QS = [['ouvrir3', 'Ouvrir 3 boosters', 3, 60, 0], ['gratuit2', 'Récupérer 2 boosters gratuits', 2, 0, 1], ['roue', 'Tourner la roue', 1, 30, 0], ['epique', 'Obtenir une carte épique ou mieux', 1, 80, 0], ['ouvrir10', 'Ouvrir 10 boosters', 10, 0, 2]];
    const RW = [['ori:common', 'Toutes les communes', 'common', 0, 2], ['ori:uncommon', 'Toutes les peu communes', 'uncommon', 0, 3], ['ori:epic', 'Toutes les épiques', 'epic', 500, 5], ['ori:legend', 'Toutes les légendaires', 'legend', 1000, 10], ['ori:secret', 'Toutes les secrètes', 'secret', 2000, 10], ['ori:all', 'Série Origines complète', null, 5000, 20]];
    function load() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
    function save(d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} }
    function day() { return new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); }
    function me() { const d = load(); if (!d) throw new Error('Connecte-toi pour jouer.'); if (d.qday !== day()) { d.qday = day(); d.q = {}; } return d; }
    function pick(w) { const t = Object.values(w).reduce(function (a, b) { return a + b; }, 0); let r = Math.floor(Math.random() * t); for (const k of Object.keys(w).sort(function (a, b) { return w[b] - w[a]; })) { if (r < w[k]) return k; r -= w[k]; } return 'common'; }
    function quest(d, id, n) { d.q[id] = d.q[id] || { p: 0, ok: false }; d.q[id].p += n; }
    function owned(d, rar) { return CATALOG.filter(function (c) { return c.rarity !== 'goat' && (!rar || c.rarity === rar); }).filter(function (c) { return d.col[c.id]; }).length; }
    function total(rar) { return CATALOG.filter(function (c) { return c.rarity !== 'goat' && (!rar || c.rarity === rar); }).length; }
    const api = {
      user: function () { const d = load(); return d ? { email: d.email } : null; },
      signup: function (email, pwd, pseudo) { save({ email: email, pseudo: pseudo, pieces: 300, boosters: 3, ouverts: 0, achetes: 0, depense: 0, cree: new Date().toISOString(), col: {}, lastFree: null, lastWheel: null, q: {}, qday: day(), rw: {} }); },
      logout: function () { try { localStorage.removeItem(K); } catch (e) {} },
      mon_etat: function () {
        const d = me(); save(d); const now = Date.now();
        return { pseudo: d.pseudo, pieces: d.pieces, boosters: d.boosters, ouverts: d.ouverts, achetes: d.achetes, depense: d.depense, cree_le: d.cree, maintenant: new Date(now).toISOString(),
          prochain_gratuit: new Date(d.lastFree ? d.lastFree + 3600e3 : now - 1000).toISOString(), prochaine_roue: new Date(d.lastWheel ? d.lastWheel + 86400e3 : now - 1000).toISOString(),
          prix: { un: 200, cinq: 900 }, collection: d.col,
          quetes: QS.map(function (q) { const st = d.q[q[0]] || { p: 0, ok: false }; return { id: q[0], nom: q[1], objectif: q[2], pieces: q[3], boosters: q[4], progres: Math.min(st.p, q[2]), recuperee: st.ok }; }),
          recompenses: RW.map(function (r) { return { id: r[0], nom: r[1], rarete: r[2], pieces: r[3], boosters: r[4], total: total(r[2]), possede: owned(d, r[2]), recuperee: !!d.rw[r[0]] }; }) };
      },
      choisir_pseudo: function (a) { const d = me(); if (!NAME_OK.test(a.p)) throw new Error('Le pseudo doit faire 3 à 16 caractères : lettres, chiffres, point, _ ou -.'); d.pseudo = a.p; save(d); return a.p; },
      acheter_boosters: function (a) { const d = me(), prix = a.quantite === 5 ? 900 : 200; if (d.pieces < prix) throw new Error('Pas assez de pièces.'); d.pieces -= prix; d.boosters += a.quantite; d.achetes += a.quantite; d.depense += prix; save(d); return {}; },
      recuperer_gratuit: function () { const d = me(); if (d.lastFree && Date.now() - d.lastFree < 3600e3) throw new Error('Le booster gratuit n\'est pas encore prêt.'); d.lastFree = Date.now(); d.boosters++; quest(d, 'gratuit2', 1); save(d); return {}; },
      tourner_roue: function () { const d = me(); if (d.lastWheel && Date.now() - d.lastWheel < 86400e3) throw new Error('La roue n\'est pas encore prête.'); let r = Math.floor(Math.random() * 100), i = 0; while (r >= WP[i]) { r -= WP[i]; i++; } d.lastWheel = Date.now(); d.boosters += W[i]; quest(d, 'roue', 1); save(d); return { gagne: W[i], case: i }; },
      ouvrir_booster: function () {
        const d = me(); if (d.boosters < 1) throw new Error('Tu n\'as plus de booster à ouvrir.');
        d.boosters--; d.ouverts++; const cartes = [], nouvelles = []; let score = 0, best = false;
        for (let i = 1; i <= 5; i++) {
          const rar = pick(CH), pool = CATALOG.filter(function (c) { return c.rarity === rar; }), c = pool[Math.floor(Math.random() * pool.length)];
          cartes.push(c.id); if (!d.col[c.id] && nouvelles.indexOf(c.id) < 0) nouvelles.push(c.id); d.col[c.id] = (d.col[c.id] || 0) + 1;
          score += RAR.find(function (r) { return r.id === rar; }).pts; if (RORDER[rar] >= 2) best = true;
        }
        d.pieces += score; quest(d, 'ouvrir3', 1); quest(d, 'ouvrir10', 1); if (best) quest(d, 'epique', 1); save(d);
        return { cartes: cartes, nouvelles: nouvelles, score: score };
      },
      recuperer_quete: function (a) { const d = me(), q = QS.find(function (x) { return x[0] === a.q; }), st = d.q[a.q]; if (!q || !st || st.ok || st.p < q[2]) throw new Error('Quête pas encore terminée ou déjà récupérée.'); st.ok = true; d.pieces += q[3]; d.boosters += q[4]; save(d); return { pieces: q[3], boosters: q[4] }; },
      recuperer_recompense: function (a) { const d = me(), r = RW.find(function (x) { return x[0] === a.r; }); if (!r) throw new Error('Récompense inconnue.'); const m = total(r[2]) - owned(d, r[2]); if (m > 0) throw new Error('Il te manque encore ' + m + ' carte(s).'); if (d.rw[a.r]) throw new Error('Récompense déjà récupérée.'); d.rw[a.r] = 1; d.pieces += r[3]; d.boosters += r[4]; save(d); return { pieces: r[3], boosters: r[4] }; },
      classement: function () { const d = load(); if (!d) return []; let sc = 0, lg = 0, n = 0; Object.keys(d.col).forEach(function (id) { const c = BY_ID[id]; if (!c) return; n++; sc += RAR.find(function (r) { return r.id === c.rarity; }).pts; if (RORDER[c.rarity] >= 3) lg++; }); return [{ pseudo: d.pseudo, score: sc, legendaires: lg, cartes: n }]; },
      pseudo_libre: function (a) { return NAME_OK.test(a.p); },
      suis_testeur: function () { return !!load(); },
      test_boosters: function (a) { const d = me(); d.boosters += a.n; save(d); return d.boosters; }
    };
    return api;
  })();

  // Appel d'une fonction du serveur
  async function rpc(fn, args) {
    if (!ONLINE) { await sleep(120); return DEMO[fn](args || {}); }
    const r = await sb.rpc(fn, args || {});
    if (r.error) throw new Error(cleanError(r.error.message));
    return r.data;
  }
  function cleanError(m) {
    m = String(m || 'Erreur inconnue.');
    if (/JWT|token|not authenticated|Connecte-toi/i.test(m)) return 'Ta session a expiré, reconnecte-toi.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion au serveur impossible. Vérifie ta connexion internet.';
    return m;
  }
  function authError(e) {
    const m = String((e && e.message) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Confirme d\'abord ton e-mail avec le lien reçu.';
    if (/already registered|already been registered|User already/i.test(m)) return 'Un compte existe déjà avec cet e-mail.';
    if (/Password should be|password.*characters/i.test(m)) return 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
    if (/valid email|invalid email|Unable to validate email/i.test(m)) return 'Adresse e-mail invalide.';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Cette méthode de connexion n\'est pas encore activée.';
    return cleanError(m);
  }

  // =====================================================================
  // État du joueur
  // =====================================================================
  let USER = null;      // { email } quand connecté
  let S = null;         // état renvoyé par le serveur (mon_etat)
  let skew = 0;         // décalage entre l'horloge du serveur et celle du navigateur
  const now = function () { return Date.now() + skew; };
  const owns = function (id) { return !!(S && S.collection && S.collection[id]); };
  const ownedCount = function () { return S ? Object.keys(S.collection || {}).length : 0; };
  function collScore() { let s = 0; if (S) Object.keys(S.collection || {}).forEach(function (id) { const c = BY_ID[id]; if (c) s += RAR.find(function (r) { return r.id === c.rarity; }).pts; }); return s; }

  async function refresh() {
    if (!USER) { S = null; renderAll(); return; }
    try {
      S = await rpc('mon_etat');
      skew = Date.parse(S.maintenant) - Date.now();
      if (!S.pseudo) openModal('#pseudoModal');
    } catch (e) { toast(e.message, true); }
    renderAll();
  }

  const n3 = function (n) { return String(n).padStart(3, '0'); };
  const numText = function (c) { return c.rarity === 'goat' ? 'GOAT' : n3(c.num) + '/' + setById(c.set).size; };
  const initialsOf = function (name) {
    const w = name.split(' — ')[0].replace(/[^A-Za-z0-9À-ÿ ]/g, '').split(' ').filter(Boolean);
    if (w.length === 1) return (w[0].length <= 4 ? w[0] : w[0].slice(0, 2)).toUpperCase();
    return w.slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase() || '?';
  };
  // ---------- Carte (modèle des communes, pour l'instant pour toutes les raretés) ----------
  function hexRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  const RHEX = { common: '#a7a3b8', uncommon: '#4fd1c5', rare: '#4fa8ff', epic: '#b46bff', legend: '#f2c25b', secret: '#ff7ad9', goat: '#e2012d' };
  function mixc(c, d, k) { return 'rgb(' + c.map(function (v, i) { return Math.round(v + (d[i] - v) * k); }).join(',') + ')'; }
  function cardStyle(c) {
    const r = RAR.find(function (x) { return x.id === c.rarity; });
    const rgb = hexRgb(c.color || RHEX[c.rarity]), W = [255, 255, 255], K = [0, 0, 0];
    const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    // dark : fond sombre derrière le visuel, pour les logos clairs
    return '--p1:' + mixc(rgb, W, .25) + ';--p2:' + mixc(rgb, K, .18) + ';--ph1:' + (c.dark ? mixc(rgb, K, .3) : mixc(rgb, W, .85)) + ';--ph2:' + (c.dark ? mixc(rgb, K, .68) : mixc(rgb, W, .45)) +
      ';--foot:' + (lum > .5 ? mixc(rgb, K, .55) : mixc(rgb, W, .62)) + ';--foot-strong:' + (lum > .5 ? mixc(rgb, K, .78) : mixc(rgb, W, .88)) +
      ';--ghost:' + (c.dark ? 'rgba(255,255,255,.2)' : 'rgba(28,27,34,.24)') + ';--rr:' + r.color;
  }
  function cardInner(c) {
    const s = setById(c.set);
    const fr = /fran[cç]/i.test((c.note || '') + ' ' + c.name), goat = c.rarity === 'goat';
    // « Nom — Sous-titre » : le nom en gros, le sous-titre en dessous
    const parts = c.name.split(' — ');
    const title = parts[0];
    const sub = parts[1] ? parts[1] + (c.year ? ' · ' + c.year : '') : ([c.note, c.year].filter(Boolean).join(' · ') || c.type);
    // Moments et événements : la note raconte ce qui s'est passé
    const story = (parts[1] || c.type === 'Moment' || c.type === 'Événement' || c.rarity === 'goat') && c.note ? c.note : '';
    const subLine = story && !parts[1] ? (c.year ? String(c.year) : c.type) : sub;
    return '<div class="cc-panel"><div class="cc-photo"><span class="cc-ghost">' + (goat ? 'GOAT' : n3(c.num)) + '</span>' +
      (c.img ? '<img' + (c.map ? ' class="is-map' + (c.fade ? ' is-fade' : '') + '"' : c.player ? ' class="is-player"' : c.photo ? ' class="is-photo"' : '') + ' src="' + c.img + '" alt="' + esc(c.name) + '" loading="lazy">' : '<span class="cc-todo"><b>' + esc(initialsOf(c.name)) + '</b>Visuel à venir</span>') +
      (goat ? '<span class="cc-num"><b>GOAT</b><small>HORS SÉRIE</small></span>' : '<span class="cc-num"><b>' + n3(c.num) + '</b><small>/' + s.size + '</small></span>') +
      '<span class="cc-tag"><svg><use href="#sym-ori"/></svg>ORIGINES</span><span class="cc-ed">PREMIÈRE ÉDITION</span>' + (c.rarity === 'epic' ? '<span class="cc-spark"></span>' : '') + '</div>' +
      '<div class="cc-band' + (fr ? ' fr' : '') + (story ? ' has-story' : '') + '">' + (c.rarity === 'legend' ? '<span class="cc-crest"><b>★</b> LÉGENDAIRE <b>★</b></span>' : c.rarity === 'secret' ? '<span class="cc-crest"><b>★</b> SECRÈTE <b>★</b></span>' : goat ? '<span class="cc-crest"><b>★★★</b> GREATEST OF ALL TIME <b>★★★</b></span>' : '') + (story ? '<h3>' + esc(title) + '</h3><p class="cc-story">' + esc(story) + '</p>' : '<h3>' + esc(title) + '</h3><p>' + esc(subLine) + '</p>') + '</div>' +
      '<div class="cc-foot"><span>' + esc(story ? subLine : c.type + ' · ' + c.game) + '</span><span class="cc-set"><svg><use href="#sym-ori"/></svg>' + numText(c) + '<i></i></span></div></div>';
  }
  // Finition selon la rareté
  const FINISH = { uncommon: 'u-silver u-foil u-holo u-soft', epic: 'e-epic', legend: 'l-legend l-glass', goat: 'l-legend g-goat', secret: 'l-legend s-secret' };
  const finish = function (c) { return FINISH[c.rarity] || ''; };
  // Cadre HUD des légendaires : coins coupés, accents dorés sur les angles, losanges au centre
  const HUD = '<svg class="cc-hud" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon class="thin" points="9,3.6 91,3.6 96.4,7.4 96.4,132.6 91,136.4 9,136.4 3.6,132.6 3.6,7.4"/>' +
    '<polyline class="bold" points="3.6,16 3.6,7.4 9,3.6 22,3.6"/><polyline class="bold" points="78,3.6 91,3.6 96.4,7.4 96.4,16"/>' +
    '<polyline class="bold" points="3.6,124 3.6,132.6 9,136.4 22,136.4"/><polyline class="bold" points="78,136.4 91,136.4 96.4,132.6 96.4,124"/>' +
    '<polygon class="gem" points="50,1.9 52.6,3.6 50,5.3 47.4,3.6"/><polygon class="gem" points="50,134.7 52.6,136.4 50,138.1 47.4,136.4"/>' +
    '</svg>';
  const corners = function (c) { return c.rarity === 'legend' || c.rarity === 'goat' || c.rarity === 'secret' ? HUD : ''; };
  function ownedSlot(c, n) {
    return '<button class="cc mini ' + finish(c) + '" type="button" data-card="' + c.num + '" style="' + cardStyle(c) + '" aria-label="' + esc(c.name) + (n > 1 ? ' (×' + n + ')' : '') + '">' + cardInner(c) + corners(c) + (n > 1 ? '<span class="cc-count">×' + n + '</span>' : '') + '</button>';
  }
  function openCard(num) {
    const c = CATALOG.find(function (x) { return String(x.num) === String(num); }), r = RAR.find(function (x) { return x.id === c.rarity; });
    const el = $('#bigCard');
    el.className = 'cc big ' + finish(c);
    el.style.cssText = cardStyle(c);
    el.innerHTML = cardInner(c) + corners(c) + '<span class="cc-holo"></span><span class="cc-glare"></span>';
    if (c.rarity === 'legend' || c.rarity === 'goat' || c.rarity === 'secret') el.querySelector('.cc-panel').insertAdjacentHTML('beforeend', '<span class="cc-glint"></span>');
    $('#bigRarity').textContent = r.name;
    const mo = $('#cardModal'); mo.classList.add('open'); mo.setAttribute('aria-hidden', 'false');
    tiltReset();
  }

  // ---------- Inclinaison 3D qui suit la souris / le doigt ----------
  const tiltBox = $('#tiltBox');
  function tiltSet(px, py, on) {
    const card = $('#bigCard');
    card.style.setProperty('--rx', ((0.5 - py) * 24).toFixed(2) + 'deg');
    card.style.setProperty('--ry', ((px - 0.5) * 28).toFixed(2) + 'deg');
    card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    card.style.setProperty('--o', on ? 1 : 0);
  }
  function tiltReset() { tiltSet(0.5, 0.5, false); }
  let tiltRaf = 0, tiltPt = null;
  function tiltMove(e) {
    const p = e.touches ? e.touches[0] : e;
    tiltPt = [p.clientX, p.clientY];
    if (tiltRaf) return;
    tiltRaf = requestAnimationFrame(function () {
      tiltRaf = 0; const r = $('#bigCard').getBoundingClientRect();
      tiltSet(Math.min(1, Math.max(0, (tiltPt[0] - r.left) / r.width)), Math.min(1, Math.max(0, (tiltPt[1] - r.top) / r.height)), true);
    });
  }
  tiltBox.addEventListener('pointermove', tiltMove);
  tiltBox.addEventListener('touchmove', function (e) { tiltMove(e); }, { passive: true });
  tiltBox.addEventListener('pointerleave', tiltReset);
  tiltBox.addEventListener('touchend', tiltReset);
  function closeCard() { const mo = $('#cardModal'); mo.classList.remove('open'); mo.setAttribute('aria-hidden', 'true'); }


  // =====================================================================
  // Affichage
  // =====================================================================
  function renderBinds() {
    const t = now();
    const free = S ? Date.parse(S.prochain_gratuit) - t : 0, wheel = S ? Date.parse(S.prochaine_roue) - t : 0;
    const quests = S && S.quetes ? S.quetes : [];
    const vals = {
      coins: S ? fmt(S.pieces) : '0', packTotal: S ? fmt(S.boosters) : '0', initials: initials(S && S.pseudo), pseudo: (S && S.pseudo) || 'Joueur',
      owned: fmt(ownedCount()), catalog: fmt(CATALOG.length), score: fmt(collScore()), opened: S ? fmt(S.ouverts) : '0', bought: S ? fmt(S.achetes) : '0',
      email: USER ? USER.email || '' : '',
      joined: S ? new Date(S.cree_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      freeTimer: !S ? '--:--:--' : free <= 0 ? 'Disponible' : countdown(free), freeLabel: S && free <= 0 ? 'Booster gratuit' : 'Booster gratuit dans',
      wheelTimer: !S ? '--:--:--' : wheel <= 0 ? 'Prête' : countdown(wheel), wheelLabel: S && wheel <= 0 ? 'Roue du jour' : 'Roue du jour dans',
      questCount: quests.filter(function (q) { return q.recuperee; }).length + ' / ' + (quests.length || 5)
    };
    $$('[data-bind]').forEach(function (el) { const k = el.dataset.bind; if (k in vals && el.textContent !== String(vals[k])) el.textContent = vals[k]; });
    $$('[data-clock]').forEach(function (el) {
      const ms = el.dataset.clock === 'free' ? free : wheel, k = !S ? '-' : ms <= 0 ? 'ok' : countdown(ms);
      if (el._k === k) return; el._k = k;
      el.innerHTML = !S ? '<b>--</b>:<b>--</b>:<b>--</b>' : ms <= 0 ? '<span class="ready">' + (el.dataset.clock === 'free' ? 'Disponible' : 'Prête') + '</span>'
        : k.split(':').map(function (x) { return '<b>' + x + '</b>'; }).join(':');
    });
    $$('[data-bind-width="freePct"]').forEach(function (el) { const w = (!S ? 0 : free <= 0 ? 100 : Math.max(0, 100 - free / 36e3)).toFixed(1) + '%'; if (el.style.width !== w) el.style.width = w; });
    $$('[data-action="claim-free"]').forEach(function (b) { const h = !(S && free <= 0); if (b.hidden !== h) b.hidden = h; });
    $$('[data-wheel-btn]').forEach(function (b) { const d = !(S && wheel <= 0); if (b.disabled !== d) b.disabled = d; });
    $$('.wheel-panel').forEach(function (p) { p.classList.toggle('ready', !!(S && wheel <= 0)); });
    $$('.pack-badge').forEach(function (el) { const n = S ? S.boosters : 0, z = n <= 0; el.classList.toggle('zero', z); if (el._n !== undefined && n > el._n) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } el._n = n; });
    $$('[data-open-btn]').forEach(function (b) { const d = !(S && S.boosters > 0); if (b.disabled !== d) b.disabled = d; });
  }

  function renderAuthState() {
    const inn = !!USER;
    $$('[data-auth]').forEach(function (el) { el.hidden = !inn; });
    $$('[data-guest]').forEach(function (el) { el.hidden = inn; });
    if (ONLINE) $('#demoBar').hidden = true; else if (!renderAuthState.done) { $('#demoBar').hidden = false; renderAuthState.done = 1; }
  }

  function renderQuests() {
    if (!S) { $('#quests').innerHTML = '<div class="muted" style="font-size:14px">Connecte-toi pour faire les quêtes du jour.</div>'; return; }
    $('#quests').innerHTML = S.quetes.map(function (q) {
      const done = q.progres >= q.objectif;
      const right = q.recuperee ? '<span class="claimed-tag">Récupérée</span>'
        : done ? '<button class="claim" type="button" data-quest="' + esc(q.id) + '">Récupérer</button>'
        : '<span class="quest-num">' + q.progres + ' / ' + q.objectif + '</span>';
      return '<div class="quest' + (q.recuperee ? ' claimed' : done ? ' done' : '') + '"><span class="quest-name">' + esc(q.nom) + '</span>' +
        '<span class="quest-reward">' + gainHTML(q.pieces, q.boosters) + '</span><div class="quest-bar"><div class="track"><i style="width:' + (q.progres / q.objectif * 100) + '%"></i></div>' + right + '</div></div>';
    }).join('');
  }

  function renderHome() {
    $('#odds').innerHTML = RAR.map(function (r) {
      return '<div class="odd" style="--r:' + r.color + '"><span class="odd-name">' + r.name + '</span><span class="odd-pct">' + r.odds + '</span><span class="odd-note">' + r.note + '</span></div>';
    }).join('');
    if (!$('#fanL').firstChild) [['#fanL', 176], ['#fanR', 177]].forEach(function (f) {
      const c = BY_ID[f[1]]; if (c) $(f[0]).innerHTML = '<div class="cc mini ' + finish(c) + '" style="' + cardStyle(c) + '" aria-hidden="true">' + cardInner(c) + corners(c) + '</div>';
    });
    const w = (ownedCount() / CATALOG.length * 100).toFixed(1) + '%';
    $('#homeProg').style.width = w; $('#collProg').style.width = w;
  }

  function renderBoosters() {
    const s = SETS[0], prix = S ? S.prix : { un: 200, cinq: 900 }, coins = S ? S.pieces : 0;
    const buy = !S ? '<div class="offer-buy"><button class="btn btn-gold" type="button" data-action="login">Se connecter pour acheter</button></div>'
      : '<div class="offer-buy"><button class="btn btn-gold" type="button" data-buy="1"' + (coins < prix.un ? ' disabled' : '') + '>Acheter <small><i class="coin"></i> ' + fmt(prix.un) + '</small></button>' +
        '<button class="btn btn-ghost" type="button" data-buy="5"' + (coins < prix.cinq ? ' disabled' : '') + '>Lot de 5 <small class="num" style="font-size:12px;opacity:.8"><i class="coin"></i> ' + fmt(prix.cinq) + '</small></button></div>';
    $('#shop').innerHTML = packHTML(s) + '<div class="offer-info"><div class="row"><span class="status ' + s.status + '">' + STATUS[s.status] + '</span>' +
      '<span class="stamp"><svg><use href="#sym-' + s.id + '"/></svg>' + s.code + '<span class="ed1">ÉDITION 1</span></span></div>' +
      '<h3>' + s.name + '</h3><ul><li>' + s.desc + '</li><li>' + s.size + ' cartes + ' + s.secret + ' secrètes + GOAT</li><li>5 cartes par booster, au hasard</li></ul>' + buy + '</div>';
    const rc = {}; RAR.forEach(function (r) { rc[r.id] = r; });
    $('#rewards').innerHTML = !S ? '<div class="muted" style="font-size:14px">Complète une rareté ou toute la série pour gagner des pièces et des boosters.</div>'
      : S.recompenses.map(function (r) {
        const done = r.possede >= r.total;
        const right = r.recuperee ? '<span class="claimed-tag">Récupérée</span>' : done ? '<button class="claim" type="button" data-reward="' + esc(r.id) + '">Récupérer</button>' : '<span class="quest-num">' + r.possede + ' / ' + r.total + '</span>';
        return '<div class="reward' + (r.recuperee ? ' claimed' : '') + '" style="--r:' + (r.rarete ? rc[r.rarete].color : 'var(--gold)') + '"><span class="reward-name">' + esc(r.nom) + '</span><span class="reward-gain">' + gainHTML(r.pieces, r.boosters) + '</span>' +
          '<div class="quest-bar"><div class="track"><i style="width:' + Math.min(100, r.possede / r.total * 100) + '%;background:' + (r.rarete ? rc[r.rarete].color : 'var(--gold)') + '"></i></div>' + right + '</div></div>';
      }).join('');
  }

  const F = { set: 'all', rarity: 'all', ownedOnly: false };
  function renderCollection() {
    $('#setFilter').innerHTML = [{ id: 'all', name: 'Toutes' }].concat(SETS).map(function (s) {
      return '<button type="button" data-fset="' + s.id + '" aria-pressed="' + (F.set === s.id) + '">' + s.name + '</button>';
    }).join('');
    $('#rarityFilter').innerHTML = [{ id: 'all', name: 'Toutes' }].concat(RAR).map(function (r) {
      return '<button type="button" data-frar="' + r.id + '" aria-pressed="' + (F.rarity === r.id) + '">' + r.name + '</button>';
    }).join('');
    $('#ownedOnly').checked = F.ownedOnly;
    const list = CATALOG.filter(function (c) {
      return (F.set === 'all' || c.set === F.set) && (F.rarity === 'all' || c.rarity === F.rarity) && (!F.ownedOnly || owns(c.id));
    });
    $('#slotCount').textContent = list.length + ' emplacement' + (list.length > 1 ? 's' : '');
    $('#collEmpty').hidden = list.length > 0;
    $('#slots').hidden = list.length === 0;
    const rc = {}; RAR.forEach(function (r) { rc[r.id] = r; });
    $('#slots').innerHTML = list.map(function (c) {
      const s = setById(c.set);
      if (owns(c.id)) return ownedSlot(c, S.collection[c.id]);
      return '<div class="slot" style="--r:' + rc[c.rarity].color + '" title="' + s.name + ' · ' + s.edition + ' · ' + numText(c) + ' · ' + rc[c.rarity].name + ' · non obtenue">' +
        '<span class="slot-ed">ÉD.1</span><span class="slot-r"></span><span class="lock"></span>' +
        '<span class="slot-stamp"><svg><use href="#sym-' + s.id + '"/></svg>' + numText(c) + '</span></div>';
    }).join('');
  }

  let board = 'score', boardRows = null;
  async function loadBoard() {
    try { boardRows = await rpc('classement', { tri: board === 'legend' ? 'legendaires' : board === 'cards' ? 'cartes' : 'score' }); } catch (e) { boardRows = []; toast(e.message, true); }
    renderBoard();
  }
  function renderBoard() {
    const key = { score: 'score', legend: 'legendaires', cards: 'cartes' }[board];
    $('#boardCol').textContent = { score: 'Score', legend: 'Légendaires+', cards: 'Cartes' }[board];
    $$('#boardTabs button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.board === board); });
    if (!boardRows) { $('#boardBody').innerHTML = '<tr><td colspan="3" class="muted">Chargement…</td></tr>'; return; }
    if (!boardRows.length) { $('#boardBody').innerHTML = '<tr><td colspan="3" class="muted">Aucun joueur pour l\'instant.</td></tr>'; return; }
    const mine = S && S.pseudo;
    $('#boardBody').innerHTML = boardRows.map(function (r, i) {
      const me = mine && r.pseudo === mine;
      return '<tr' + (me ? ' class="me"' : '') + '><td class="rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</td>' +
        '<td><div class="who"><span class="avatar">' + esc(initials(r.pseudo)) + '</span><span>' + esc(r.pseudo) + (me ? ' <span class="muted">(toi)</span>' : '') + '</span></div></td>' +
        '<td class="r num">' + fmt(r[key]) + '</td></tr>';
    }).join('');
  }

  function renderAll() { renderAuthState(); renderBinds(); renderQuests(); renderHome(); renderBoosters(); renderCollection(); renderBoard(); }

  // =====================================================================
  // Navigation
  // =====================================================================
  const VIEWS = ['accueil', 'boosters', 'collection', 'echanges', 'classement', 'profil'];
  const TITLES = { accueil: 'Accueil', boosters: 'Boosters', collection: 'Collection', echanges: 'Échanges', classement: 'Classement', profil: 'Profil' };
  function route() {
    const v = location.hash.slice(1);
    let view = VIEWS.indexOf(v) >= 0 ? v : 'accueil';
    const needLogin = view === 'profil' && !USER; if (needLogin) view = 'accueil';
    $$('[data-view]').forEach(function (el) { el.hidden = el.dataset.view !== view; });
    $$('[data-link]').forEach(function (a) { if (a.dataset.link === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('#wheelModal.open, #authModal.open').forEach(closeModal); closeCard();
    if (view === 'profil' && S) $('#pseudoInput').value = S.pseudo || '';
    if (view === 'classement') loadBoard();
    if (needLogin) openAuth('login');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // =====================================================================
  // Fenêtres
  // =====================================================================
  function openModal(sel) { const m = $(sel); m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); const f = m.querySelector('input:not([type=hidden]), button.wheel-hub'); if (f) setTimeout(function () { f.focus(); }, 50); }
  function closeModal(m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
  function openAuth(tab) { setAuthTab(tab || 'login'); $('#loginMsg').textContent = ''; $('#signupMsg').textContent = ''; openModal('#authModal'); }
  function setAuthTab(tab) {
    $$('[data-auth-tab]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.authTab === tab); });
    $('#loginForm').hidden = tab !== 'login'; $('#signupForm').hidden = tab !== 'signup';
    $('#authTitle').textContent = tab === 'login' ? 'Content de te revoir' : 'Rejoins Clutch TCG';
  }
  function msg(el, text, kind) { el.className = 'form-msg' + (kind ? ' ' + kind : ''); el.textContent = text; }
  function hint(el, text, kind) { el.className = 'hint' + (kind ? ' ' + kind : ''); el.textContent = text; }
  function busy(btn, on, label) { if (on) { btn._l = btn.innerHTML; btn.disabled = true; btn.textContent = label || 'Patiente…'; } else { btn.disabled = false; if (btn._l) btn.innerHTML = btn._l; } }

  // =====================================================================
  // Comptes
  // =====================================================================
  async function setUser(u) {
    USER = u ? { email: u.email } : null;
    $('#testPanel').hidden = true;
    if (!USER) { S = null; renderAll(); return; }
    closeModal($('#authModal'));
    await refresh();
    try { $('#testPanel').hidden = !(await rpc('suis_testeur')); } catch (e) {}
  }

  // Force du mot de passe (indication seulement : le minimum imposé est 8 caractères)
  function pwdScore(p) { let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return s; }
  $('#suPwd').addEventListener('input', function () {
    const p = this.value, sc = pwdScore(p), bar = $('.pwd-meter i');
    bar.style.width = (p ? Math.max(12, sc / 5 * 100) : 0) + '%';
    bar.style.background = sc <= 1 ? 'var(--bad)' : sc <= 3 ? 'var(--gold)' : 'var(--ok)';
    if (!p) hint($('#suPwdHint'), '8 caractères minimum.');
    else if (p.length < 8) hint($('#suPwdHint'), 'Encore ' + (8 - p.length) + ' caractère' + (8 - p.length > 1 ? 's' : '') + '.', 'err');
    else hint($('#suPwdHint'), sc <= 2 ? 'Correct. Ajoute des chiffres ou des symboles pour le rendre plus sûr.' : 'Mot de passe solide.', 'ok');
    checkPwd2();
  });
  function checkPwd2() {
    const a = $('#suPwd').value, b = $('#suPwd2').value;
    if (!b) { hint($('#suPwd2Hint'), ''); $('#suPwd2').classList.remove('err', 'ok'); return; }
    const ok = a === b; hint($('#suPwd2Hint'), ok ? 'Les mots de passe correspondent.' : 'Les mots de passe ne correspondent pas.', ok ? 'ok' : 'err');
    $('#suPwd2').classList.toggle('err', !ok); $('#suPwd2').classList.toggle('ok', ok);
  }
  $('#suPwd2').addEventListener('input', checkPwd2);

  // Vérifie le pseudo pendant la saisie
  function pseudoWatcher(input, hintEl) {
    let t = 0, last = '';
    input.addEventListener('input', function () {
      const v = input.value.trim(); clearTimeout(t); input.classList.remove('err', 'ok');
      if (!v) { hint(hintEl, '3 à 16 caractères : lettres, chiffres, point, _ ou -.'); return; }
      if (!NAME_OK.test(v)) { hint(hintEl, '3 à 16 caractères : lettres, chiffres, point, _ ou - (pas d\'espace ni d\'accent).', 'err'); input.classList.add('err'); return; }
      hint(hintEl, 'Vérification…'); last = v;
      t = setTimeout(async function () {
        try {
          const free = await rpc('pseudo_libre', { p: v });
          if (input.value.trim() !== last) return;
          hint(hintEl, free ? 'Pseudo disponible.' : 'Ce pseudo est déjà pris.', free ? 'ok' : 'err'); input.classList.add(free ? 'ok' : 'err');
        } catch (e) { hint(hintEl, ''); }
      }, 400);
    });
  }
  pseudoWatcher($('#suPseudo'), $('#suPseudoHint'));
  pseudoWatcher($('#pickInput'), $('#pickHint'));

  $('#signupForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const pseudo = $('#suPseudo').value.trim(), email = $('#suEmail').value.trim(), p1 = $('#suPwd').value, p2 = $('#suPwd2').value, m = $('#signupMsg'), btn = this.querySelector('[type=submit]');
    if (!NAME_OK.test(pseudo)) return msg(m, 'Choisis un pseudo de 3 à 16 caractères (lettres, chiffres, point, _ ou -).', 'err');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg(m, 'Adresse e-mail invalide.', 'err');
    if (p1.length < 8) return msg(m, 'Le mot de passe doit faire au moins 8 caractères.', 'err');
    if (p1 !== p2) return msg(m, 'Les deux mots de passe ne correspondent pas.', 'err');
    busy(btn, true, 'Création…');
    try {
      if (!(await rpc('pseudo_libre', { p: pseudo }))) throw new Error('Ce pseudo est déjà pris.');
      if (!ONLINE) { DEMO.signup(email, p1, pseudo); await setUser({ email: email }); toast('Compte démo créé. 3 boosters offerts !'); return; }
      const r = await sb.auth.signUp({ email: email, password: p1, options: { data: { pseudo: pseudo }, emailRedirectTo: SITE } });
      if (r.error) throw r.error;
      if (r.data.session) { toast('Compte créé. 3 boosters offerts !'); }
      else { msg(m, 'Compte créé. Ouvre le lien envoyé à ' + email + ' pour l\'activer.', 'ok'); this.reset(); $('.pwd-meter i').style.width = 0; }
    } catch (err) { msg(m, authError(err), 'err'); }
    finally { busy(btn, false); }
  });

  $('#loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = $('#liEmail').value.trim(), pwd = $('#liPwd').value, m = $('#loginMsg'), btn = this.querySelector('[type=submit]');
    if (!email || !pwd) return msg(m, 'Remplis ton e-mail et ton mot de passe.', 'err');
    if (!ONLINE) return msg(m, 'En mode démo, utilise « Inscription » pour créer un compte de test.', 'err');
    busy(btn, true, 'Connexion…');
    try { const r = await sb.auth.signInWithPassword({ email: email, password: pwd }); if (r.error) throw r.error; this.reset(); }
    catch (err) { msg(m, authError(err), 'err'); }
    finally { busy(btn, false); }
  });

  async function oauth(provider) {
    if (!ONLINE) { toast('La connexion ' + (provider === 'google' ? 'Google' : 'Discord') + ' marchera dès que le serveur sera branché.', true); return; }
    const r = await sb.auth.signInWithOAuth({ provider: provider, options: { redirectTo: SITE } });
    if (r.error) toast(authError(r.error), true);
  }

  async function forgot() {
    const email = $('#liEmail').value.trim(), m = $('#loginMsg');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg(m, 'Écris ton e-mail ci-dessus, puis clique sur « Mot de passe oublié ».', 'err'); $('#liEmail').focus(); return; }
    if (!ONLINE) { msg(m, 'Indisponible en mode démo.', 'err'); return; }
    const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
    // Même message que le compte existe ou non, pour ne pas révéler quels e-mails sont inscrits
    if (r.error && /rate|security/i.test(r.error.message)) msg(m, authError(r.error), 'err');
    else msg(m, 'Si un compte existe avec cet e-mail, tu vas recevoir un lien pour changer ton mot de passe.', 'ok');
  }

  $('#pwdForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const a = $('#npPwd').value, b = $('#npPwd2').value, m = $('#pwdMsg'), btn = this.querySelector('[type=submit]');
    if (a.length < 8) return msg(m, 'Le mot de passe doit faire au moins 8 caractères.', 'err');
    if (a !== b) return msg(m, 'Les deux mots de passe ne correspondent pas.', 'err');
    busy(btn, true);
    try { const r = await sb.auth.updateUser({ password: a }); if (r.error) throw r.error; closeModal($('#pwdModal')); toast('Mot de passe changé.'); this.reset(); }
    catch (err) { msg(m, authError(err), 'err'); }
    finally { busy(btn, false); }
  });

  $('#pickForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const v = $('#pickInput').value.trim(), m = $('#pickMsg'), btn = this.querySelector('[type=submit]');
    if (!NAME_OK.test(v)) return msg(m, 'Le pseudo doit faire 3 à 16 caractères (lettres, chiffres, point, _ ou -).', 'err');
    busy(btn, true);
    try { await rpc('choisir_pseudo', { p: v }); closeModal($('#pseudoModal')); toast('Bienvenue ' + v + ' ! Tes 3 boosters t\'attendent.'); await refresh(); }
    catch (err) { msg(m, err.message, 'err'); }
    finally { busy(btn, false); }
  });

  $('#pseudoForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const v = $('#pseudoInput').value.trim(), m = $('#pseudoMsg');
    if (!NAME_OK.test(v)) return msg(m, 'Le pseudo doit faire 3 à 16 caractères (lettres, chiffres, point, _ ou -).', 'err');
    try { await rpc('choisir_pseudo', { p: v }); msg(m, 'Pseudo enregistré.', 'ok'); await refresh(); }
    catch (err) { msg(m, err.message, 'err'); }
  });

  async function logout() {
    if (ONLINE) await sb.auth.signOut(); else DEMO.logout();
    await setUser(null); location.hash = '#accueil'; toast('Tu es déconnecté.');
  }

  // =====================================================================
  // Ouverture de booster
  // =====================================================================
  const RC = { common: '#e4e0ee', uncommon: '#4fd1c5', epic: '#b46bff', legend: '#f2c25b', secret: '#ff7ad9', goat: '#ffffff' };
  const FXC = { common: ['#ffffff', '#d9d4e8'], uncommon: ['#4fd1c5', '#c9fff8', '#ffffff'], epic: ['#b46bff', '#e2c4ff', '#ffffff'], legend: ['#f2c25b', '#fff1c4', '#ffffff', '#ffb02e'], secret: ['#ff7ad9', '#ffd1f1', '#ffffff', '#b996ff'], goat: ['#ff7eb6', '#ffd36b', '#ffffff', '#6fd0ff', '#b996ff', '#f2c25b'] };
  const OP = { phase: 'off', res: null, req: null, err: null, list: [], idx: 0, busy: false, tearing: false, tp: 0, emit: null };
  const opener = $('#opener'), opPack = $('#opPack'), opReveal = $('#opReveal');
  const setRc = function (col) { opener.style.setProperty('--rc', col); };
  const shake = function () { const st = $('#opStage'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake'); };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function flash(color) { const f = $('#opFlash'); f.style.setProperty('--fc', color); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  function opButtons(show) { $$('#opActions [data-op]').forEach(function (b) { b.hidden = show.indexOf(b.dataset.op) < 0 || (b.dataset.op === 'next' && !(S && S.boosters > 0)); }); }
  function hideBanner() { const b = $('#opBanner'); if (b.classList.contains('show')) b.classList.add('out'); }

  // ---------- Particules ----------
  const FX = { ctx: null, ps: [], raf: 0, w: 0, h: 0 };
  function fxInit() {
    const c = $('#opFx'), d = Math.min(2, window.devicePixelRatio || 1);
    FX.w = window.innerWidth; FX.h = window.innerHeight; c.width = FX.w * d; c.height = FX.h * d;
    FX.ctx = c.getContext('2d'); FX.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function spawn(x, y, colors, vx, vy, size, decay, g) {
    FX.ps.push({ x: x, y: y, vx: vx, vy: vy, life: 1, decay: decay, size: size, c: colors[Math.floor(Math.random() * colors.length)], rot: Math.random() * 6, vr: (Math.random() - .5) * .3, sq: Math.random() < .55, g: g });
  }
  function burst(x, y, colors, n, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = power * (.35 + Math.random() * .9);
      spawn(x, y, colors, Math.cos(a) * v, Math.sin(a) * v - power * .25, 2 + Math.random() * 4.5, .007 + Math.random() * .014, .12);
    }
    fxRun();
  }
  function fxRun() { if (!FX.raf) FX.raf = requestAnimationFrame(fxLoop); }
  function fxLoop() {
    FX.raf = 0; const ctx = FX.ctx; if (!ctx) return;
    ctx.clearRect(0, 0, FX.w, FX.h);
    if (OP.emit) {
      const r = opReveal.getBoundingClientRect();
      for (let i = 0; i < 2; i++) {
        const side = Math.random(), x = side < .5 ? r.left + Math.random() * r.width : (side < .75 ? r.left : r.right), y = side < .5 ? r.bottom - Math.random() * r.height * .2 : r.top + Math.random() * r.height;
        spawn(x, y, OP.emit, (Math.random() - .5) * 1.2, -1 - Math.random() * 2.2, 1.5 + Math.random() * 3, .01 + Math.random() * .012, -.01);
      }
    }
    FX.ps = FX.ps.filter(function (p) {
      p.vy += p.g; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, p.life * 1.6); ctx.fillStyle = p.c;
      if (p.sq) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, 6.283); ctx.fill(); }
      return true;
    });
    ctx.globalAlpha = 1;
    if (FX.ps.length || OP.emit) fxRun();
  }
  function centerOf(el, fy) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * (fy == null ? .5 : fy)]; }

  // ---------- Inclinaisons amorties (le booster et la carte suivent le pointeur en douceur) ----------
  const SM = { raf: 0, items: [] };
  function smooth(el, apply) { const o = { el: el, apply: apply, cur: { x: 0, y: 0, o: 0 }, tgt: { x: 0, y: 0, o: 0 } }; SM.items.push(o); return o; }
  function smLoop() {
    SM.raf = 0; let moving = false;
    SM.items.forEach(function (o) {
      ['x', 'y', 'o'].forEach(function (k) { const d = o.tgt[k] - o.cur[k]; if (Math.abs(d) > .002) { o.cur[k] += d * .14; moving = true; } else o.cur[k] = o.tgt[k]; });
      o.apply(o.cur);
    });
    if (moving) SM.raf = requestAnimationFrame(smLoop);
  }
  function smKick() { if (!SM.raf) SM.raf = requestAnimationFrame(smLoop); }
  const packTilt = smooth(null, function (c) { const pk = opPack.querySelector('.pack'); if (pk) pk.style.transform = 'rotateX(' + (c.y * -14).toFixed(2) + 'deg) rotateY(' + (c.x * 18).toFixed(2) + 'deg)'; });
  const cardTilt = smooth(null, function (c) {
    const el = $$('.rv', opReveal)[OP.idx], card = el && el.querySelector('.cc.big'); if (!card) return;
    card.style.setProperty('--rx', (-c.y * 20).toFixed(2) + 'deg'); card.style.setProperty('--ry', (c.x * 24).toFixed(2) + 'deg');
    card.style.setProperty('--mx', (50 + c.x * 100).toFixed(1) + '%'); card.style.setProperty('--my', (50 + c.y * 100).toFixed(1) + '%'); card.style.setProperty('--o', c.o.toFixed(3));
  });

  // ---------- Ouverture ----------
  function openerShow() {
    opener.hidden = false; document.body.style.overflow = 'hidden'; fxInit(); FX.ps = [];
    Object.assign(OP, { phase: 'pack', res: null, req: null, err: null, list: [], idx: 0, busy: false, tearing: false, tp: 0, emit: null });
    opener.classList.remove('dark', 'rays'); setRc('#ffffff');
    opPack.getAnimations().concat(opReveal.getAnimations()).forEach(function (an) { an.cancel(); });
    opPack.hidden = false; opPack.className = 'op-pack'; opPack.style.setProperty('--tp', 0);
    opPack.innerHTML = packHTML(SETS[0]).replace(/<\/div>$/, '<div class="pk-strip"></div><i class="pk-slit"></i><i class="pk-guide"></i></div>');
    packTilt.cur = { x: 0, y: 0, o: 0 }; packTilt.tgt = { x: 0, y: 0, o: 0 };
    opReveal.hidden = true; opReveal.innerHTML = ''; $('#opSumWrap').hidden = true; $('#opCount').hidden = true;
    $('#opBanner').className = 'op-banner'; $('#opX').hidden = false;
    $('#opHint').textContent = 'Glisse le long du haut du booster pour le déchirer';
    opButtons([]);
    requestAnimationFrame(buildStrip);
    setTimeout(function () { opPack.focus({ preventScroll: true }); }, 50);
  }
  function openerHide() { OP.phase = 'off'; OP.emit = null; opener.hidden = true; document.body.style.overflow = ''; renderAll(); }
  async function startOpen() {
    if (!USER) { openAuth('signup'); return; }
    if (!S || S.boosters < 1) { toast('Tu n\'as plus de booster. Récupère le gratuit, tourne la roue ou achètes-en un.', true); location.hash = '#boosters'; return; }
    openerShow();
  }
  function bestRarity(res) { let b = 'common'; res.cartes.forEach(function (id) { const r = BY_ID[id].rarity; if (RORDER[r] > RORDER[b]) b = r; }); return b; }
  // Le tirage part dès qu'on touche le booster : la lueur de la déchirure prend la couleur de la meilleure carte
  function ensureReq() {
    if (OP.req) return OP.req;
    OP.req = rpc('ouvrir_booster').then(function (res) { OP.res = res; setRc(RC[bestRarity(res)]); refresh(); return res; }, function (e) { OP.err = e; throw e; });
    OP.req.catch(function () {});
    return OP.req;
  }

  // ---------- Déchirure : la bande du haut est découpée en tranches qui s'enroulent en courbe ----------
  const TEAR = { n: 30 };
  function buildStrip() {
    const pack = opPack.querySelector('.pack'), strip = opPack.querySelector('.pk-strip'); if (!pack || !strip) return;
    const W = pack.offsetWidth, H = pack.offsetHeight, sh = H * .072, w = W / TEAR.n;
    Object.assign(TEAR, { W: W, H: H, sh: sh, w: w, jag: [] });
    for (let i = 0; i <= TEAR.n; i++) TEAR.jag.push((Math.random() - .5) * sh * .32 + (i % 2 ? sh * .06 : -sh * .06));
    let h = '';
    for (let i = 0; i < TEAR.n; i++) {
      const jb = Math.max(TEAR.jag[i], TEAR.jag[i + 1]);
      h += '<i style="left:' + (i * w).toFixed(2) + 'px;width:' + (w + .8).toFixed(2) + 'px;height:' + (sh + jb).toFixed(2) + 'px;background-image:var(--img);background-size:' + W + 'px ' + H + 'px;background-position:' + (-i * w).toFixed(2) + 'px 0;transform-origin:100% ' + sh.toFixed(2) + 'px;' +
        'clip-path:polygon(0 0,100% 0,100% ' + (sh + TEAR.jag[i + 1]).toFixed(2) + 'px,0 ' + (sh + TEAR.jag[i]).toFixed(2) + 'px)"></i>';
    }
    strip.innerHTML = h; strip.style.transform = ''; strip.style.opacity = '';
    renderTear(OP.tp, 0);
  }
  function renderTear(p, fly) {
    const pack = opPack.querySelector('.pack'), body = pack && pack.querySelector('.pk-body'), strip = pack && pack.querySelector('.pk-strip');
    if (!strip || !TEAR.W) return;
    const W = TEAR.W, H = TEAR.H, sh = TEAR.sh, w = TEAR.w, F = p * W, sl = strip.children;
    // Le sachet perd sa bande là où elle est déchirée, avec un bord irrégulier
    if (p <= 0) body.style.clipPath = '';
    else {
      const pts = ['0px ' + (sh + TEAR.jag[0]).toFixed(1) + 'px'];
      for (let i = 1; i * w < F; i++) pts.push((i * w).toFixed(1) + 'px ' + (sh + TEAR.jag[i]).toFixed(1) + 'px');
      pts.push(F.toFixed(1) + 'px ' + sh.toFixed(1) + 'px', F.toFixed(1) + 'px 0px', W + 'px 0px', W + 'px ' + H + 'px', '0px ' + H + 'px');
      body.style.clipPath = 'polygon(' + pts.join(',') + ')';
    }
    // Les tranches déchirées forment une chaîne qui se recourbe vers le haut depuis le front de déchirure
    let px = F, py = sh;
    const last = Math.floor(F / w) - 1;
    for (let i = TEAR.n - 1; i >= 0; i--) {
      const s = sl[i];
      if (i > last) { s.style.display = 'none'; continue; }
      const d = F - (i + 1) * w, k = d / W;
      const a = Math.min(98, (8 + 150 * Math.pow(k, 1.05)) * (.6 + .4 * p)) + fly * 30 * (1 - k);
      s.style.display = 'block';
      s.style.transform = 'translate(' + (px - (i + 1) * w).toFixed(2) + 'px,' + (py - sh).toFixed(2) + 'px) rotate(' + a.toFixed(2) + 'deg)';
      s.style.filter = 'brightness(' + (1.08 - .45 * Math.sin(a * Math.PI / 180)).toFixed(3) + ')';
      const r = a * Math.PI / 180; px -= w * Math.cos(r); py -= w * Math.sin(r);
    }
    if (fly > 0) { strip.style.transform = 'translate(' + (fly * W * .9).toFixed(1) + 'px,' + (-fly * H * .45 - fly * fly * H * .2).toFixed(1) + 'px) rotate(' + (fly * 28).toFixed(1) + 'deg)'; strip.style.opacity = (1 - fly * fly).toFixed(3); }
  }
  function setTp(v) { OP.tp = v; opPack.style.setProperty('--tp', v.toFixed(3)); renderTear(v, 0); }
  function tween(ms, ease, fn) {
    return new Promise(function (done) {
      const t0 = performance.now();
      (function step(t) { const k = Math.min(1, (t - t0) / ms); fn(ease(k)); if (k < 1) requestAnimationFrame(step); else done(); })(t0);
    });
  }
  const easeOut = function (k) { return 1 - Math.pow(1 - k, 3); }, easeInOut = function (k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  function animTp(to, ms) { const from = OP.tp; return tween(ms, easeInOut, function (k) { setTp(from + (to - from) * k); }); }

  async function tearPack() {
    if (OP.phase !== 'pack' || OP.tearing) return; OP.tearing = true;
    ensureReq(); packTilt.tgt = { x: 0, y: 0, o: 0 }; smKick();
    if (OP.tp < 1) await animTp(1, 650 * (1 - OP.tp) + 150);
    let res;
    if (!OP.res) { opPack.classList.add('charge'); $('#opHint').textContent = ''; }
    try { [res] = await Promise.all([OP.req, sleep(120)]); }
    catch (e) { opPack.classList.remove('charge'); OP.tearing = false; OP.req = null; await animTp(0, 300); $('#opHint').textContent = e.message; toast(e.message, true); return; }
    const best = bestRarity(res);
    opPack.classList.remove('charge'); opPack.classList.add('torn'); $('#opHint').textContent = '';
    const p = centerOf(opPack.querySelector('.pack'), .07);
    burst(p[0], p[1], FXC[best], RORDER[best] >= 3 ? 80 : 36, RORDER[best] >= 3 ? 9 : 6);
    flash(RORDER[best] >= 2 ? RC[best] : 'rgba(255,255,255,.55)');
    // La bande s'envole, le sachet disparaît aussitôt et les cartes sont là
    tween(500, easeOut, function (k) { renderTear(1, k); });
    OP.busy = true;
    await sleep(120);
    const packEl = opPack.querySelector('.pack'); packEl.style.animation = 'none';
    opPack.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    buildReveal(res);
    const show = opReveal.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
    await show.finished;
    opPack.hidden = true; OP.busy = false;
  }
  // Glisser le doigt / la souris le long du booster pour le déchirer, sinon un simple clic l'ouvre
  let tearDrag = null;
  opPack.addEventListener('pointerdown', function (e) {
    if (OP.phase !== 'pack' || OP.tearing) return;
    opPack.setPointerCapture(e.pointerId);
    tearDrag = { x0: e.clientX, moved: false, w: TEAR.W || opPack.querySelector('.pack').offsetWidth };
    ensureReq();
  });
  opPack.addEventListener('pointermove', function (e) {
    const pack = opPack.querySelector('.pack'); if (!pack || OP.phase !== 'pack' || OP.tearing) return;
    const r = pack.getBoundingClientRect();
    packTilt.tgt = { x: clamp((e.clientX - r.left) / r.width - .5, -.6, .6), y: clamp((e.clientY - r.top) / r.height - .5, -.6, .6), o: 1 }; smKick();
    if (!tearDrag) return;
    const dx = Math.abs(e.clientX - tearDrag.x0);
    if (dx > 6) { tearDrag.moved = true; opPack.classList.add('drag'); }
    if (!tearDrag.moved) return;
    const v = Math.min(1, dx / (tearDrag.w * .85));
    if (v > OP.tp) {
      setTp(v);
      if (Math.random() < .6) { spawn(r.left + r.width * v, r.top + r.height * .072, ['#ffffff', getComputedStyle(opener).getPropertyValue('--rc').trim() || '#fff'], (Math.random() - .3) * 3, -Math.random() * 3, 2 + Math.random() * 2, .03, .15); fxRun(); }
    }
    if (OP.tp >= 1) { tearDrag = null; opPack.classList.remove('drag'); tearPack(); }
  });
  function tearEnd() {
    if (!tearDrag) return;
    const d = tearDrag; tearDrag = null; opPack.classList.remove('drag');
    if (!d.moved || OP.tp > .5) tearPack(); else animTp(0, 380);
  }
  opPack.addEventListener('pointerup', tearEnd);
  opPack.addEventListener('pointercancel', tearEnd);
  opPack.addEventListener('pointerleave', function () { packTilt.tgt = { x: 0, y: 0, o: 0 }; smKick(); });
  opPack.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tearPack(); } });
  window.addEventListener('resize', function () { if (OP.phase !== 'off') { fxInit(); if (OP.phase === 'pack' && !OP.tearing) buildStrip(); } });

  // ---------- Révélation une par une, la plus rare en dernier ----------
  function buildReveal(res) {
    const list = res.cartes.map(function (id) { return { c: BY_ID[id], neu: res.nouvelles.indexOf(id) >= 0 }; });
    const seen = {}; list.forEach(function (x) { if (x.neu) { if (seen[x.c.id]) x.neu = false; seen[x.c.id] = 1; } });
    list.sort(function (a, b) { return RORDER[a.c.rarity] - RORDER[b.c.rarity]; });
    OP.list = list; OP.idx = 0; OP.phase = 'reveal';
    opReveal.innerHTML = list.map(function (x, k) {
      const c = x.c;
      return '<div class="rv" data-r="' + c.rarity + '" style="--k:' + k + ';--d:' + k + '"><div class="rv-in">' +
        '<div class="rv-f cback"><img class="cback-logo" src="assets/marque/embleme.webp?v=1" alt=""></div>' +
        '<div class="rv-f rv-front"><div class="cc big ' + finish(c) + '" style="' + cardStyle(c) + '">' + cardInner(c).replace(/ loading="lazy"/g, '') + corners(c) + '<span class="cc-holo"></span><span class="cc-glare"></span></div></div>' +
        '</div>' + (x.neu ? '<span class="rv-new">NOUVELLE</span>' : '') + '</div>';
    }).join('');
    $$('.rv', opReveal).forEach(function (el, k) {
      if (RORDER[list[k].c.rarity] >= 3) { const pn = el.querySelector('.cc-panel'); if (pn) pn.insertAdjacentHTML('beforeend', '<span class="cc-glint"></span>'); }
    });
    opReveal.hidden = false; markCur();
    $('#opCount').innerHTML = list.map(function () { return '<i></i>'; }).join(''); $('#opCount').hidden = false;
    $('#opHint').textContent = 'Touche la carte pour la retourner';
    opButtons(['skip']);
  }
  function markCur() {
    $$('.rv', opReveal).forEach(function (el, k) { el.style.setProperty('--d', Math.max(0, k - OP.idx)); el.classList.toggle('cur', k === OP.idx); });
    cardTilt.cur = { x: 0, y: 0, o: 0 }; cardTilt.tgt = { x: 0, y: 0, o: 0 };
  }
  const NAMES = { epic: 'Épique', legend: 'Légendaire', secret: 'Secrète', goat: 'GOAT' };
  function showBanner(r) { const b = $('#opBanner'); b.textContent = NAMES[r]; b.className = 'op-banner' + (r === 'goat' ? ' goat' : ''); void b.offsetWidth; b.classList.add('show'); }
  async function revealCur() {
    const el = $$('.rv', opReveal)[OP.idx]; if (!el || OP.busy) return;
    OP.busy = true;
    const r = el.dataset.r, lvl = RORDER[r], col = RC[r], inner = el.querySelector('.rv-in');
    setRc(col); $('#opRays').classList.toggle('goat', r === 'goat');
    // Montée de tension selon la rareté
    if (r === 'goat') { opener.classList.add('dark'); el.classList.add('beat'); await sleep(1400); el.classList.remove('beat'); }
    if (lvl >= 3) { opener.classList.add('rays'); el.classList.add('tense'); await sleep(r === 'goat' ? 600 : 900); el.classList.remove('tense'); }
    else if (lvl === 2) { el.classList.add('tense'); await sleep(450); el.classList.remove('tense'); }
    // Retournement avec élan : la carte se soulève, pivote et retombe en douceur
    const dur = lvl >= 3 ? 1100 : lvl === 2 ? 800 : 640;
    el.classList.add('face');
    inner.animate([
      { transform: 'rotateY(0deg) translateZ(0) scale(1)' },
      { transform: 'rotateY(100deg) translateZ(60px) scale(1.1)', offset: .45 },
      { transform: 'rotateY(196deg) translateZ(20px) scale(1.04)', offset: .75 },
      { transform: 'rotateY(180deg) translateZ(0) scale(1)' }
    ], { duration: dur, easing: 'cubic-bezier(.3,.6,.25,1)' });
    await sleep(dur * .45);
    const p = centerOf(opReveal);
    if (lvl >= 3) {
      flash(col); shake(); burst(p[0], p[1], FXC[r], r === 'goat' ? 180 : 110, r === 'goat' ? 16 : 13);
      OP.emit = FXC[r]; el.classList.add('big-r'); showBanner(r);
      if (r === 'goat') opener.classList.remove('dark');
    } else if (lvl === 2) {
      flash('rgba(180,107,255,.7)'); burst(p[0], p[1], FXC.epic, 60, 10); el.classList.add('big-r'); showBanner('epic');
    } else burst(p[0], p[1], FXC[r], 18, 6);
    const dot = $$('#opCount i')[OP.idx]; if (dot) { dot.style.setProperty('--c', col); dot.classList.add('done'); }
    $('#opHint').textContent = OP.idx === OP.list.length - 1 ? 'Touche pour voir ton booster' : 'Glisse la carte ou touche pour la suivante';
    await sleep(dur * .55);
    OP.busy = false;
  }
  // La carte part dans la direction du lancer, avec la vitesse du geste
  async function throwCard(dir, from, vel) {
    const el = $$('.rv', opReveal)[OP.idx]; if (!el || OP.busy) return;
    OP.busy = true; OP.emit = null; hideBanner(); opener.classList.remove('rays', 'dark');
    const d = dir || (OP.idx % 2 ? 1 : -1), f = from || { x: 0, y: 0, r: 0 };
    const tx = d * (window.innerWidth * .6 + 300), ty = f.y - 80 - Math.abs(vel || 0) * 40;
    el.classList.add('dragging');
    const anim = el.animate([
      { transform: 'translate(' + f.x + 'px,' + f.y + 'px) rotate(' + f.r + 'deg)', opacity: 1 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) rotate(' + (d * 34) + 'deg)', opacity: 0 }
    ], { duration: 520, easing: 'cubic-bezier(.2,.7,.35,1)', fill: 'forwards' });
    OP.idx++; markCur();
    await sleep(220); OP.busy = false;
    anim.onfinish = function () { el.classList.add('out'); };
    if (OP.idx >= OP.list.length) { await sleep(250); showSummary(); }
  }
  // Glisser la carte révélée : elle suit le doigt, puis part si le geste est assez franc, sinon revient
  let rvDrag = null;
  opReveal.addEventListener('pointerdown', function (e) {
    if (OP.phase !== 'reveal' || OP.busy) return;
    const el = $$('.rv', opReveal)[OP.idx]; if (!el) return;
    opReveal.setPointerCapture(e.pointerId);
    rvDrag = { el: el, x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, lt: performance.now(), v: 0, moved: false };
  });
  opReveal.addEventListener('pointermove', function (e) {
    const el = $$('.rv', opReveal)[OP.idx];
    if (el && el.classList.contains('face') && !OP.busy) {
      const r = opReveal.getBoundingClientRect();
      cardTilt.tgt = { x: clamp((e.clientX - r.left) / r.width - .5, -.5, .5), y: clamp((e.clientY - r.top) / r.height - .5, -.5, .5), o: 1 }; smKick();
    }
    if (!rvDrag || !rvDrag.el.classList.contains('face')) return;
    const dx = e.clientX - rvDrag.x, dy = e.clientY - rvDrag.y, now = performance.now();
    rvDrag.v = (e.clientX - rvDrag.lx) / Math.max(1, now - rvDrag.lt); rvDrag.lx = e.clientX; rvDrag.lt = now;
    if (!rvDrag.moved && Math.hypot(dx, dy) > 8) { rvDrag.moved = true; rvDrag.el.classList.add('dragging'); }
    if (rvDrag.moved) rvDrag.el.style.transform = 'translate(' + dx + 'px,' + (dy * .35) + 'px) rotate(' + (dx * .06) + 'deg)';
  });
  function rvEnd(e) {
    if (!rvDrag) return; const g = rvDrag; rvDrag = null;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved) { advance(); return; }
    if (Math.abs(dx) > 90 || Math.abs(g.v) > .55) { throwCard(dx > 0 ? 1 : -1, { x: dx, y: dy * .35, r: dx * .06 }, g.v); return; }
    // Retour élastique
    const el = g.el; el.style.transform = '';
    el.animate([{ transform: 'translate(' + dx + 'px,' + (dy * .35) + 'px) rotate(' + (dx * .06) + 'deg)' }, { transform: getComputedStyle(el).transform }], { duration: 450, easing: 'cubic-bezier(.3,1.6,.5,1)' }).onfinish = function () { el.classList.remove('dragging'); };
  }
  opReveal.addEventListener('pointerup', rvEnd);
  opReveal.addEventListener('pointercancel', rvEnd);
  opReveal.addEventListener('pointerleave', function () { cardTilt.tgt = { x: 0, y: 0, o: 0 }; smKick(); });
  function advance(dir) {
    if (OP.phase !== 'reveal' || OP.busy) return;
    const el = $$('.rv', opReveal)[OP.idx]; if (!el) return;
    if (el.classList.contains('face')) throwCard(dir); else revealCur();
  }
  document.addEventListener('keydown', function (e) {
    if (opener.hidden || OP.phase !== 'reveal') return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
  });

  // ---------- Récapitulatif ----------
  function showSummary() {
    const res = OP.res; if (!res || OP.phase === 'sum') return;
    OP.phase = 'sum'; OP.emit = null; OP.busy = false;
    opener.classList.remove('rays', 'dark'); hideBanner();
    opReveal.hidden = true; $('#opCount').hidden = true;
    $('#opCards').innerHTML = OP.list.map(function (x, k) {
      const c = x.c;
      return '<button class="op-card" type="button" data-card="' + c.num + '" data-r="' + c.rarity + '" style="--i:' + k + '" aria-label="Voir ' + esc(c.name) + '">' +
        '<div class="cc ' + finish(c) + '" style="' + cardStyle(c) + '">' + cardInner(c) + corners(c) + '</div>' + (x.neu ? '<span class="newtag">NOUVELLE</span>' : '') + '</button>';
    }).join('');
    const nb = res.nouvelles.length;
    $('#opSum').innerHTML = '<span>Score du booster <b>' + fmt(res.score) + '</b></span><span class="gain"><i class="coin"></i><b>+' + fmt(res.score) + '</b> pièces</span><span>' + (nb ? '<b>' + nb + '</b> nouvelle' + (nb > 1 ? 's' : '') + ' carte' + (nb > 1 ? 's' : '') : 'Aucune nouvelle carte') + '</span>';
    $('#opSumWrap').hidden = false;
    $('#opHint').textContent = 'Touche une carte pour la voir en grand';
    opButtons(['next', 'close']);
    bump('#coinChip');
  }

  // =====================================================================
  // Roue du jour
  // =====================================================================
  const WHEEL = [1, 0, 2, 1, 3, 1, 4, 2];       // 8 cases affichées (valeurs = boosters)
  const WCOL = ['#4b2a8c', '#241a45', '#6a3fc4', '#4b2a8c', '#b46bff', '#3a2a6e', '#f2c25b', '#6a3fc4'];
  let wheelRot = 0;
  function buildWheel() {
    const n = WHEEL.length, step = 360 / n;
    $('#wheel').style.background = 'conic-gradient(' + WHEEL.map(function (v, i) { return WCOL[i] + ' ' + (i * step) + 'deg ' + ((i + 1) * step) + 'deg'; }).join(',') + ')';
    $('#wheel').innerHTML = WHEEL.map(function (v, i) {
      const a = ((i + .5) * step - 90) * Math.PI / 180;
      return '<span style="left:' + (50 + 36 * Math.cos(a)).toFixed(2) + '%;top:' + (50 + 36 * Math.sin(a)).toFixed(2) + '%;transform:translate(-50%,-50%) rotate(' + ((i + .5) * step) + 'deg)">' + v + '</span>';
    }).join('');
  }
  function openWheel() {
    if (!USER) { openAuth('signup'); return; }
    $('#wheelRes').innerHTML = 'Lance la roue pour gagner de 0 à 4 boosters.'; $('#wheelSpin').disabled = false;
    openModal('#wheelModal');
  }
  async function spinWheel() {
    const b = $('#wheelSpin'); if (b.disabled) return; b.disabled = true;
    try {
      const r = await rpc('tourner_roue');
      const cand = WHEEL.map(function (v, i) { return v === r.gagne ? i : -1; }).filter(function (i) { return i >= 0; });
      const idx = cand[Math.floor(Math.random() * cand.length)], step = 360 / WHEEL.length;
      const target = 360 - (idx + .5) * step + (Math.random() - .5) * step * .6;
      wheelRot = wheelRot - (wheelRot % 360) + 360 * 6 + target;
      $('#wheel').style.transform = 'rotate(' + wheelRot + 'deg)';
      await sleep(4700);
      $('#wheelRes').innerHTML = r.gagne ? 'Tu gagnes <b>' + r.gagne + ' booster' + (r.gagne > 1 ? 's' : '') + '</b> !' : 'Pas de chance cette fois. Reviens demain !';
      if (r.gagne) bump('#packChip');
      refresh();
    } catch (e) { $('#wheelRes').textContent = e.message; }
  }

  // =====================================================================
  // Actions
  // =====================================================================
  document.addEventListener('click', async function (e) {
    const t = e.target.closest('button, a');
    if (!t) return;
    const a = t.dataset.action;
    if (a === 'login') { openAuth('login'); return; }
    if (a === 'signup') { openAuth('signup'); return; }
    if (a === 'logout') { logout(); return; }
    if (a === 'forgot') { forgot(); return; }
    if (a === 'open') { startOpen(); return; }
    if (a === 'wheel') { openWheel(); return; }
    if (t.dataset.authTab) { setAuthTab(t.dataset.authTab); return; }
    if (t.dataset.oauth) { oauth(t.dataset.oauth); return; }
    if (t.dataset.closeModal !== undefined) { closeModal(t.closest('.modal')); return; }
    if (t.id === 'wheelSpin') { spinWheel(); return; }
    if (t.dataset.op === 'skip') { showSummary(); return; }
    if (t.dataset.testBoosters) {
      t.disabled = true;
      try { await rpc('test_boosters', { n: +t.dataset.testBoosters }); toast('+' + t.dataset.testBoosters + ' booster' + (+t.dataset.testBoosters > 1 ? 's' : '') + ' ajouté' + (+t.dataset.testBoosters > 1 ? 's' : '') + '.'); bump('#packChip'); await refresh(); } catch (err) { toast(err.message, true); }
      t.disabled = false; return;
    }
    if (t.dataset.op === 'next') { openerShow(); return; }
    if (t.dataset.op === 'close') { openerHide(); return; }
    if (t.dataset.setLink) { F.set = t.dataset.setLink; F.rarity = t.dataset.rarLink || 'all'; renderCollection(); }
    if (a === 'claim-free') {
      t.disabled = true;
      try { await rpc('recuperer_gratuit'); toast('Booster gratuit récupéré.'); bump('#packChip'); await refresh(); } catch (err) { toast(err.message, true); }
      t.disabled = false; return;
    }
    if (t.dataset.buy) {
      t.disabled = true;
      try { await rpc('acheter_boosters', { quantite: +t.dataset.buy }); toast(+t.dataset.buy === 1 ? 'Booster ajouté.' : '5 boosters ajoutés.'); bump('#coinChip'); bump('#packChip'); await refresh(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.quest) {
      t.disabled = true;
      try { const r = await rpc('recuperer_quete', { q: t.dataset.quest }); toast('Quête récupérée' + (r.pieces ? ' : +' + r.pieces + ' pièces' : '') + (r.boosters ? ' : +' + r.boosters + ' booster' + (r.boosters > 1 ? 's' : '') : '') + '.'); await refresh(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.reward) {
      t.disabled = true;
      try { const r = await rpc('recuperer_recompense', { r: t.dataset.reward }); toast('Récompense : ' + (r.pieces ? '+' + fmt(r.pieces) + ' pièces ' : '') + (r.boosters ? '+' + r.boosters + ' boosters' : '')); await refresh(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.fset) { F.set = t.dataset.fset; renderCollection(); }
    if (t.dataset.frar) { F.rarity = t.dataset.frar; renderCollection(); }
    if (t.dataset.board) { board = t.dataset.board; boardRows = null; renderBoard(); loadBoard(); }
    if (t.dataset.card) { openCard(t.dataset.card); return; }
    if (t.dataset.closeCard !== undefined) { closeCard(); return; }
  });
  $('#heroPack').addEventListener('click', function () { if (USER && S && S.boosters > 0) { startOpen(); return; } const p = this; p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); });
  $('#heroPack').addEventListener('animationend', function (e) { if (e.animationName === 'shake') this.classList.remove('shake'); });
  $('#demoBar').addEventListener('click', function () { this.hidden = true; });
  $('#ownedOnly').addEventListener('change', function () { F.ownedOnly = this.checked; renderCollection(); });
  $('#heroPack').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#cardModal').classList.contains('open')) { closeCard(); return; }
    const m = $('#authModal.open, #wheelModal.open'); if (m) closeModal(m);
  });

  // =====================================================================
  // Démarrage
  // =====================================================================
  buildWheel();
  setInterval(renderBinds, 1000);
  renderAll(); route();
  (async function init() {
    if (!ONLINE) { const u = DEMO.user(); if (u) await setUser(u); return; }
    sb.auth.onAuthStateChange(function (ev, session) {
      if (ev === 'PASSWORD_RECOVERY') { openModal('#pwdModal'); }
      const u = session ? session.user : null;
      if ((u ? u.email : null) !== (USER ? USER.email : null)) setTimeout(function () { setUser(u); }, 0);
    });
    const r = await sb.auth.getSession();
    // Erreur renvoyée dans l'adresse après une connexion Google/Discord refusée
    const q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    if (q.get('error_description')) { toast(q.get('error_description').replace(/\+/g, ' '), true); history.replaceState(null, '', SITE); }
    if (r.data.session) await setUser(r.data.session.user);
  })();
})();

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
    // Marché de démo, généré une fois puis gardé dans le navigateur
    function mkSave(m) { try { localStorage.setItem(K + '-mk', JSON.stringify(m)); } catch (e) {} }
    function mkDemo() {
      let m = null; try { m = JSON.parse(localStorage.getItem(K + '-mk') || 'null'); } catch (e) {}
      if (m) return m;
      m = { n: 0, ann: [], ventes: [] }; const now = Date.now() / 1000, base = { common: 20, uncommon: 40, epic: 150, legend: 600, secret: 1500, goat: 20000 }, names = ['Kevin', 'Lea_99', 'Shadow', 'Nyx', 'Max.R', 'Zed'];
      CATALOG.filter(function (c, i) { return i % 6 === 0 || c.rarity === 'goat' || c.rarity === 'secret'; }).forEach(function (c) {
        let p = base[c.rarity] * (.7 + Math.random() * .8); const n = 6 + Math.floor(Math.random() * 18);
        for (let i = 0; i < n; i++) { p = Math.max(10, p * (1 + (Math.random() - .47) * .18)); m.ventes.push({ carte: c.id, prix: Math.round(p), t: now - (n - i) * (30 * 86400 / n) * (.8 + Math.random() * .4) }); }
        const k = Math.floor(Math.random() * 4); for (let j = 0; j < k; j++) m.ann.push({ id: ++m.n, carte: c.id, prix: Math.round(p * (1 + Math.random() * .25)), vendeur: names[Math.floor(Math.random() * names.length)] });
      });
      mkSave(m); return m;
    }
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
          prix: { un: 200, cinq: 900 }, collection: d.col, avatar: d.avatar || null, vitrine: d.vitrine || [], banniere: d.ban || 'g-nuit', titre: d.titre || 'recrue', titres: titresDe(d.col, d.ouverts, 0),
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
          const rar = (i === 5 && d.forced) ? d.forced : pick(CH), pool = CATALOG.filter(function (c) { return c.rarity === rar; }), c = pool[Math.floor(Math.random() * pool.length)];
          cartes.push(c.id); if (!d.col[c.id] && nouvelles.indexOf(c.id) < 0) nouvelles.push(c.id); d.col[c.id] = (d.col[c.id] || 0) + 1;
          score += RAR.find(function (r) { return r.id === rar; }).pts; if (RORDER[rar] >= 2) best = true;
        }
        d.forced = null;
        d.pieces += score; quest(d, 'ouvrir3', 1); quest(d, 'ouvrir10', 1); if (best) quest(d, 'epique', 1); save(d);
        return { cartes: cartes, nouvelles: nouvelles, score: score };
      },
      recuperer_quete: function (a) { const d = me(), q = QS.find(function (x) { return x[0] === a.q; }), st = d.q[a.q]; if (!q || !st || st.ok || st.p < q[2]) throw new Error('Quête pas encore terminée ou déjà récupérée.'); st.ok = true; d.pieces += q[3]; d.boosters += q[4]; save(d); return { pieces: q[3], boosters: q[4] }; },
      recuperer_recompense: function (a) { const d = me(), r = RW.find(function (x) { return x[0] === a.r; }); if (!r) throw new Error('Récompense inconnue.'); const m = total(r[2]) - owned(d, r[2]); if (m > 0) throw new Error('Il te manque encore ' + m + ' carte(s).'); if (d.rw[a.r]) throw new Error('Récompense déjà récupérée.'); d.rw[a.r] = 1; d.pieces += r[3]; d.boosters += r[4]; save(d); return { pieces: r[3], boosters: r[4] }; },
      classement: function () { const d = load(); if (!d) return []; let sc = 0, lg = 0, n = 0; Object.keys(d.col).forEach(function (id) { const c = BY_ID[id]; if (!c) return; n++; sc += RAR.find(function (r) { return r.id === c.rarity; }).pts; if (RORDER[c.rarity] >= 3) lg++; }); return [{ pseudo: d.pseudo, score: sc, legendaires: lg, cartes: n, avatar: d.col[d.avatar] ? d.avatar : null, titre: d.titre || 'recrue' }]; },
      pseudo_libre: function (a) { return NAME_OK.test(a.p); },
      suis_testeur: function () { return !!load(); },
      test_boosters: function (a) { const d = me(); d.boosters += a.n; save(d); return d.boosters; },
      // Marché simulé (démo locale) : quelques vendeurs fictifs et un historique de ventes
      marche: function () { const m = mkDemo(), now = Date.now() / 1000, ids = {};
        m.ann.forEach(function (a) { ids[a.carte] = 1; }); m.ventes.forEach(function (v) { ids[v.carte] = 1; });
        return Object.keys(ids).map(function (id) { id = +id; const an = m.ann.filter(function (a) { return a.carte === id; }), vs = m.ventes.filter(function (v) { return v.carte === id; }).sort(function (x, y) { return x.t - y.t; });
          const old = vs.filter(function (v) { return v.t <= now - 86400; });
          return { carte: id, annonces: an.length, prix_min: an.length ? Math.min.apply(null, an.map(function (a) { return a.prix; })) : null, dernier: vs.length ? vs[vs.length - 1].prix : null, ref_24h: old.length ? old[old.length - 1].prix : null, ventes_7j: vs.filter(function (v) { return v.t > now - 7 * 86400; }).length, spark: vs.slice(-20).map(function (v) { return v.prix; }) }; }); },
      fiche_marche: function (a) { const m = mkDemo(), vs = m.ventes.filter(function (v) { return v.carte === a.p_carte; }).sort(function (x, y) { return x.t - y.t; }), ps = vs.map(function (v) { return v.prix; });
        return { annonces: m.ann.filter(function (x) { return x.carte === a.p_carte; }).sort(function (x, y) { return x.prix - y.prix; }).map(function (x) { return { id: x.id, prix: x.prix, vendeur: x.vendeur, moi: !!x.moi }; }),
          cours: vs.filter(function (v) { return v.t > Date.now() / 1000 - 30 * 86400; }).map(function (v) { return [v.t, v.prix]; }), plus_haut: ps.length ? Math.max.apply(null, ps) : null, plus_bas: ps.length ? Math.min.apply(null, ps) : null, volume: vs.length, taxe: 5 }; },
      mes_annonces: function () { return mkDemo().ann.filter(function (a) { return a.moi; }); },
      mettre_en_vente: function (a) { const d = me(), m = mkDemo(); if (!d.col[a.p_carte]) throw new Error('Tu ne possèdes pas cette carte.'); if (a.p_prix < 10 || a.p_prix > 1e6) throw new Error('Prix entre 10 et 1000000 pièces.');
        d.col[a.p_carte]--; if (!d.col[a.p_carte]) delete d.col[a.p_carte]; save(d); m.ann.push({ id: ++m.n, carte: a.p_carte, prix: a.p_prix, vendeur: d.pseudo, moi: true }); mkSave(m); return m.n; },
      retirer_annonce: function (a) { const d = me(), m = mkDemo(), x = m.ann.find(function (y) { return y.id === a.p_id && y.moi; }); if (!x) throw new Error('Annonce introuvable.');
        m.ann = m.ann.filter(function (y) { return y !== x; }); d.col[x.carte] = (d.col[x.carte] || 0) + 1; save(d); mkSave(m); },
      acheter_annonce: function (a) { const d = me(), m = mkDemo(), x = m.ann.find(function (y) { return y.id === a.p_id; }); if (!x) throw new Error('Cette carte vient d\'être vendue ou retirée.'); if (x.moi) throw new Error('C\'est ta propre annonce.'); if (d.pieces < x.prix) throw new Error('Pas assez de pièces.');
        d.pieces -= x.prix; d.col[x.carte] = (d.col[x.carte] || 0) + 1; save(d); m.ann = m.ann.filter(function (y) { return y !== x; }); m.ventes.push({ carte: x.carte, prix: x.prix, t: Date.now() / 1000 }); mkSave(m); return { carte: x.carte, prix: x.prix }; },
      test_truquer: function (a) { const d = me(); d.forced = a.r || null; save(d); return a.r; },
      modifier_profil: function (a) {
        const d = me();
        if (a.p_avatar != null) { if (a.p_avatar === 0) d.avatar = null; else if (d.col[a.p_avatar]) d.avatar = a.p_avatar; else throw new Error('Tu ne possèdes pas cette carte.'); }
        if (a.p_vitrine) { if (a.p_vitrine.length > 5) throw new Error('La vitrine contient 5 cartes maximum.'); if (a.p_vitrine.some(function (x) { return !d.col[x]; })) throw new Error('Tu ne possèdes pas une des cartes de la vitrine.'); d.vitrine = a.p_vitrine.slice(); }
        if (a.p_banniere) d.ban = a.p_banniere;
        if (a.p_titre) { if (titresDe(d.col, d.ouverts, 0).indexOf(a.p_titre) < 0) throw new Error('Titre pas encore débloqué.'); d.titre = a.p_titre; }
        save(d); return { avatar: d.avatar || null, vitrine: d.vitrine || [], banniere: d.ban || 'g-nuit', titre: d.titre || 'recrue', titres: titresDe(d.col, d.ouverts, 0) };
      },
      profil_public: function (a) {
        const d = load(); if (!d || !d.pseudo || d.pseudo.toLowerCase() !== String(a.p_pseudo || '').toLowerCase()) return null;
        const pr = {}; let sc = 0, n = 0; Object.keys(d.col).forEach(function (id) { const c = BY_ID[id]; if (!c) return; n++; pr[c.rarity] = (pr[c.rarity] || 0) + 1; sc += RAR.find(function (r) { return r.id === c.rarity; }).pts; });
        return { pseudo: d.pseudo, cree_le: d.cree, ouverts: d.ouverts, avatar: d.col[d.avatar] ? d.avatar : null, vitrine: (d.vitrine || []).filter(function (x) { return d.col[x]; }), banniere: d.ban || 'g-nuit', titre: d.titre || 'recrue', titres: titresDe(d.col, d.ouverts, 0), score: sc, cartes: n, par_rarete: pr, ventes: 0, rang: 1, joueurs: 1 };
      },
      test_toutes_cartes: function () { const d = me(); let n = 0; CATALOG.forEach(function (c) { if (!d.col[c.id]) { d.col[c.id] = 1; n++; } }); save(d); return n; }
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
  // ---------- GOAT : carte en profondeur (fond du jeu, joueur détouré qui sort du cadre) ----------
  const G3 = { Faker: ['6× champion du monde', '#e2012d'], ZywOo: ['3× champion du Major', '#f5c935'], Kaydop: ['3× champion du monde', '#5aa9ff'], Shotzzy: ['3× champion du monde', '#92c83e'], N0tail: ['2× champion de The International', '#e84a3a'] };
  const CROWN = '<svg class="g3-crown" viewBox="0 0 40 28" aria-hidden="true"><path d="M3 24 L1 6 L11 14 L20 2 L29 14 L39 6 L37 24 Z"/><rect x="3" y="23" width="34" height="4" rx="1"/></svg>';
  function goatInner(c) {
    const g = G3[c.name] || ['', '#f2c25b'], slug = c.name.toLowerCase();
    return '<span class="g3-holo"></span><span class="g3-clip" style="--c:' + g[1] + '"><span class="g3-bg" style="background-image:url(assets/goat/' + slug + '-1.webp?v=1)"></span><span class="g3-dust far"></span><span class="g3-light"></span>' +
      '<span class="g3-beam a"></span><span class="g3-beam b"></span><span class="g3-word">GOAT</span><span class="g3-dust"></span></span>' +
      '<img class="g3-cut" src="assets/goat/cut-' + slug + '.webp?v=1" alt="' + esc(c.name) + '" loading="lazy"><span class="g3-shade"></span>' + CROWN +
      '<span class="g3-tag"><b>GOAT</b><small>HORS SÉRIE</small></span><span class="cc-ed">PREMIÈRE ÉDITION</span>' +
      '<span class="g3-plate"><small>Greatest of all time</small><b>' + esc(c.name) + '</b><span class="g3-meta">' + esc(c.game) + (c.year ? ' · ' + esc(String(c.year)) : '') + '</span>' +
      (g[0] ? '<span class="g3-hook">' + esc(g[0]) + '</span>' : '') + '</span>';
  }
  // ---------- Secrètes : encre invisible, révélée par la lumière ----------
  // Ce que révèle la lumière sur chaque secrète : un détail lié à la carte
  const UV_TXT = {
    151: 'Joué au milieu d\'une LAN party', 152: 'Dendi & Puppey, champions', 153: 'Avec Alpha54 et Radosin', 154: 'Né en 2007',
    155: 'SlayerS_`BoxeR`', 156: '« God » · KT Rolster', 157: 'Le roi des Orcs · 4Kings', 158: 'GeT_RiGhT & f0rest',
    159: 'Londres · Katowice · Berlin', 160: 'Vancouver · Shanghai', 161: 'Le Zerg finlandais qui a battu la Corée', 162: 'Arthur Ashe · New York',
    163: 'Gale Force · Dignitas · Vitality', 164: 'Nº1 mondial HLTV 2019 & 2020', 165: '8 ans entre deux Majors', 166: 'Sans perdre une seule map',
    167: 'Accor Arena · 2023', 168: 'Faker l\'a soulevée 6 fois', 169: 'Gagnée 2 fois par OG', 170: 'Astralis l\'a soulevé 4 fois',
    171: 'apEX · ZywOo · ropz · flameZ · mezii', 172: '13 · 15 · 16 · 23 · 24 · 25', 173: 'Champion après 9 ans de carrière', 174: 'Coach devenu champion', 175: 'The French Monster'
  };
  function uvLayer(c) {
    let seed = c.id * 7919 % 2147483647 || 1; const r = function () { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
    let stars = '';
    for (let i = 0; i < 12; i++) { const x = 15 + r() * 310, y = 15 + r() * 320, k = 5 + r() * 9; stars += '<path d="M' + x.toFixed(0) + ' ' + (y - k).toFixed(0) + 'Q' + x.toFixed(0) + ' ' + y.toFixed(0) + ' ' + (x + k).toFixed(0) + ' ' + y.toFixed(0) + 'Q' + x.toFixed(0) + ' ' + y.toFixed(0) + ' ' + x.toFixed(0) + ' ' + (y + k).toFixed(0) + 'Q' + x.toFixed(0) + ' ' + y.toFixed(0) + ' ' + (x - k).toFixed(0) + ' ' + y.toFixed(0) + 'Q' + x.toFixed(0) + ' ' + y.toFixed(0) + ' ' + x.toFixed(0) + ' ' + (y - k).toFixed(0) + 'Z"/>'; }
    const a = 285 + r() * 20, b = 320 + r() * 20;
    const msg = UV_TXT[c.id] || c.game;
    return '<span class="cc-uv" aria-hidden="true"><span class="uv-tint" style="background-image:url(' + c.img + ')"></span><svg viewBox="0 0 340 475" preserveAspectRatio="xMidYMid slice">' +
      '<text x="170" y="250" text-anchor="middle" class="uv-num">' + c.num + '</text><g class="uv-stars">' + stars + '</g>' +
      '<text x="170" y="' + a.toFixed(0) + '" text-anchor="middle" class="uv-msg" style="font-size:' + Math.min(18, 250 / (msg.length * .62)).toFixed(1) + 'px" transform="rotate(-5 170 ' + a.toFixed(0) + ')">' + esc(msg) + '</text>' +
      '<path class="uv-line" d="M56 ' + b.toFixed(0) + ' C 110 ' + (b - 40).toFixed(0) + ', 150 ' + (b + 20).toFixed(0) + ', 200 ' + (b - 20).toFixed(0) + ' S 280 ' + (b - 30).toFixed(0) + ', 300 ' + b.toFixed(0) + '"/></svg></span><span class="cc-lamp"></span>';
  }
  const footFit = function (t) { t = String(t); return t.length > 30 ? ' f-xs' : t.length > 22 ? ' f-s' : ''; };
  function cardInner(c) {
    if (c.rarity === 'goat') return goatInner(c);
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
      (c.img ? '<img' + (c.map ? ' class="is-map' + (c.fade ? ' is-fade' : '') + '"' : c.player ? ' class="is-player"' : c.photo ? ' class="is-photo"' : '') + ' src="' + c.img + '" alt="' + esc(c.name) + '" loading="lazy">' + (c.rarity === 'secret' ? uvLayer(c) : '') : '<span class="cc-todo"><b>' + esc(initialsOf(c.name)) + '</b>Visuel à venir</span>') +
      (goat ? '<span class="cc-num"><b>GOAT</b><small>HORS SÉRIE</small></span>' : '<span class="cc-num"><b>' + n3(c.num) + '</b><small>/' + s.size + '</small></span>') +
      '<span class="cc-tag"><svg><use href="#sym-ori"/></svg>ORIGINES</span><span class="cc-ed">PREMIÈRE ÉDITION</span>' + (c.rarity === 'epic' ? '<span class="cc-spark"></span>' : '') + '</div>' +
      '<div class="cc-band' + (fr ? ' fr' : '') + (story ? ' has-story' : '') + '">' + (c.rarity === 'legend' ? '<span class="cc-crest"><b>★</b> LÉGENDAIRE <b>★</b></span>' : c.rarity === 'secret' ? '<span class="cc-crest"><b>★</b> SECRÈTE <b>★</b></span>' : goat ? '<span class="cc-crest"><b>★★★</b> GREATEST OF ALL TIME <b>★★★</b></span>' : '') + (story ? '<h3>' + esc(title) + '</h3><p class="cc-story">' + esc(story) + '</p>' : '<h3>' + esc(title) + '</h3><p>' + esc(subLine) + '</p>') + '</div>' +
      '<div class="cc-foot' + footFit(story ? subLine : c.type + ' · ' + c.game) + '"><span>' + esc(story ? subLine : c.type + ' · ' + c.game) + '</span><span class="cc-set"><svg><use href="#sym-ori"/></svg>' + numText(c) + '<i></i></span></div></div>';
  }
  // Finition selon la rareté
  const FINISH = { uncommon: 'u-silver u-foil u-holo u-soft', epic: 'e-epic', legend: 'l-legend l-glass', goat: 'g3d', secret: 'l-legend s-secret s-uv' };
  const finish = function (c) { return FINISH[c.rarity] || ''; };
  // Cadre HUD des légendaires : coins coupés, accents dorés sur les angles, losanges au centre
  const HUD = '<svg class="cc-hud" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon class="thin" points="9,3.6 91,3.6 96.4,7.4 96.4,132.6 91,136.4 9,136.4 3.6,132.6 3.6,7.4"/>' +
    '<polyline class="bold" points="3.6,16 3.6,7.4 9,3.6 22,3.6"/><polyline class="bold" points="78,3.6 91,3.6 96.4,7.4 96.4,16"/>' +
    '<polyline class="bold" points="3.6,124 3.6,132.6 9,136.4 22,136.4"/><polyline class="bold" points="78,136.4 91,136.4 96.4,132.6 96.4,124"/>' +
    '<polygon class="gem" points="50,1.9 52.6,3.6 50,5.3 47.4,3.6"/><polygon class="gem" points="50,134.7 52.6,136.4 50,138.1 47.4,136.4"/>' +
    '</svg>';
  const corners = function (c) { return c.rarity === 'legend' || c.rarity === 'secret' ? HUD : ''; };
  function ownedSlot(c, n) {
    return '<button class="cc mini ' + finish(c) + '" type="button" data-card="' + c.num + '" style="' + cardStyle(c) + '" aria-label="' + esc(c.name) + (n > 1 ? ' (×' + n + ')' : '') + '">' + cardInner(c) + corners(c) + (n > 1 ? '<span class="cc-count">×' + n + '</span>' : '') + '</button>';
  }
  function openCard(num) {
    const c = CATALOG.find(function (x) { return String(x.num) === String(num); }), r = RAR.find(function (x) { return x.id === c.rarity; });
    const el = $('#bigCard');
    el.className = 'cc big ' + finish(c);
    el.style.cssText = cardStyle(c);
    el.innerHTML = cardInner(c) + corners(c) + '<span class="cc-holo"></span><span class="cc-glare"></span>';
    if (c.rarity === 'legend' || c.rarity === 'secret') el.querySelector('.cc-panel').insertAdjacentHTML('beforeend', '<span class="cc-glint"></span>');
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
      return '<tr data-player="' + esc(r.pseudo) + '"' + (me ? ' class="me"' : '') + '><td class="rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</td>' +
        '<td><div class="who">' + avatarHTML(r.avatar, r.pseudo) + '<span>' + esc(r.pseudo) + (me ? ' <span class="muted">(toi)</span>' : '') + '</span>' + (r.titre && r.titre !== 'recrue' && TITRE[r.titre] ? titleChip(r.titre, 'sm') : '') + '</div></td>' +
        '<td class="r num">' + fmt(r[key]) + '</td></tr>';
    }).join('');
  }

  // =====================================================================
  // Profil : photo (une carte possédée), vitrine, bannière, titre
  // =====================================================================
  const TITRES = [
    ['recrue', 'Recrue', 'Dès l\'inscription'],
    ['collectionneur', 'Collectionneur', '50 cartes différentes'],
    ['archiviste', 'Archiviste', '150 cartes différentes'],
    ['legendes', 'Chasseur de légendes', '5 légendaires'],
    ['secrets', 'Gardien des secrets', '10 secrètes'],
    ['goat', 'Chasseur de GOAT', '1 carte GOAT'],
    ['marchand', 'Marchand', '10 ventes au marché'],
    ['ouvreur', 'Ouvreur fou', '100 boosters ouverts'],
    ['maitre', 'Maître d\'Origines', 'La série Origines complète']
  ];
  const TITRE = {}; TITRES.forEach(function (t) { TITRE[t[0]] = t; });
  const BANS = [['g-nuit', 'Nuit'], ['g-braise', 'Braise'], ['g-ocean', 'Océan'], ['g-neon', 'Néon'], ['g-or', 'Or']];
  // Mêmes règles que le serveur (_titres), pour la démo et l'affichage immédiat
  function titresDe(col, ouverts, ventes) {
    let n = 0, leg = 0, sec = 0, goat = 0, ori = 0, oriTot = 0;
    CATALOG.forEach(function (c) { if (c.rarity !== 'goat') oriTot++; if (!col || !col[c.id]) return; n++; if (c.rarity === 'legend') leg++; if (c.rarity === 'secret') sec++; if (c.rarity === 'goat') goat++; else ori++; });
    return TITRES.map(function (t) { return t[0]; }).filter(function (k) {
      return k === 'recrue' || (k === 'collectionneur' && n >= 50) || (k === 'archiviste' && n >= 150) || (k === 'legendes' && leg >= 5) || (k === 'secrets' && sec >= 10) ||
        (k === 'goat' && goat >= 1) || (k === 'marchand' && ventes >= 10) || (k === 'ouvreur' && ouverts >= 100) || (k === 'maitre' && ori >= oriTot);
    });
  }
  const titleChip = function (k, sm) { const t = TITRE[k] || TITRE.recrue; return '<span class="ttl t-' + t[0] + (sm ? ' sm' : '') + '">' + esc(t[1]) + '</span>'; };
  const BIG = { legend: 1, secret: 1, goat: 1 };
  // Avatar : le visuel d'une carte, recadré (photo, joueur ou logo sur le fond de la carte)
  function avatarParts(id, pseudo) {
    const c = id && BY_ID[id];
    if (!c || !c.img) return { cls: '', style: '', html: esc(initials(pseudo)) };
    const rgb = hexRgb(c.color || RHEX[c.rarity]), W = [255, 255, 255], K = [0, 0, 0];
    const logo = !c.photo && !c.player;
    const bg = c.photo ? '#111' : c.dark ? 'linear-gradient(160deg,' + mixc(rgb, K, .3) + ',' + mixc(rgb, K, .68) + ')' : 'linear-gradient(160deg,' + mixc(rgb, W, .85) + ',' + mixc(rgb, W, .45) + ')';
    return { cls: ' has-card r-' + c.rarity, style: '--avbg:' + bg + (BIG[c.rarity] ? ';--avr:' + RHEX[c.rarity] : ''),
      html: '<img' + (c.rarity === 'goat' ? ' class="av-goat"' : logo ? ' class="av-logo"' : c.player ? ' class="av-player"' : '') + ' src="' + c.img + '" alt="" loading="lazy">' };
  }
  function avatarHTML(id, pseudo, cls) { const a = avatarParts(id, pseudo); return '<span class="avatar' + (cls ? ' ' + cls : '') + a.cls + '" style="' + a.style + '">' + a.html + '</span>'; }
  function myAvatar() { return S && S.avatar && owns(S.avatar) ? S.avatar : null; }
  function renderMe() {
    const id = myAvatar(), key = id + '|' + (S && S.pseudo);
    $$('[data-avatar-me]').forEach(function (el) {
      if (el._k === key) return; el._k = key;
      const a = avatarParts(id, S && S.pseudo);
      el.className = 'avatar' + a.cls; el.style.cssText = a.style; el.innerHTML = a.html;
    });
    if (!$('[data-view="profil"]').hidden) { if (S && S.pseudo && !PF.mine && !PF.busy) loadMine(); else renderMine(); }
  }
  function bannerParts(b) {
    const m = /^c-(\d+)$/.exec(b || ''), c = m && BY_ID[m[1]];
    if (c && c.img) return { cls: 'b-g-nuit', img: '<img' + (c.rarity === 'goat' ? ' class="goat"' : '') + ' src="' + c.img + '" alt="">', style: '--bgrad:' + (c.color || RHEX[c.rarity]) };
    return { cls: 'b-' + (BANS.some(function (x) { return x[0] === b; }) ? b : 'g-nuit'), img: '', style: '' };
  }
  const RLABEL = { common: 'Communes', uncommon: 'Peu communes', epic: 'Épiques', legend: 'Légendaires', secret: 'Secrètes', goat: 'GOAT' };
  function profileHTML(P, mine) {
    const b = bannerParts(P.banniere), vit = P.vitrine || [], has = P.titres || ['recrue'];
    const isMe = S && S.pseudo && P.pseudo.toLowerCase() === S.pseudo.toLowerCase();
    const tot = {}; CATALOG.forEach(function (c) { tot[c.rarity] = (tot[c.rarity] || 0) + 1; });
    const pr = P.par_rarete || {};
    const share = '<button class="btn btn-dark btn-sm" type="button" data-pf-share="' + esc(P.pseudo) + '">Partager</button>';
    let slots = '';
    for (let i = 0; i < 5; i++) {
      const c = BY_ID[vit[i]];
      slots += c ? ownedSlot(c, 1) : mine ? '<button class="pf-slot" type="button" data-pf-open="vitrine">+<br>Exposer une carte</button>' : '<div class="pf-slot">Vide</div>';
    }
    return '<section class="pf">' +
      '<div class="pf-banner ' + b.cls + '" style="' + b.style + '">' + b.img + '<span class="pf-grid"></span></div>' +
      '<div class="pf-head">' + avatarHTML(P.avatar, P.pseudo) +
        '<div class="pf-id">' + titleChip(P.titre) + '<h1>' + esc(P.pseudo) + '</h1>' +
          '<div class="pf-meta"><span>Inscrit le <b>' + new Date(P.cree_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '</b></span>' +
          (P.rang ? '<span><b>#' + fmt(P.rang) + '</b> sur ' + fmt(P.joueurs) + ' joueur' + (P.joueurs > 1 ? 's' : '') + '</span>' : '') + '</div></div>' +
        '<div class="pf-actions">' + (mine ? '<button class="btn btn-gold btn-sm" type="button" data-pf-open="avatar">Personnaliser</button>' : isMe ? '<a class="btn btn-gold btn-sm" href="#profil">Modifier</a>' : '') + share + '</div>' +
      '</div>' +
      '<div class="pf-stats">' +
        '<div class="gold"><b>' + (P.rang ? '#' + fmt(P.rang) : '—') + '</b><span>Classement</span></div>' +
        '<div><b>' + fmt(P.score || 0) + '</b><span>Score de collection</span></div>' +
        '<div><b>' + fmt(P.cartes || 0) + '<small>/' + CATALOG.length + '</small></b><span>Cartes différentes</span></div>' +
        '<div><b>' + fmt(P.ouverts || 0) + '</b><span>Boosters ouverts</span></div>' +
        '<div><b>' + (P.ventes == null ? '—' : fmt(P.ventes)) + '</b><span>Ventes au marché</span></div>' +
      '</div></section>' +
      '<section class="panel" style="margin-bottom:22px"><div class="panel-head"><h2>Vitrine</h2>' + (mine ? '<button class="btn btn-ghost btn-sm" type="button" data-pf-open="vitrine">Modifier la vitrine</button>' : '<span class="eyebrow">Ses plus belles cartes</span>') + '</div>' +
        '<div class="pf-shelf">' + slots + '</div></section>' +
      '<div class="pf-cols">' +
        '<section class="panel"><div class="panel-head"><h2>Collection</h2><span class="eyebrow">' + fmt(P.cartes || 0) + ' / ' + CATALOG.length + '</span></div><div class="pf-rars">' +
          RAR.filter(function (r) { return tot[r.id]; }).map(function (r) { const n = pr[r.id] || 0; return '<div class="pf-rar" style="--rc:' + (RHEX[r.id] || r.color) + '"><span>' + (RLABEL[r.id] || r.name) + '</span><div class="track"><i style="width:' + (n / tot[r.id] * 100).toFixed(1) + '%"></i></div><span class="num">' + n + '/' + tot[r.id] + '</span></div>'; }).join('') +
        '</div></section>' +
        '<section class="panel"><div class="panel-head"><h2>Titres</h2><span class="eyebrow">' + has.length + ' / ' + TITRES.length + '</span></div><div class="pf-titles">' +
          TITRES.map(function (t) { const ok = has.indexOf(t[0]) >= 0; return '<div class="pf-tl' + (ok ? '' : ' locked') + '">' + titleChip(t[0], 1) + '<small>' + (ok ? 'Débloqué' : esc(t[2])) + '</small></div>'; }).join('') +
        '</div></section>' +
      '</div>';
  }
  // Mon profil : l'état local (immédiat) complété par le rang et les ventes venus du serveur
  const PF = { mine: null, pub: null, busy: false };
  function myProfile() {
    const pr = {}; Object.keys(S.collection || {}).forEach(function (id) { const c = BY_ID[id]; if (c) pr[c.rarity] = (pr[c.rarity] || 0) + 1; });
    const x = PF.mine || {};
    return { pseudo: S.pseudo || 'Joueur', cree_le: S.cree_le, ouverts: S.ouverts, avatar: myAvatar(), vitrine: (S.vitrine || []).filter(owns),
      banniere: S.banniere, titre: S.titre, titres: S.titres, score: collScore(), cartes: ownedCount(), par_rarete: pr, ventes: x.ventes, rang: x.rang, joueurs: x.joueurs };
  }
  function renderMine() { if (S) $('#pfMine').innerHTML = profileHTML(myProfile(), true); }
  async function loadMine() {
    renderMine();
    if (!S || !S.pseudo || PF.busy) return;
    PF.busy = true;
    try { PF.mine = await rpc('profil_public', { p_pseudo: S.pseudo }); } catch (e) {}
    PF.busy = false;
    renderMine();
  }
  async function loadPublic(pseudo) {
    const el = $('#pfPublic');
    el.innerHTML = '<div class="pf-404 muted">Chargement du profil…</div>';
    let P = null;
    try { P = await rpc('profil_public', { p_pseudo: pseudo }); } catch (e) { toast(e.message, true); }
    if (location.hash.slice(1).split('/')[0] !== 'joueur') return;
    if (!P) { el.innerHTML = '<div class="pf-404"><h1>Joueur introuvable</h1><p class="muted">Aucun joueur ne s\'appelle « ' + esc(pseudo) + ' ».</p><a class="btn btn-light" href="#classement">Voir le classement</a></div>'; return; }
    PF.pub = P; el.innerHTML = profileHTML(P, false);
  }

  // ---------- Fenêtre « Personnaliser » ----------
  const PFE = { tab: 'avatar', avatar: null, vitrine: [], banniere: 'g-nuit', titre: 'recrue', q: '', rar: 'all' };
  function openPf(tab) {
    if (!S) return;
    Object.assign(PFE, { tab: tab || 'avatar', avatar: myAvatar(), vitrine: (S.vitrine || []).filter(owns), banniere: S.banniere || 'g-nuit', titre: S.titre || 'recrue', q: '', rar: 'all' });
    $('#pfSearch').value = '';
    openModal('#pfModal'); renderPf();
  }
  function closePf() { closeModal($('#pfModal')); }
  const rankSort = function (a, b) { return (RORDER[b.rarity] - RORDER[a.rarity]) || (a.id - b.id); };
  function pfCards(needImg) {
    const q = PFE.q.trim().toLowerCase();
    return CATALOG.filter(function (c) { return owns(c.id) && (!needImg || c.img) && (PFE.rar === 'all' || c.rarity === PFE.rar) && (!q || (c.name + ' ' + c.game).toLowerCase().indexOf(q) >= 0); }).sort(rankSort);
  }
  function renderPf() {
    const t = PFE.tab;
    $$('#pfTabs button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.pfTab === t); });
    // Aperçu
    const b = bannerParts(PFE.banniere);
    const pv = $('#pfPreview'); pv.className = 'pf-preview ' + b.cls; pv.style.cssText = b.style;
    pv.innerHTML = b.img + avatarHTML(PFE.avatar, S.pseudo) + '<div class="pv-id">' + titleChip(PFE.titre, 1) + '<b>' + esc(S.pseudo || 'Joueur') + '</b></div>' +
      '<div class="pv-shelf">' + [0, 1, 2, 3, 4].map(function (i) { const c = BY_ID[PFE.vitrine[i]]; return c ? '<i class="on" style="--rc:' + RHEX[c.rarity] + ';' + (c.img ? 'background-image:url(\'' + c.img + '\')' : '') + '"></i>' : '<i></i>'; }).join('') + '</div>';
    const cardsTab = t === 'avatar' || t === 'vitrine';
    $('#pfTools').hidden = !cardsTab;
    $('#pfRar').innerHTML = [['all', 'Toutes']].concat(RAR.slice().reverse().map(function (r) { return [r.id, RLABEL[r.id] || r.name]; })).filter(function (r) { return r[0] === 'all' || CATALOG.some(function (c) { return c.rarity === r[0]; }); })
      .map(function (r) { return '<button type="button" data-pf-rar="' + r[0] + '" aria-pressed="' + (PFE.rar === r[0]) + '">' + r[1] + '</button>'; }).join('');
    const pick = $('#pfPick'); let h = '';
    if (t === 'avatar') {
      pick.className = 'pf-pick';
      $('#pfHelp').textContent = 'Ta photo de profil : le visuel d\'une de tes cartes. Les grosses cartes ont un contour spécial.';
      h = '<button class="pk-av" type="button" data-pk-av="0" aria-pressed="' + !PFE.avatar + '">' + avatarHTML(null, S.pseudo) + '<span>Initiales</span></button>' +
        pfCards(true).map(function (c) { return '<button class="pk-av" type="button" data-pk-av="' + c.id + '" aria-pressed="' + (PFE.avatar === c.id) + '" title="' + esc(c.name) + '">' + avatarHTML(c.id, '') + '<span>' + esc(c.name.split(' — ')[0]) + '</span></button>'; }).join('');
    } else if (t === 'vitrine') {
      pick.className = 'pf-pick cards';
      $('#pfHelp').textContent = 'Choisis jusqu\'à 5 cartes, dans l\'ordre où tu veux les montrer (' + PFE.vitrine.length + '/5). Clique à nouveau pour en retirer une.';
      h = pfCards(false).map(function (c) { const k = PFE.vitrine.indexOf(c.id); return '<button class="pk-card" type="button" data-pk-vit="' + c.id + '" aria-pressed="' + (k >= 0) + '">' + (k >= 0 ? '<b class="pk-n">' + (k + 1) + '</b>' : '') + '<div class="cc mini ' + finish(c) + '" style="' + cardStyle(c) + '">' + cardInner(c) + corners(c) + '</div></button>'; }).join('');
    } else if (t === 'banniere') {
      pick.className = 'pf-pick wide';
      $('#pfHelp').textContent = 'Les 5 couleurs sont offertes. Chaque légendaire, secrète ou GOAT que tu possèdes débloque sa bannière.';
      const cards = CATALOG.filter(function (c) { return BIG[c.rarity] && c.img && owns(c.id); }).sort(rankSort);
      h = BANS.map(function (x) { return '<button class="pk-ban b-' + x[0] + '" type="button" data-pk-ban="' + x[0] + '" aria-pressed="' + (PFE.banniere === x[0]) + '"><span>' + x[1] + '</span></button>'; }).join('') +
        cards.map(function (c) { const k = 'c-' + c.id; return '<button class="pk-ban" type="button" data-pk-ban="' + k + '" aria-pressed="' + (PFE.banniere === k) + '" style="--bgrad:' + (c.color || RHEX[c.rarity]) + '"><img' + (c.rarity === 'goat' ? ' class="goat"' : '') + ' src="' + c.img + '" alt="" loading="lazy"><span>' + esc(c.name.split(' — ')[0]) + '</span></button>'; }).join('');
    } else {
      pick.className = 'pf-pick list';
      const has = S.titres || ['recrue'];
      $('#pfHelp').textContent = 'Ton titre s\'affiche sous ton pseudo et dans le classement. Débloques-en d\'autres en jouant.';
      h = TITRES.map(function (x) { const ok = has.indexOf(x[0]) >= 0; return '<button class="pk-tl" type="button" data-pk-tl="' + x[0] + '" aria-pressed="' + (PFE.titre === x[0]) + '"' + (ok ? '' : ' disabled') + '>' + titleChip(x[0]) + '<small>' + (ok ? 'Débloqué' : '🔒 ' + esc(x[2])) + '</small></button>'; }).join('');
    }
    pick.innerHTML = h || '<p class="pf-empty">Aucune carte ici. Ouvre des boosters pour en obtenir !</p>';
  }
  async function savePf() {
    const btn = $('#pfSave'), a = {};
    if (PFE.avatar !== myAvatar()) a.p_avatar = PFE.avatar || 0;
    if (PFE.vitrine.join() !== (S.vitrine || []).filter(owns).join()) a.p_vitrine = PFE.vitrine;
    if (PFE.banniere !== S.banniere) a.p_banniere = PFE.banniere;
    if (PFE.titre !== S.titre) a.p_titre = PFE.titre;
    if (!Object.keys(a).length) { closePf(); return; }
    busy(btn, true, 'Enregistrement…');
    try {
      const r = await rpc('modifier_profil', a);
      Object.assign(S, { avatar: r.avatar, vitrine: r.vitrine || [], banniere: r.banniere, titre: r.titre, titres: r.titres });
      closePf(); renderAll(); toast('Profil mis à jour.');
    } catch (e) { toast(e.message, true); }
    busy(btn, false);
  }
  $('#pfModal').addEventListener('click', function (e) {
    const t = e.target.closest('button, .modal-bg'); if (!t) return;
    if (t.dataset.pfClose !== undefined) { closePf(); return; }
    if (t.dataset.pfTab) { PFE.tab = t.dataset.pfTab; renderPf(); $('#pfPick').scrollTop = 0; return; }
    if (t.dataset.pfRar) { PFE.rar = t.dataset.pfRar; renderPf(); return; }
    if (t.dataset.pkAv !== undefined) { PFE.avatar = +t.dataset.pkAv || null; renderPf(); return; }
    if (t.dataset.pkVit) {
      const id = +t.dataset.pkVit, k = PFE.vitrine.indexOf(id);
      if (k >= 0) PFE.vitrine.splice(k, 1); else if (PFE.vitrine.length >= 5) { toast('La vitrine contient 5 cartes maximum. Retires-en une d\'abord.', true); return; } else PFE.vitrine.push(id);
      const st = $('#pfPick').scrollTop; renderPf(); $('#pfPick').scrollTop = st; return;
    }
    if (t.dataset.pkBan) { PFE.banniere = t.dataset.pkBan; const st = $('#pfPick').scrollTop; renderPf(); $('#pfPick').scrollTop = st; return; }
    if (t.dataset.pkTl) { PFE.titre = t.dataset.pkTl; renderPf(); return; }
  });
  $('#pfSave').addEventListener('click', savePf);
  $('#pfSearch').addEventListener('input', function () { PFE.q = this.value; const st = 0; renderPf(); $('#pfPick').scrollTop = st; });
  document.addEventListener('click', function (e) {
    const o = e.target.closest('[data-pf-open]'); if (o) { openPf(o.dataset.pfOpen); return; }
    const sh = e.target.closest('[data-pf-share]');
    if (sh) {
      const url = location.origin + location.pathname + '#joueur/' + encodeURIComponent(sh.dataset.pfShare);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Lien du profil copié.'); }, function () { prompt('Lien du profil :', url); });
      return;
    }
    const row = e.target.closest('tr[data-player]'); if (row) { location.hash = '#joueur/' + encodeURIComponent(row.dataset.player); }
  });

  function renderAll() { renderAuthState(); renderBinds(); renderQuests(); renderHome(); renderBoosters(); renderCollection(); renderBoard(); renderMe(); }

  // =====================================================================
  // Navigation
  // =====================================================================
  const VIEWS = ['accueil', 'boosters', 'collection', 'marche', 'classement', 'profil', 'joueur'];
  const TITLES = { accueil: 'Accueil', boosters: 'Boosters', collection: 'Collection', marche: 'Marché', classement: 'Classement', profil: 'Profil', joueur: 'Joueur' };
  function route() {
    let v = location.hash.slice(1); if (v === 'echanges') v = 'marche';
    let who = ''; if (v.indexOf('joueur/') === 0) { try { who = decodeURIComponent(v.slice(7)); } catch (e) { who = v.slice(7); } v = 'joueur'; }
    let view = VIEWS.indexOf(v) >= 0 && (v !== 'joueur' || who) ? v : 'accueil';
    const needLogin = view === 'profil' && !USER; if (needLogin) view = 'accueil';
    $$('[data-view]').forEach(function (el) { el.hidden = el.dataset.view !== view; });
    $$('[data-link]').forEach(function (a) { if (a.dataset.link === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('#wheelModal.open, #authModal.open, #pfModal.open').forEach(closeModal); closeCard();
    if ($('#mkModal').classList.contains('open')) closeMk();
    if (view === 'profil' && S) { $('#pseudoInput').value = S.pseudo || ''; loadMine(); }
    if (view === 'joueur') loadPublic(who);
    if (view === 'classement') loadBoard();
    if (view === 'marche') loadMarket();
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
    $('#testPanel').hidden = true; PF.mine = null;
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
  // Particules aspirées vers la carte (charge avant l'explosion)
  function implode(colors, n, ms) {
    const r = opReveal.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = Math.max(FX.w, FX.h) * .55, frames = ms / 16.7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = R * (.6 + Math.random() * .5), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, f = frames * (.6 + Math.random() * .4);
      FX.ps.push({ x: x, y: y, vx: (cx - x) / f, vy: (cy - y) / f, life: 1, decay: 1 / f, size: 1.5 + Math.random() * 3, c: colors[Math.floor(Math.random() * colors.length)], rot: 0, vr: 0, sq: false, g: 0, nd: true });
    }
    fxRun();
  }
  function fxRun() { if (!FX.raf) FX.raf = requestAnimationFrame(fxLoop); }
  function fxLoop() {
    FX.raf = 0; const ctx = FX.ctx; if (!ctx) return;
    ctx.clearRect(0, 0, FX.w, FX.h);
    if (OP.crackle && !opReveal.hidden) {
      const r = opReveal.getBoundingClientRect(), t = Math.random() * 4, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const x = t < 1 ? r.left + r.width * t : t < 2 ? r.right : t < 3 ? r.left + r.width * (t - 2) : r.left, y = t < 1 ? r.top : t < 2 ? r.top + r.height * (t - 1) : t < 3 ? r.bottom : r.top + r.height * (t - 3);
      const dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy) || 1;
      if (Math.random() < .7) spawn(x, y, OP.crackle, dx / n * (1 + Math.random() * 2.5), dy / n * (1 + Math.random() * 2.5), 1.4 + Math.random() * 2, .045 + Math.random() * .04, 0);
    }
    if (OP.rain) {
      for (let i = 0; i < 3; i++) spawn(Math.random() * FX.w, -10, ['#f2c25b', '#ffd36b', '#ffffff', '#ff7eb6', '#6fd0ff'], (Math.random() - .5) * 1.5, 1 + Math.random() * 2.5, 5 + Math.random() * 5, .0035 + Math.random() * .003, .03);
    }
    if (OP.emit) {
      const r = opReveal.getBoundingClientRect();
      for (let i = 0; i < 2; i++) {
        const side = Math.random(), x = side < .5 ? r.left + Math.random() * r.width : (side < .75 ? r.left : r.right), y = side < .5 ? r.bottom - Math.random() * r.height * .2 : r.top + Math.random() * r.height;
        spawn(x, y, OP.emit, (Math.random() - .5) * 1.2, -1 - Math.random() * 2.2, 1.5 + Math.random() * 3, .01 + Math.random() * .012, -.01);
      }
    }
    FX.ps = FX.ps.filter(function (p) {
      p.vy += p.g; if (!p.nd) { p.vx *= .985; p.vy *= .985; } p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, p.life * 1.6); ctx.fillStyle = p.c;
      if (p.sq) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, 6.283); ctx.fill(); }
      return true;
    });
    ctx.globalAlpha = 1;
    if (FX.ps.length || OP.emit || OP.crackle || OP.rain) fxRun();
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

  function swayLoop() {
    if (!OP.sway || OP.phase !== 'reveal') return;
    const t = performance.now();
    if (t - (OP.lastMove || 0) > 1400) { cardTilt.tgt = { x: Math.sin(t / 1100) * .24, y: Math.cos(t / 1500) * .17, o: .85 }; smKick(); }
    requestAnimationFrame(swayLoop);
  }
  // Attente qu'un toucher peut écourter (pour passer les indices)
  function sleepH(ms) { return new Promise(function (done) { const t0 = performance.now(); (function chk() { if (OP.hurry || performance.now() - t0 >= ms) done(); else requestAnimationFrame(chk); })(); }); }
  // Un indice arrive en claquant au centre, puis se range en étiquette au-dessus de la carte
  async function clue(text, sub, ms, chip, photo) {
    if (!text) return;
    text = String(text);
    if (photo) photoOn(photo); else photoOff();
    const el = $('#opClue'); el.innerHTML = (sub ? '<small>' + esc(sub) + '</small>' : '') + esc(text);
    el.className = 'op-clue' + (text.length > 12 ? ' long' : ''); void el.offsetWidth; el.classList.add('in');
    setTimeout(function () { const r = OP.list[OP.idx] ? OP.list[OP.idx].c.rarity : 'legend'; flash(RC[r] || '#fff'); shake(); burst(FX.w / 2, FX.h * .46, FXC[r] || FXC.legend, 34, 9); }, 230);
    await sleepH(ms); el.classList.remove('in'); el.classList.add('outc');
    if (chip !== false) { const chips = $('#opChips'); chips.classList.remove('fade'); chips.insertAdjacentHTML('beforeend', '<span class="op-chip">' + (sub ? '<small>' + esc(sub) + '</small>' : '') + esc(text) + '</span>'); }
    await sleepH(300); el.className = 'op-clue';
  }
  // Palmarès mis en avant pendant le walkout des GOAT
  // Photos de carrière affichées derrière les indices du walkout (dans l'ordre : jeu, époque, catégorie, palmarès, GOAT)
  const GOAT_PHOTOS = {
    Faker: [1, 2, 3, 4, 5].map(function (i) { return 'assets/goat/faker-' + i + '.webp?v=1'; }),
    ZywOo: [1, 2, 3, 4, 5].map(function (i) { return 'assets/goat/zywoo-' + i + '.webp?v=1'; }),
    Kaydop: [1, 2, 3, 4, 5].map(function (i) { return 'assets/goat/kaydop-' + i + '.webp?v=1'; }),
    Shotzzy: [1, 2, 3, 4, 5].map(function (i) { return 'assets/goat/shotzzy-' + i + '.webp?v=1'; }),
    N0tail: [1, 2, 3, 4, 5].map(function (i) { return 'assets/goat/n0tail-' + i + '.webp?v=1'; })
  };
  function photoOn(src) {
    const el = $('#opPhoto'), img = el.querySelector('i');
    img.style.backgroundImage = 'url("' + src + '")'; el.classList.add('on');
    img.classList.remove('kb'); void img.offsetWidth; img.classList.add('kb');
  }
  function photoOff() { $('#opPhoto').classList.remove('on'); }
  // Le dossier GOAT : chaque info arrive sur une photo (polaroïd), puis va s'épingler autour de la carte
  async function dossier(c) {
    const box = $('#opDossier'); box.innerHTML = ''; box.className = 'op-dossier';
    opener.classList.add('cinema'); auInit(); SFX.crowd(8.5);
    const cam = box.animate([{ transform: 'scale(1) translate(0,0)' }, { transform: 'scale(1.08) translate(-1%, 1%)' }], { duration: 9000, easing: 'ease-in-out', fill: 'forwards' });
    const own = GOAT_PHOTOS[c.name] || [];
    const pool = CATALOG.filter(function (x) { return x.game === c.game && x.img && x.id !== c.id && x.rarity !== 'goat'; })
      .sort(function (a, b) { return RORDER[b.rarity] - RORDER[a.rarity] || Math.random() - .5; });
    const trophy = pool.find(function (x) { return /troph|coupe|aegis|major|champion|sacre|doubl/i.test(x.name); });
    const rest = pool.filter(function (x) { return x !== trophy; }).map(function (x) { return x.img; });
    const pick = function (i, alt) { return own[i] || alt || rest[i % Math.max(1, rest.length)] || c.img; };
    const items = [
      ['Jeu', c.game, pick(0, rest[0])], ['Époque', c.year, pick(1, rest[1])], ['Catégorie', c.type, pick(2, rest[2])],
      ['Palmarès', GOAT_HOOK[c.name], pick(3, trophy && trophy.img)], ['Rareté', 'Greatest of all time', own[4] || c.img]
    ].filter(function (x) { return x[1]; });
    items.forEach(function (x) { const im = new Image(); im.src = x[2]; });
    const W = window.innerWidth, H = window.innerHeight, small = W < 700;
    const slots = [[-.31, -.2, -11], [.31, -.19, 9], [-.31, .22, 7], [.31, .23, -8]];
    for (let k = 0; k < items.length; k++) {
      const it = items[k], last = k === items.length - 1;
      flash('rgba(255,255,255,.9)'); setTimeout(function () { flash(last ? 'rgba(255,211,107,.9)' : 'rgba(255,255,255,.6)'); }, 110);
      const p = document.createElement('div');
      p.className = 'pol in' + (last ? ' gp' : '');
      p.style.setProperty('--rot', ((Math.random() - .5) * 8).toFixed(1) + 'deg');
      p.innerHTML = '<div class="ph" style="background-image:url(&quot;' + it[2] + '&quot;)"></div><div class="cap"><small>' + esc(it[0]) + '</small><b>' + esc(it[1]) + '</b></div>';
      box.querySelectorAll('.pol').forEach(function (q) { q.classList.add('pinned'); });
      box.appendChild(p); shake(); SFX.shutter();
      box.animate([{ scale: 1.035 }, { scale: 1 }], { duration: 450, easing: 'cubic-bezier(.2,.8,.3,1)', composite: 'add' });
      burst(W / 2, H * .46, last ? FXC.goat : ['#ffffff', '#ffe9b0', '#f2c25b'], last ? 90 : 30, last ? 13 : 8);
      await sleepH(last ? 1400 : 1050);
      if (!last) {
        const sl = slots[k % slots.length];
        p.style.setProperty('--tx', (sl[0] * W * (small ? .9 : 1)).toFixed(0) + 'px'); p.style.setProperty('--ty', (sl[1] * H).toFixed(0) + 'px');
        p.style.setProperty('--rot', sl[2] + 'deg'); p.style.setProperty('--sc', small ? '.48' : '.56');
        await sleepH(280);
      } else {
        p.classList.add('pulse');
        // Le tampon GOAT frappé sur le dossier
        p.insertAdjacentHTML('beforeend', '<span class="pstamp">GOAT</span>'); const st = p.querySelector('.pstamp'); void st.offsetWidth; st.classList.add('hit');
        setTimeout(function () { SFX.stamp(); shake(); flash('rgba(214,28,58,.35)'); }, 300);
        await sleepH(700);
      }
    }
    cam.cancel();
  }
  // Rafale de flashs façon paparazzi : les visuels du même jeu s'empilent de plus en plus vite
  async function strobe(c) {
    const pool = CATALOG.filter(function (x) { return x.game === c.game && x.img && x.id !== c.id && x.rarity !== 'goat'; })
      .sort(function (a, b) { return RORDER[b.rarity] - RORDER[a.rarity] || Math.random() - .5; }).map(function (x) { return x.img; });
    const imgs = (GOAT_PHOTOS[c.name] || []).concat(pool).slice(0, 14);
    if (!imgs.length) return;
    while (imgs.length < 10) imgs.push(imgs[imgs.length % Math.max(1, imgs.length)]);
    const box = $('#opStrobe'); box.innerHTML = ''; box.className = 'op-strobe on';
    imgs.forEach(function (src) { const im = new Image(); im.src = src; });
    for (let i = 0; i < imgs.length && !OP.hurry; i++) {
      const fig = document.createElement('i');
      fig.style.backgroundImage = 'url("' + imgs[i] + '")';
      fig.style.left = (12 + Math.random() * 76) + '%'; fig.style.top = (14 + Math.random() * 66) + '%';
      fig.style.setProperty('--r', ((Math.random() - .5) * 36).toFixed(1) + 'deg');
      box.appendChild(fig);
      flash(i % 3 === 2 ? 'rgba(255,217,138,.9)' : 'rgba(255,255,255,.85)');
      if (i % 4 === 3) shake();
      await sleepH(Math.max(55, 190 - i * 14));
    }
    await sleepH(380);
    box.classList.add('out'); await sleepH(320);
    box.className = 'op-strobe'; box.innerHTML = '';
  }
  const GOAT_FACE = { Faker: [74, 55], ZywOo: [52, 43], Kaydop: [64, 46], Shotzzy: [84, 54], N0tail: [50, 54] };
  const GOAT_HOOK = { Faker: '6× champion du monde', ZywOo: '3× champion du Major', Kaydop: '3× champion du monde', Shotzzy: '3× champion du monde', N0tail: '2× champion de The International' };
  function wave(id, delay) { setTimeout(function () { const w = $(id); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); }, delay || 0); }


  // ---------- Son : effets générés par le navigateur (aucun fichier, aucun droit) ----------
  const AU = { ctx: null, out: null, on: true, live: [] };
  try { AU.on = localStorage.getItem('clutch-son') !== '0'; } catch (e) {}
  function auInit() {
    return null; // son désactivé
    if (!AU.on) return null;
    if (!AU.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AU.ctx = new C(); AU.out = AU.ctx.createDynamicsCompressor(); AU.out.connect(AU.ctx.destination); }
    if (AU.ctx.state === 'suspended') AU.ctx.resume();
    return AU.ctx;
  }
  function auNoise(dur) { const c = AU.ctx, b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const n = c.createBufferSource(); n.buffer = b; return n; }
  function auGain(v) { const g = AU.ctx.createGain(); g.gain.value = v; g.connect(AU.out); AU.live.push(g); return g; }
  const SFX = {
    // Montée de tension : souffle filtré + dent de scie qui grimpent
    riser: function (dur) { const c = auInit(); if (!c) return; const t = c.currentTime, g = auGain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + dur * .95); g.gain.linearRampToValueAtTime(0, t + dur);
      const n = auNoise(dur), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(5000, t + dur); n.connect(bp).connect(g); n.start(t); n.stop(t + dur);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(440, t + dur); og.gain.value = .12; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; o.connect(lp).connect(og).connect(g); o.start(t); o.stop(t + dur); },
    // Battement de cœur : deux coups graves
    heart: function () { const c = auInit(); if (!c) return; [0, .17].forEach(function (d, k) { const t = c.currentTime + d, o = c.createOscillator(), g = auGain(0); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + .18); g.gain.setValueAtTime(k ? .7 : .9, t); g.gain.exponentialRampToValueAtTime(.001, t + .28); o.connect(g); o.start(t); o.stop(t + .3); }); },
    // Impact : claquement + coup de basse
    impact: function (big) { const c = auInit(); if (!c) return; const t = c.currentTime;
      const n = auNoise(.25), hp = c.createBiquadFilter(), g = auGain(0); hp.type = 'highpass'; hp.frequency.value = 900; g.gain.setValueAtTime(big ? .9 : .6, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); n.connect(hp).connect(g); n.start(t);
      const o = c.createOscillator(), og = auGain(0); o.type = 'sine'; o.frequency.setValueAtTime(big ? 140 : 120, t); o.frequency.exponentialRampToValueAtTime(40, t + (big ? .9 : .4)); og.gain.setValueAtTime(big ? 1 : .8, t); og.gain.exponentialRampToValueAtTime(.001, t + (big ? 1 : .45)); o.connect(og); o.start(t); o.stop(t + 1.1); },
    // Souffle qui passe
    whoosh: function () { const c = auInit(); if (!c) return; const t = c.currentTime, n = auNoise(.7), bp = c.createBiquadFilter(), g = auGain(0); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(3000, t); bp.frequency.exponentialRampToValueAtTime(250, t + .6); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.6, t + .25); g.gain.exponentialRampToValueAtTime(.001, t + .7); n.connect(bp).connect(g); n.start(t); },
    // Lettre qui s'écrit
    tick: function (i) { const c = auInit(); if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = auGain(0); o.type = 'square'; o.frequency.value = 660 + i * 70; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .08); o.connect(g); o.start(t); o.stop(t + .09); },
    // Le gros BOOM : chute de basse + éclat + carillon
    boom: function () { const c = auInit(); if (!c) return; const t = c.currentTime; SFX.impact(true);
      const o = c.createOscillator(), g = auGain(0); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.6); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.8); o.connect(g); o.start(t); o.stop(t + 1.9);
      const n = auNoise(1.6), hp = c.createBiquadFilter(), ng = auGain(0); hp.type = 'highpass'; hp.frequency.value = 5000; ng.gain.setValueAtTime(.35, t); ng.gain.exponentialRampToValueAtTime(.001, t + 1.5); n.connect(hp).connect(ng); n.start(t);
      [0, 4, 7, 12].forEach(function (st, k) { const tt = t + .08 + k * .07, so = c.createOscillator(), sg = auGain(0); so.type = 'triangle'; so.frequency.value = 523.25 * Math.pow(2, st / 12); sg.gain.setValueAtTime(.14, tt); sg.gain.exponentialRampToValueAtTime(.001, tt + 1.2); so.connect(sg); so.start(tt); so.stop(tt + 1.3); }); },
    // Déclic d'appareil photo + sifflement du flash
    shutter: function () { const c = auInit(); if (!c) return; const t = c.currentTime;
      [0, .055].forEach(function (d, k) { const n = auNoise(.04), hp = c.createBiquadFilter(), g = auGain(0); hp.type = 'highpass'; hp.frequency.value = k ? 2500 : 1500; g.gain.setValueAtTime(k ? .5 : .7, t + d); g.gain.exponentialRampToValueAtTime(.001, t + d + .04); n.connect(hp).connect(g); n.start(t + d); });
      const o = c.createOscillator(), g = auGain(0); o.type = 'sine'; o.frequency.setValueAtTime(2200, t + .06); o.frequency.exponentialRampToValueAtTime(7000, t + .4); g.gain.setValueAtTime(.0001, t + .06); g.gain.exponentialRampToValueAtTime(.05, t + .2); g.gain.exponentialRampToValueAtTime(.0001, t + .42); o.connect(g); o.start(t + .06); o.stop(t + .45); },
    // Foule qui monte
    crowd: function (dur) { const c = auInit(); if (!c) return; const t = c.currentTime, g = auGain(0);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + 1); g.gain.exponentialRampToValueAtTime(.5, t + dur);
      [[500, .8], [1300, 1.2], [250, .6]].forEach(function (b) { const n = auNoise(dur + .2), bp = c.createBiquadFilter(), bg = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = b[0]; bp.Q.value = b[1]; bg.gain.value = .6;
        const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 2 + Math.random() * 3; lg.gain.value = .25; l.connect(lg).connect(bg.gain); l.start(t); l.stop(t + dur + .2);
        n.connect(bp).connect(bg).connect(g); n.start(t); n.stop(t + dur + .2); }); },
    // Coup de tampon
    stamp: function () { const c = auInit(); if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = auGain(0); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + .2); g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); o.start(t); o.stop(t + .32);
      const n = auNoise(.08), lp = c.createBiquadFilter(), ng = auGain(0); lp.type = 'lowpass'; lp.frequency.value = 1800; ng.gain.setValueAtTime(.8, t); ng.gain.exponentialRampToValueAtTime(.001, t + .08); n.connect(lp).connect(ng); n.start(t); },
    stop: function () { if (!AU.ctx) return; const t = AU.ctx.currentTime; AU.live.forEach(function (g) { try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + .15); } catch (e) {} }); AU.live = []; }
  };
  function sndBtn() { const b = $('#opSnd'); if (b) { b.textContent = AU.on ? '🔊' : '🔇'; b.setAttribute('aria-label', AU.on ? 'Couper le son' : 'Activer le son'); } }

  // ---------- Cinématique de révélation d'une GOAT ----------
  async function goatCine(c) {
    const cv = $('#opCine'), bg = $('#cineBg'), tx = $('#cineTxt'), fl = $('#cineFlash');
    // Point du visage sur chaque carte : les gros plans zooment dessus
    const f = GOAT_FACE[c.name] || [50, 45];
    const cut = function (s0, s1, dy, txt, sub) {
      bg.style.backgroundImage = 'url("' + c.img + '")'; bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = f[0] + '% ' + (f[1] + dy) + '%'; bg.style.transformOrigin = f[0] + '% ' + (f[1] + dy) + '%';
      const k = Math.random() < .5 ? 1 : -1; bg.style.setProperty('--s0', s0); bg.style.setProperty('--s1', s1);
      bg.style.setProperty('--x0', (k * 1.5) + '%'); bg.style.setProperty('--x1', (-k * 1.5) + '%'); bg.style.setProperty('--y0', '0%'); bg.style.setProperty('--y1', '0%');
      bg.classList.remove('show'); void bg.offsetWidth; bg.classList.add('show');
      const t = String(txt);
      tx.className = 'cine-txt slam' + (t.length > 12 ? ' long' : ''); tx.innerHTML = (sub ? '<small>' + esc(sub) + '</small>' : '') + '<span data-t="' + esc(t) + '">' + esc(t) + '</span>';
      fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      cv.classList.remove('shake'); void cv.offsetWidth; cv.classList.add('shake');
      SFX.impact(false);
    };
    cv.className = 'cine on'; bg.className = 'cine-bg'; tx.className = 'cine-txt'; tx.innerHTML = ''; fl.className = 'cine-flash';
    auInit(); SFX.riser(5.6);
    await sleep(60); cv.classList.add('bars');
    // 1. Le noir, le cœur
    tx.className = 'cine-txt line'; tx.textContent = 'Il n\'y en a qu\'un';
    SFX.heart(); await sleepH(950); if (!OP.hurry) SFX.heart(); await sleepH(950);
    // 2. Le montage
    const shots = [[1.25, 1.45, 4, c.game, 'Jeu'], [2.6, 2.9, -2, c.year || 'Légende', 'Époque'], [1.8, 2, 0, GOAT_HOOK[c.name] || 'Champion', 'Palmarès'], [1.15, 1, 0, 'Greatest of all time', '']];
    for (let i = 0; i < shots.length && !OP.hurry; i++) { const sh = shots[i]; cut(sh[0], sh[1], sh[2], sh[3], sh[4]); await sleepH(i === 3 ? 900 : 680); }
    // 3. Le silence, puis le nom
    bg.classList.remove('show'); tx.innerHTML = ''; SFX.whoosh();
    if (!OP.hurry) await sleepH(380);
    tx.className = 'cine-txt name'; const nm = c.name.toUpperCase();
    for (let i = 0; i < nm.length; i++) { tx.insertAdjacentHTML('beforeend', '<b>' + esc(nm[i]) + '</b>'); if (!OP.hurry) { SFX.tick(i); await sleepH(95); } }
    await sleepH(520);
    fl.className = 'cine-flash white'; await sleepH(420);
    // 4. BOOM
    SFX.stop(); SFX.boom();
    cv.classList.add('out'); await sleep(330);
    cv.className = 'cine';
  }

  // ---------- Ouverture ----------
  function openerShow() {
    opener.hidden = false; document.body.style.overflow = 'hidden'; fxInit(); FX.ps = [];
    Object.assign(OP, { phase: 'pack', res: null, req: null, err: null, list: [], idx: 0, busy: false, tearing: false, tp: 0, emit: null });
    opener.classList.remove('dark', 'rays', 'goatpk'); setRc('#ffffff');
    opReveal.classList.remove('hush'); $('#opChips').innerHTML = '';
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
  function openerHide() { SFX.stop(); opener.classList.remove('cinema'); photoOff(); $('#opDossier').className = 'op-dossier'; $('#opDossier').innerHTML = ''; $('#opStrobe').className = 'op-strobe'; $('#opStrobe').innerHTML = ''; OP.phase = 'off'; OP.emit = null; OP.crackle = null; OP.sway = false; OP.rain = false; opener.hidden = true; document.body.style.overflow = ''; renderAll(); }
  async function startOpen() {
    if (!USER) { openAuth('signup'); return; }
    if (!S || S.boosters < 1) { toast('Tu n\'as plus de booster. Récupère le gratuit, tourne la roue ou achètes-en un.', true); location.hash = '#boosters'; return; }
    openerShow();
  }
  function bestRarity(res) { let b = 'common'; res.cartes.forEach(function (id) { const r = BY_ID[id].rarity; if (RORDER[r] > RORDER[b]) b = r; }); return b; }
  // Le tirage part dès qu'on touche le booster : la lueur de la déchirure prend la couleur de la meilleure carte
  function ensureReq() {
    if (OP.req) return OP.req;
    OP.req = rpc('ouvrir_booster').then(function (res) { OP.res = res; opener.classList.toggle('goatpk', bestRarity(res) === 'goat'); $$('#rigSeg button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); setRc(RC[bestRarity(res)]); refresh(); return res; }, function (e) { OP.err = e; throw e; });
    OP.req.catch(function () {});
    return OP.req;
  }

  // ---------- Déchirure : la bande du haut est découpée en tranches qui s'enroulent en courbe ----------
  const TEAR = { n: 30 };
  function buildStrip() {
    const pack = opPack.querySelector('.pack'), strip = opPack.querySelector('.pk-strip'); if (!pack || !strip) return;
    const W = pack.offsetWidth, H = pack.offsetHeight, sh = H * .058, w = W / TEAR.n;
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
    if (best === 'goat') {
      // GOAT : rayons prismatiques, double flash, ondes de choc et grosse gerbe arc-en-ciel
      $('#opRays').classList.add('goat'); opener.classList.add('rays');
      flash('#ffd36b'); setTimeout(function () { flash('#ffffff'); }, 160);
      wave('#opWave'); wave('#opWave2', 180); shake();
      burst(p[0], p[1], FXC.goat, 170, 14);
    } else {
      burst(p[0], p[1], FXC[best], RORDER[best] >= 3 ? 80 : 36, RORDER[best] >= 3 ? 9 : 6);
      flash(RORDER[best] >= 2 ? RC[best] : 'rgba(255,255,255,.55)');
    }
    // La bande s'envole, le sachet disparaît aussitôt et les cartes sont là
    tween(500, easeOut, function (k) { renderTear(1, k); });
    OP.busy = true;
    await sleep(120);
    const packEl = opPack.querySelector('.pack'); packEl.style.animation = 'none';
    opPack.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    buildReveal(res); opener.classList.remove('rays', 'goatpk');
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
      if (Math.random() < .6) { spawn(r.left + r.width * v, r.top + r.height * .058, opener.classList.contains('goatpk') ? FXC.goat : ['#ffffff', getComputedStyle(opener).getPropertyValue('--rc').trim() || '#fff'], (Math.random() - .3) * 3, -Math.random() * 3, 2 + Math.random() * 2, .03, .15); fxRun(); }
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
      return '<div class="rv" data-r="' + c.rarity + '" style="--k:' + k + ';--d:' + k + '"><div class="rv-aura"></div><div class="rv-in">' +
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
    let cur = null;
    $$('.rv', opReveal).forEach(function (el, k) {
      el.style.setProperty('--d', Math.max(0, k - OP.idx)); el.classList.toggle('cur', k === OP.idx);
      const tease = k === OP.idx && RORDER[el.dataset.r] >= 2 && !el.classList.contains('face');
      el.classList.toggle('teased', tease); if (tease) cur = el;
    });
    OP.crackle = cur ? FXC[cur.dataset.r] : null; if (OP.crackle) fxRun();
    cardTilt.cur = { x: 0, y: 0, o: 0 }; cardTilt.tgt = { x: 0, y: 0, o: 0 };
  }
  const NAMES = { epic: 'Épique', legend: 'Légendaire', secret: 'Secrète', goat: 'GOAT' };
  function showBanner(r, sub) { const b = $('#opBanner'); b.innerHTML = esc(NAMES[r]) + (sub ? '<small>' + esc(sub) + '</small>' : ''); b.className = 'op-banner' + (r === 'goat' ? ' goat' : ''); void b.offsetWidth; b.classList.add('show'); }
  async function revealCur() {
    const el = $$('.rv', opReveal)[OP.idx]; if (!el || OP.busy) return;
    OP.busy = true; OP.hurry = false; OP.seq = true;
    const r = el.dataset.r, lvl = RORDER[r], col = RC[r], inner = el.querySelector('.rv-in'), c = OP.list[OP.idx].c;
    setRc(col); $('#opRays').classList.toggle('goat', r === 'goat');
    OP.crackle = null;
    if (r === 'goat') {
      // GOAT : battements dans le noir, indices sur des photos de sa carrière, puis la carte se charge
      opener.classList.add('dark'); $('#opHint').textContent = ''; $('#opChips').innerHTML = '';
      el.classList.add('beat');
      for (let i = 0; i < 3; i++) { await sleepH(460); flash('rgba(255,217,138,.28)'); SFX.heart(); }
      el.classList.remove('beat');
      opReveal.classList.add('hush');
      await dossier(c);
      // Ralenti : la carte se charge, le son monte, puis tout explose
      el.classList.add('lift', 'tense', 'charging'); SFX.riser(1.4);
      implode(FXC.goat, 140, 1250);
      await sleepH(1350);
      SFX.stop(); SFX.boom();
      opener.classList.remove('cinema');
      $('#opDossier').classList.add('boom');
      opReveal.classList.remove('hush');
      setTimeout(function () { const d = $('#opDossier'); d.className = 'op-dossier'; d.innerHTML = ''; }, 900);
      el.classList.remove('tense', 'charging', 'teased');
    } else if (lvl >= 3) {
      // Walkout : écran noir, indices un par un, puis la carte se charge d'énergie
      opener.classList.add('dark');
      $('#opHint').textContent = ''; $('#opChips').innerHTML = '';
      opReveal.classList.add('hush'); await sleepH(420);
      await clue(c.game, 'Jeu', 1000);
      if (c.year) await clue(c.year, r === 'legend' ? 'Année' : 'Époque', 950);
      if (r !== 'legend' && c.type) await clue(c.type, 'Catégorie', 900);
      if (r === 'secret') await clue('Carte secrète', 'Rareté', 1000);
      opReveal.classList.remove('hush'); await sleepH(380);
      el.classList.add('lift', 'tense', 'charging');
      implode(FXC[r], 90, 950);
      await sleepH(980);
      el.classList.remove('tense', 'charging', 'teased');
    } else if (lvl === 2) {
      el.classList.add('tense', 'charging'); implode(FXC.epic, 45, 520); await sleepH(540); el.classList.remove('tense', 'charging', 'teased');
    }
    // Retournement avec élan
    const dur = lvl >= 3 ? 900 : lvl === 2 ? 720 : 620;
    el.classList.add('face');
    inner.animate([
      { transform: 'rotateY(0deg) translateZ(0) scale(1)' },
      { transform: 'rotateY(100deg) translateZ(70px) scale(1.12)', offset: .42 },
      { transform: 'rotateY(198deg) translateZ(20px) scale(1.05)', offset: .72 },
      { transform: 'rotateY(180deg) translateZ(0) scale(1)' }
    ], { duration: dur, easing: 'cubic-bezier(.3,.6,.25,1)' });
    await sleep(dur * .4);
    const p = centerOf(opReveal);
    if (lvl >= 3) {
      opener.classList.remove('dark'); $('#opChips').classList.add('fade'); flash('#ffffff'); setTimeout(function () { flash(col); }, 140);
      wave('#opWave'); wave('#opWave2', 160); shake();
      burst(p[0], p[1], FXC[r], r === 'goat' ? 240 : 140, r === 'goat' ? 19 : 15);
      opener.classList.add('rays'); OP.emit = FXC[r]; el.classList.add('big-r'); el.classList.remove('lift'); showBanner(r, r === 'goat' ? c.name : null);
      if (r === 'goat') {
        setTimeout(function () { flash('#ffd36b'); wave('#opWave'); shake(); burst(p[0], p[1], FXC.goat, 160, 22); }, 420);
        setTimeout(function () { flash('#ffffff'); wave('#opWave2'); shake(); burst(p[0], p[1], ['#f2c25b', '#fff1c4', '#ffffff'], 140, 26); OP.rain = true; fxRun(); }, 850);
      }
    } else if (lvl === 2) {
      flash('rgba(180,107,255,.75)'); wave('#opWave'); burst(p[0], p[1], FXC.epic, 70, 11); el.classList.add('big-r'); showBanner('epic');
    } else burst(p[0], p[1], FXC[r], 18, 6);
    if (lvl >= 2) { OP.sway = true; OP.lastMove = 0; requestAnimationFrame(swayLoop); }
    const dot = $$('#opCount i')[OP.idx]; if (dot) { dot.style.setProperty('--c', col); dot.classList.add('done'); }
    $('#opHint').textContent = OP.idx === OP.list.length - 1 ? 'Touche pour voir ton booster' : 'Glisse la carte ou touche pour la suivante';
    await sleep(dur * .6);
    OP.busy = false; OP.seq = false;
  }
  $('#opSnd').addEventListener('click', function (e) { e.stopPropagation(); AU.on = !AU.on; try { localStorage.setItem('clutch-son', AU.on ? '1' : '0'); } catch (er) {} if (!AU.on) SFX.stop(); sndBtn(); });
  sndBtn(); $('#opSnd').hidden = true;
  // Un toucher pendant la séquence fait défiler les indices plus vite
  opener.addEventListener('pointerdown', function () { if (OP.seq) OP.hurry = true; });
  // La carte part dans la direction du lancer, avec la vitesse du geste
  async function throwCard(dir, from, vel) {
    const el = $$('.rv', opReveal)[OP.idx]; if (!el || OP.busy) return;
    OP.busy = true; OP.emit = null; OP.sway = false; OP.crackle = null; OP.rain = false; hideBanner(); opener.classList.remove('rays', 'dark'); $('#opChips').classList.add('fade');
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
      OP.lastMove = performance.now();
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
    OP.phase = 'sum'; OP.emit = null; OP.busy = false; OP.crackle = null; OP.sway = false; OP.rain = false; $('#opChips').innerHTML = '';
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
    if (t.dataset.rig !== undefined) {
      try {
        await rpc('test_truquer', { r: t.dataset.rig || null });
        $$('#rigSeg button').forEach(function (b) { b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
        toast(t.dataset.rig ? 'Ton prochain booster finira par ' + (t.dataset.rig === 'goat' ? 'une GOAT' : 'une carte ' + t.textContent.toLowerCase()) + '.' : 'Prochain booster normal.');
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.testCartes !== undefined) {
      t.disabled = true;
      try { const n = await rpc('test_toutes_cartes'); toast(n ? n + ' cartes ajoutées : ta collection est complète.' : 'Tu as déjà toutes les cartes.'); await refresh(); } catch (err) { toast(err.message, true); }
      t.disabled = false; return;
    }
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
    if ($('#mkModal').classList.contains('open')) { closeMk(); return; }
    if ($('#pfModal').classList.contains('open')) { closePf(); return; }
    const m = $('#authModal.open, #wheelModal.open'); if (m) closeModal(m);
  });

  // =====================================================================
  // Marché : annonces entre joueurs, cours de chaque carte
  // =====================================================================
  const MK = { tab: 'marche', rows: [], mine: [], rar: 'all', q: '', sort: 'pop', cur: null };
  const MK_BASE = { common: 20, uncommon: 40, epic: 150, legend: 600, secret: 1500, goat: 20000 };
  function mkVar(r) { return r && r.dernier && r.ref_24h ? (r.dernier - r.ref_24h) / r.ref_24h * 100 : null; }
  function mkChip(v) {
    if (v === null || !isFinite(v)) return '<span class="mk-var flat">—</span>';
    const k = v > .05 ? 'up' : v < -.05 ? 'down' : 'flat';
    return '<span class="mk-var ' + k + '">' + (v > .05 ? '▲ +' : v < -.05 ? '▼ ' : '') + v.toFixed(1).replace('.', ',') + ' %</span>';
  }
  function mkSpark(pts) {
    if (!pts || pts.length < 2) return '<svg class="mk-spark" viewBox="0 0 100 30"><line x1="0" y1="15" x2="100" y2="15" stroke="var(--line-2)" stroke-dasharray="3 3"/></svg>';
    const mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), d = mx - mn || 1;
    const xy = pts.map(function (p, i) { return (i / (pts.length - 1) * 100).toFixed(1) + ',' + (27 - (p - mn) / d * 24).toFixed(1); }).join(' ');
    const col = pts[pts.length - 1] >= pts[0] ? 'var(--ok)' : 'var(--bad)';
    return '<svg class="mk-spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="' + xy + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
  }
  function mkRow(id) { return MK.rows.find(function (r) { return String(r.carte) === String(id); }) || null; }
  async function loadMarket() {
    try { MK.rows = (await rpc('marche')) || []; } catch (e) { MK.rows = []; }
    if (USER) { try { MK.mine = (await rpc('mes_annonces')) || []; } catch (e) { MK.mine = []; } } else MK.mine = [];
    renderMarket();
  }
  function renderMarket() {
    $$('#mkTabs button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mkTab === MK.tab ? 'true' : 'false'); });
    if (!$('#mkRarity').firstChild) $('#mkRarity').innerHTML = '<button type="button" data-mk-rar="all" aria-pressed="true">Toutes</button>' + RAR.map(function (r) { return '<button type="button" data-mk-rar="' + r.id + '" aria-pressed="false">' + r.name + '</button>'; }).join('');
    $$('#mkRarity button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mkRar === MK.rar ? 'true' : 'false'); });
    // Bande des cours qui défile, comme en bourse
    const moves = MK.rows.filter(function (r) { return r.dernier; }).slice(0, 40);
    $('#mkTicker').hidden = !moves.length;
    $('#mkTape').innerHTML = moves.map(function (r) { const c = BY_ID[r.carte], v = mkVar(r); if (!c) return ''; return '<span><b>' + esc(c.name.split(' — ')[0]) + '</b>' + fmt(r.dernier) + ' <span class="' + (v > 0 ? 'up' : v < 0 ? 'down' : '') + '">' + (v === null ? '' : (v > 0 ? '▲' : v < 0 ? '▼' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%') + '</span></span>'; }).join('');
    const ech = MK.tab === 'echanges';
    $('#mkFilters').hidden = ech;
    let items = [];
    if (MK.tab === 'marche') items = MK.rows.map(function (r) { return { c: BY_ID[r.carte], r: r }; });
    else if (MK.tab === 'vendre' && S) items = Object.keys(S.collection || {}).map(function (id) { return { c: BY_ID[id], r: mkRow(id), n: S.collection[id] }; });
    else if (MK.tab === 'mes') items = MK.mine.map(function (a) { return { c: BY_ID[a.carte], r: mkRow(a.carte), a: a }; });
    items = items.filter(function (x) { return x.c && (MK.rar === 'all' || x.c.rarity === MK.rar) && (!MK.q || x.c.name.toLowerCase().indexOf(MK.q) >= 0 || (x.c.game || '').toLowerCase().indexOf(MK.q) >= 0); });
    const price = function (x) { return x.a ? x.a.prix : x.r ? (x.r.prix_min || x.r.dernier || 0) : 0; };
    const sorts = {
      pop: function (a, b) { return ((b.r && b.r.ventes_7j) || 0) - ((a.r && a.r.ventes_7j) || 0) || ((b.r && b.r.annonces) || 0) - ((a.r && a.r.annonces) || 0); },
      hausse: function (a, b) { return (mkVar(b.r) || -1e9) - (mkVar(a.r) || -1e9); },
      baisse: function (a, b) { return (mkVar(a.r) || 1e9) - (mkVar(b.r) || 1e9); },
      cher: function (a, b) { return price(b) - price(a); }, pascher: function (a, b) { return (price(a) || 1e12) - (price(b) || 1e12); },
      rare: function (a, b) { return RORDER[b.c.rarity] - RORDER[a.c.rarity]; }
    };
    items.sort(sorts[MK.sort] || sorts.pop);
    $('#mkGrid').hidden = ech;
    $('#mkGrid').innerHTML = items.map(function (x) {
      const c = x.c, r = x.r, rr = RAR.find(function (q) { return q.id === c.rarity; });
      let lab, val;
      if (x.a) { lab = 'Ton prix'; val = x.a.prix; }
      else if (r && r.prix_min) { lab = 'Dès'; val = r.prix_min; }
      else if (r && r.dernier) { lab = 'Dernière vente'; val = r.dernier; }
      else { lab = 'Pas encore de cours'; val = null; }
      return '<button class="mk-tile" type="button" data-mk="' + c.id + '">' + '<div class="cc mini ' + finish(c) + '" style="' + cardStyle(c) + '">' + cardInner(c) + corners(c) + '</div>' +
        '<div style="min-width:0"><div class="mk-name">' + esc(c.name) + '</div><div class="mk-rar" style="color:' + rr.color + '">' + rr.name + (x.n ? ' · ×' + x.n : '') + '</div>' +
        '<div class="mk-row"><div class="mk-price"><div><small>' + lab + '</small>' + (val ? '<i class="coin"></i> ' + fmt(val) : '—') + '</div></div>' + mkChip(mkVar(r)) + '</div>' +
        mkSpark(r && r.spark) + '<div class="mk-meta"><span>' + ((r && r.annonces) || 0) + ' en vente</span><span>' + ((r && r.ventes_7j) || 0) + ' ventes / 7 j</span></div></div></button>';
    }).join('');
    const empty = !ech && !items.length;
    $('#mkEmpty').hidden = !empty && !ech;
    if (ech) { $('#mkEmptyT').textContent = 'Échanges entre amis : bientôt'; $('#mkEmptyS').textContent = 'Tu pourras proposer une carte contre une carte à tes amis.'; }
    else if (MK.tab === 'vendre' && !S) { $('#mkEmptyT').textContent = 'Connecte-toi pour vendre'; $('#mkEmptyS').textContent = ''; }
    else if (MK.tab === 'vendre') { $('#mkEmptyT').textContent = 'Aucune carte à vendre'; $('#mkEmptyS').textContent = 'Ouvre des boosters pour remplir ta collection.'; }
    else if (MK.tab === 'mes') { $('#mkEmptyT').textContent = USER ? 'Aucune annonce en cours' : 'Connecte-toi pour voir tes annonces'; $('#mkEmptyS').textContent = USER ? 'Va dans « Vendre » pour mettre une carte en vente.' : ''; }
    else { $('#mkEmptyT').textContent = 'Le marché est vide pour l\'instant'; $('#mkEmptyS').textContent = 'Sois le premier à mettre une carte en vente.'; }
  }
  // Courbe du cours sur 30 jours
  function mkChart(cours) {
    const W = 600, H = 190, P = 14;
    if (!cours || !cours.length) return '<svg class="mk-chart" viewBox="0 0 ' + W + ' ' + H + '"><text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="14">Pas encore de vente</text></svg>';
    const pts = cours.length === 1 ? [cours[0], [cours[0][0] + 1, cours[0][1]]] : cours;
    const t0 = pts[0][0], t1 = pts[pts.length - 1][0], ps = pts.map(function (p) { return p[1]; }), mn = Math.min.apply(null, ps), mx = Math.max.apply(null, ps), d = mx - mn || 1;
    const X = function (t) { return P + (t - t0) / ((t1 - t0) || 1) * (W - 2 * P); }, Y = function (p) { return H - 28 - (p - mn) / d * (H - 56); };
    const line = pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
    const up = ps[ps.length - 1] >= ps[0], col = up ? '#5fd39a' : '#ff5a68';
    const last = pts[pts.length - 1], dt = function (t) { return new Date(t * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
    return '<svg class="mk-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><defs><linearGradient id="mkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".35"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      [0, 1, 2, 3].map(function (i) { const y = 28 + i * (H - 56) / 3; return '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,.05)"/>'; }).join('') +
      '<polygon points="' + X(t0).toFixed(1) + ',' + (H - 28) + ' ' + line + ' ' + X(t1).toFixed(1) + ',' + (H - 28) + '" fill="url(#mkg)"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + X(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="5" fill="' + col + '" stroke="#0b0a0e" stroke-width="2"/>' +
      '<text x="' + (W - P) + '" y="18" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="12">max ' + fmt(mx) + '</text>' +
      '<text x="' + (W - P) + '" y="' + (H - 34) + '" text-anchor="end" fill="var(--muted)" font-family="JetBrains Mono, monospace" font-size="12">min ' + fmt(mn) + '</text>' +
      '<text x="' + P + '" y="' + (H - 8) + '" fill="var(--dim)" font-family="JetBrains Mono, monospace" font-size="12">' + dt(t0) + '</text>' +
      '<text x="' + (W - P) + '" y="' + (H - 8) + '" text-anchor="end" fill="var(--dim)" font-family="JetBrains Mono, monospace" font-size="12">' + dt(t1) + '</text></svg>';
  }
  async function openMk(id) {
    const c = BY_ID[id]; if (!c) return; MK.cur = c.id;
    const el = $('#mkCard'); el.className = 'cc big ' + finish(c); el.style.cssText = cardStyle(c);
    el.innerHTML = cardInner(c) + corners(c) + '<span class="cc-holo"></span><span class="cc-glare"></span>';
    $('#mkInfo').innerHTML = '<p class="muted">Chargement du cours…</p>';
    openModal('#mkModal');
    let f; try { f = await rpc('fiche_marche', { p_carte: c.id }); } catch (e) { $('#mkInfo').innerHTML = '<p class="form-msg err">' + esc(e.message) + '</p>'; return; }
    if (MK.cur !== c.id) return;
    const r = mkRow(c.id), rr = RAR.find(function (q) { return q.id === c.rarity; }), own = S && S.collection ? (S.collection[c.id] || 0) : 0;
    const cur = (r && r.dernier) || (f.annonces[0] && f.annonces[0].prix) || null;
    const sugg = (r && r.dernier) || (f.annonces[0] && f.annonces[0].prix) || MK_BASE[c.rarity];
    $('#mkInfo').innerHTML =
      '<div><div class="mk-rar" style="color:' + rr.color + '">' + rr.name + ' · ' + esc(c.game || '') + '</div><h2>' + esc(c.name) + '</h2></div>' +
      '<div class="mk-big"><span class="num">' + (cur ? fmt(cur) : '—') + '</span><span class="muted">pièces</span>' + mkChip(mkVar(r)) + '<span class="muted" style="font-size:13px">sur 24 h</span></div>' +
      mkChart(f.cours) +
      '<div class="mk-stats"><div><b>' + (f.plus_bas ? fmt(f.plus_bas) : '—') + '</b><span>Plus bas</span></div><div><b>' + (f.plus_haut ? fmt(f.plus_haut) : '—') + '</b><span>Plus haut</span></div><div><b>' + fmt(f.volume || 0) + '</b><span>Ventes</span></div></div>' +
      '<div><div class="panel-head" style="margin-bottom:8px"><h2 style="font-size:17px">En vente (' + f.annonces.length + ')</h2></div><div class="mk-list">' +
      (f.annonces.length ? f.annonces.map(function (a) {
        return '<div class="mk-offer"><span class="num"><i class="coin"></i>' + fmt(a.prix) + '</span><span class="who">' + (a.moi ? 'Ton annonce' : 'par <a class="seller" href="#joueur/' + encodeURIComponent(a.vendeur) + '">' + esc(a.vendeur) + '</a>') + '</span>' +
          (a.moi ? '<button class="btn btn-dark btn-sm" type="button" data-mk-del="' + a.id + '">Retirer</button>' : USER ? '<button class="btn btn-gold btn-sm" type="button" data-mk-buy="' + a.id + '" data-prix="' + a.prix + '"' + (S && S.pieces < a.prix ? ' disabled title="Pas assez de pièces"' : '') + '>Acheter</button>' : '') + '</div>';
      }).join('') : '<p class="muted" style="margin:0">Personne ne vend cette carte pour l\'instant.</p>') + '</div></div>' +
      (!USER ? '<p class="mk-hint"><button class="linkish" type="button" data-action="login">Connecte-toi</button> pour acheter ou vendre.</p>' :
        own ? '<form class="mk-sell" id="mkSellForm"><div class="mk-hint">Tu en as <b>×' + own + '</b>. Mets-en une en vente :</div><div class="row"><input class="input" id="mkPrice" type="number" min="10" max="1000000" step="1" value="' + sugg + '" inputmode="numeric"><button class="btn btn-gold" type="submit">Mettre en vente</button></div><div class="mk-hint" id="mkNet"></div></form>' :
        '<p class="mk-hint">Tu n\'as pas cette carte.</p>');
    const net = function () { const p = +($('#mkPrice') || {}).value || 0, t = Math.ceil(p * f.taxe / 100); $('#mkNet').innerHTML = 'Tu toucheras <b>' + fmt(Math.max(0, p - t)) + '</b> pièces après la taxe de ' + f.taxe + ' %. La carte quitte ta collection tant qu\'elle est en vente.'; };
    if ($('#mkPrice')) { net(); $('#mkPrice').addEventListener('input', net); }
  }
  function closeMk() { MK.cur = null; closeModal($('#mkModal')); }
  async function mkAction(fn, args, msg) {
    try { await rpc(fn, args); toast(msg); await refresh(); await loadMarket(); if (MK.cur) openMk(MK.cur); }
    catch (e) { toast(e.message, true); }
  }
  $('#mkTabs').addEventListener('click', function (e) { const b = e.target.closest('[data-mk-tab]'); if (!b) return; MK.tab = b.dataset.mkTab; renderMarket(); });
  $('#mkRarity').addEventListener('click', function (e) { const b = e.target.closest('[data-mk-rar]'); if (!b) return; MK.rar = b.dataset.mkRar; renderMarket(); });
  $('#mkSearch').addEventListener('input', function () { MK.q = this.value.trim().toLowerCase(); renderMarket(); });
  $('#mkSort').addEventListener('change', function () { MK.sort = this.value; renderMarket(); });
  $('#mkGrid').addEventListener('click', function (e) { const t = e.target.closest('[data-mk]'); if (t) openMk(t.dataset.mk); });
  $('#mkModal').addEventListener('click', function (e) {
    if (e.target.closest('[data-mk-close]')) { closeMk(); return; }
    const buy = e.target.closest('[data-mk-buy]'); if (buy) { buy.disabled = true; mkAction('acheter_annonce', { p_id: +buy.dataset.mkBuy }, 'Carte achetée pour ' + fmt(+buy.dataset.prix) + ' pièces !'); return; }
    const del = e.target.closest('[data-mk-del]'); if (del) { del.disabled = true; mkAction('retirer_annonce', { p_id: +del.dataset.mkDel }, 'Annonce retirée : la carte est revenue dans ta collection.'); }
  });
  $('#mkModal').addEventListener('submit', function (e) {
    if (e.target.id !== 'mkSellForm') return; e.preventDefault();
    const p = Math.round(+$('#mkPrice').value);
    mkAction('mettre_en_vente', { p_carte: MK.cur, p_prix: p }, 'Carte mise en vente pour ' + fmt(p) + ' pièces.');
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

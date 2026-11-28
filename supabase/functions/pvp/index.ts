// Fonction serveur « pvp » : arbitre les matchs classés.
// Le navigateur envoie seulement ses coups ; le serveur garde l'état complet (mains, decks, hasard),
// joue l'adversaire et calcule le résultat.
// Les règles (pvp-data.js, pvp-engine.js) sont chargées depuis le site publié, donc identiques au jeu.
// Leur empreinte SHA-256 est vérifiée : après chaque changement de règles, publier le site puis
// redéployer cette fonction avec les nouvelles empreintes (sha256sum js/pvp-data.js js/pvp-engine.js).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const RULES: [string, string][] = [
  ['pvp-data.js', 'ff77aae27f8d14c3318ae9c37cd2b7155e7520594625155198bc1cfe0d212db4'],
  ['pvp-engine.js', 'd73cd89210e8467c9fccf889ac6bb2f13a0f4fe153d9959287ddfccdb3631118'],
];
for (const [name, sha] of RULES) {
  const code = await (await fetch('https://onwayy.github.io/clutch-tcg/js/' + name + '?v=' + sha.slice(0, 8))).text();
  const got = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)))).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (got !== sha) throw new Error('Règles PvP inattendues pour ' + name + ' : redéployer la fonction.');
  (0, eval)(code);
}

// deno-lint-ignore no-explicit-any
const PVP = (globalThis as any).PVP;
// deno-lint-ignore no-explicit-any
const CARDS = (globalThis as any).PVP_CARDS as any[];
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (m: string, s = 400) => json({ error: m }, s);

// Decks des adversaires « académie » quand aucun vrai joueur n'a de deck
const BOTS: [string, (d: any) => boolean][] = [
  ['Académie Counter-Strike', (d) => d.g === 'CS' || (d.fam === 'FPS' && d.t !== 'J')],
  ['Académie League of Legends', (d) => d.g === 'LoL' || (d.fam === 'MOBA' && d.t !== 'J')],
  ['Académie Dota 2', (d) => d.g === 'Dota' || d.fam === 'MOBA'],
  ['Académie des solistes', (d) => ['RTS', 'COMBAT'].includes(d.fam) || [41, 34, 90, 92, 106, 123, 162, 30, 149].includes(d.id)],
  ['Académie FPS', (d) => d.fam === 'FPS'],
];
function botDeck(f: (d: any) => boolean, rarOk: string) {
  const pool = CARDS.filter((d) => f(d) && rarOk.includes(d.r)).sort((a, b) => (b.p + b.fx.length * 2) - (a.p + a.fx.length * 2));
  const deck: number[] = [], curve: Record<number, number> = {};
  for (const d of pool) {
    const max = 'LSG'.includes(d.r) ? 1 : 2;
    for (let k = 0; k < max && deck.length < 20; k++) { if ((curve[d.c] || 0) >= (d.c >= 5 ? 3 : d.c === 4 ? 4 : 6)) break; deck.push(d.id); curve[d.c] = (curve[d.c] || 0) + 1; }
    if (deck.length >= 20) break;
  }
  for (const d of CARDS) { if (deck.length >= 20) break; if (d.c <= 3 && rarOk.includes(d.r) && deck.filter((x) => x === d.id).length < 1) deck.push(d.id); }
  return deck;
}

async function finish(id: string, res: number) {
  const { data, error } = await admin.rpc('_pvp_fin', { p_match: id, p_res: res });
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: auth } = await admin.auth.getUser(jwt);
    const u = auth?.user?.id;
    if (!u) return fail('Connecte-toi pour jouer.', 401);
    const body = await req.json().catch(() => ({}));
    const act = body.action;

    const current = async () => (await admin.from('pvp_matchs').select('*').eq('joueur', u).eq('fini', false).order('cree_le', { ascending: false }).limit(1)).data?.[0];

    if (act === 'state') {
      const m = body.id ? (await admin.from('pvp_matchs').select('*').eq('id', body.id).eq('joueur', u).single()).data : await current();
      if (!m) return json({ match: null });
      return json({ match: { id: m.id, view: PVP.view(m.etat, 0), adv: m.adversaire, bot: !m.adv_id } });
    }

    if (act === 'start') {
      const open = await current();
      if (open) return json({ match: { id: open.id, view: PVP.view(open.etat, 0), adv: open.adversaire, bot: !open.adv_id }, resumed: true });
      const { data: deck } = await admin.from('decks').select('cartes').eq('id', body.deck).eq('joueur', u).single();
      if (!deck) return fail('Deck introuvable.');
      const { data: err } = await admin.rpc('_deck_erreur', { u, cartes: deck.cartes });
      if (err) return fail(err);
      const { data: me } = await admin.from('profils').select('pseudo').eq('id', u).single();
      // adversaire : le deck d'un vrai joueur, choisi parmi les plus récents ; sinon une académie
      let adv = '', advId: string | null = null, advDeck: number[] | null = null;
      const { data: pool } = await admin.from('decks').select('cartes, joueur, profils(pseudo)').neq('joueur', u).order('maj_le', { ascending: false }).limit(40);
      const cand = (pool || []).filter((d: any) => d.profils?.pseudo && !PVP.deckError(d.cartes)).sort(() => Math.random() - .5);
      for (const d of cand.slice(0, 4)) {
        const { data: e2 } = await admin.rpc('_deck_erreur', { u: d.joueur, cartes: d.cartes });
        if (!e2) { adv = d.profils.pseudo; advId = d.joueur; advDeck = d.cartes; break; }
      }
      if (!advDeck) {
        const b = BOTS[Math.floor(Math.random() * BOTS.length)];
        adv = b[0]; advDeck = botDeck(b[1], Math.random() < .5 ? 'CPE' : 'CPEL');
      }
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const st = PVP.newMatch(deck.cartes, advDeck, { seed, names: [me?.pseudo || 'Toi', adv] });
      const { data: saison } = await admin.rpc('pvp_saison');
      const { data: row, error } = await admin.from('pvp_matchs').insert({ joueur: u, deck: deck.cartes, adversaire: adv, adv_id: advId, adv_deck: advDeck, etat: st, tour: st.turn, saison }).select('id').single();
      if (error) throw error;
      return json({ match: { id: row.id, view: PVP.view(st, 0), adv, bot: !advId } });
    }

    if (act === 'play' || act === 'forfeit') {
      const { data: m } = await admin.from('pvp_matchs').select('*').eq('id', body.id).eq('joueur', u).single();
      if (!m || m.fini) return fail('Ce match est terminé.');
      if (act === 'forfeit') {
        const { data: ok } = await admin.from('pvp_matchs').update({ maj_le: new Date().toISOString() }).eq('id', m.id).eq('tour', m.tour).eq('fini', false).select('id');
        if (!ok?.length) return fail('Réessaie.', 409);
        return json({ fin: await finish(m.id, -1), res: -1 });
      }
      const st = m.etat, plays = Array.isArray(body.plays) ? body.plays.slice(0, 7).map((p: any) => ({ h: p.h | 0, m: p.m | 0 })) : [];
      const err = PVP.check(st, 0, plays);
      if (err) return fail(err);
      const ai = PVP.aiPlays(st, 1);
      const ev = PVP.playTurn(st, plays, ai);
      // verrou optimiste : si deux requêtes arrivent en même temps, une seule passe
      const { data: ok } = await admin.from('pvp_matchs').update({ etat: st, tour: st.turn, maj_le: new Date().toISOString() }).eq('id', m.id).eq('tour', m.tour).select('id');
      if (!ok?.length) return fail('Ce tour a déjà été joué.', 409);
      let fin = null, res = null;
      if (st.over) { res = st.res.w === 0 ? 1 : st.res.w === 1 ? -1 : 0; fin = await finish(m.id, res); }
      return json({ view: PVP.view(st, 0), ev, fin, res });
    }
    return fail('Action inconnue.');
  } catch (e) {
    console.error(e);
    return fail('Erreur du serveur, réessaie.', 500);
  }
});

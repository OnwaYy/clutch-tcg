// Fonction serveur « pvp » : arbitre les matchs classés.
// Le navigateur envoie seulement ses coups ; le serveur garde l'état complet (mains, decks, hasard),
// joue l'adversaire et calcule le résultat.
// Les règles (pvp-data.js, pvp-engine.js) sont chargées depuis le site publié, donc identiques au jeu.
// Leur empreinte SHA-256 est vérifiée : après chaque changement de règles, publier le site puis
// redéployer cette fonction avec les nouvelles empreintes (sha256sum js/pvp-data.js js/pvp-engine.js).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const RULES: [string, string][] = [
  ['pvp-data.js', 'e1eec45c17198b120e5fd240daa488a26a33310599e026c3b5f8a7d1ebf31faa'],
  ['pvp-engine.js', '7e0c3b6a7dc33880be8320236ba0c46e884881dbdcfdff9221d507e74ddb5db3'],
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

// Decks des adversaires « académie » quand aucun vrai joueur n'a de deck : 14 serviteurs + 6 sorts
const BOTS: [string, (d: any) => boolean][] = [
  ['Académie Counter-Strike', (d) => d.g === 'CS' || (d.fam === 'FPS' && d.k === 's')],
  ['Académie League of Legends', (d) => d.g === 'LoL' || (d.fam === 'MOBA' && d.k === 's')],
  ['Académie Dota 2', (d) => d.g === 'Dota' || d.fam === 'MOBA'],
  ['Académie des solistes', (d) => ['RTS', 'COMBAT'].includes(d.fam) || d.k === 's'],
  ['Académie FPS', (d) => d.fam === 'FPS'],
];
const val = (d: any) => (d.k === 'u' ? d.a + d.h : 4) + d.fx.length * 2 + d.kw.length;
function botDeck(f: (d: any) => boolean, rarOk: string) {
  const ok = CARDS.filter((d) => d.t !== 'Tok' && f(d) && rarOk.includes(d.r)), deck: number[] = [], curve: Record<number, number> = {};
  const add = (list: any[], cap: number) => {
    for (const d of list) {
      const max = 'LSG'.includes(d.r) ? 1 : 2;
      for (let k = 0; k < max && deck.length < cap; k++) { if ((curve[d.c] || 0) >= (d.c >= 6 ? 2 : d.c >= 4 ? 4 : 5)) break; deck.push(d.id); curve[d.c] = (curve[d.c] || 0) + 1; }
      if (deck.length >= cap) break;
    }
  };
  const byVal = (a: any, b: any) => val(b) / (b.c + 1) - val(a) / (a.c + 1);
  add(ok.filter((d) => d.k === 'u').sort(byVal), 14);
  add(ok.filter((d) => d.k === 's').sort(byVal), 20);
  for (const d of CARDS) { if (deck.length >= 20) break; if (d.t !== 'Tok' && d.k === 'u' && 'CP'.includes(d.r) && !deck.includes(d.id)) deck.push(d.id); }
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

    const pack = (m: any) => ({ id: m.id, seq: m.tour, view: PVP.view(m.etat, 0), adv: m.adversaire, bot: !m.adv_id });

    if (act === 'state') {
      const m = body.id ? (await admin.from('pvp_matchs').select('*').eq('id', body.id).eq('joueur', u).single()).data : await current();
      if (!m) return json({ match: null });
      return json({ match: pack(m) });
    }

    if (act === 'start') {
      const open = await current();
      if (open) return json({ match: pack(open), resumed: true });
      const { data: deck } = await admin.from('decks').select('cartes').eq('id', body.deck).eq('joueur', u).single();
      if (!deck) return fail('Deck introuvable.');
      const { data: err } = await admin.rpc('_deck_erreur', { u, cartes: deck.cartes });
      if (err) return fail(err);
      const { data: me } = await admin.from('profils').select('pseudo').eq('id', u).single();
      // adversaire : le deck d'un vrai joueur (joué par l'ordinateur), sinon une académie
      let adv = '', advId: string | null = null, advDeck: number[] | null = null;
      const { data: pool } = await admin.from('decks').select('cartes, joueur, profils(pseudo)').neq('joueur', u).order('maj_le', { ascending: false }).limit(40);
      const cand = (pool || []).filter((d: any) => d.profils?.pseudo && !PVP.deckError(d.cartes)).sort(() => Math.random() - .5);
      for (const d of cand.slice(0, 4)) {
        const { data: e2 } = await admin.rpc('_deck_erreur', { u: d.joueur, cartes: d.cartes });
        if (!e2) { adv = d.profils.pseudo; advId = d.joueur; advDeck = d.cartes; break; }
      }
      if (!advDeck) { const b = BOTS[Math.floor(Math.random() * BOTS.length)]; adv = b[0]; advDeck = botDeck(b[1], Math.random() < .5 ? 'CPE' : 'CPEL'); }
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const st = PVP.newMatch(deck.cartes, advDeck, { seed, names: [me?.pseudo || 'Toi', adv] });
      const steps = st.cur === 1 ? PVP.aiTurn(st, 1, 0) : [];          // l'ordinateur commence
      const { data: saison } = await admin.rpc('pvp_saison');
      const { data: row, error } = await admin.from('pvp_matchs').insert({ joueur: u, deck: deck.cartes, adversaire: adv, adv_id: advId, adv_deck: advDeck, etat: st, tour: 1, saison }).select('*').single();
      if (error) throw error;
      return json({ match: pack(row), steps });
    }

    if (act === 'act' || act === 'forfeit') {
      const { data: m } = await admin.from('pvp_matchs').select('*').eq('id', body.id).eq('joueur', u).single();
      if (!m || m.fini) return fail('Ce match est terminé.');
      if (body.seq !== m.tour) return fail('Le match a changé, on recharge.', 409);
      const next = m.tour + 1;
      if (act === 'forfeit') {
        const { data: ok } = await admin.from('pvp_matchs').update({ tour: next, maj_le: new Date().toISOString() }).eq('id', m.id).eq('tour', m.tour).eq('fini', false).select('id');
        if (!ok?.length) return fail('Réessaie.', 409);
        return json({ fin: await finish(m.id, -1), res: -1 });
      }
      const st = m.etat, x = body.a || {};
      const a = x.t === 'play' ? { t: 'play', h: x.h | 0, tgt: x.tgt == null ? undefined : (typeof x.tgt === 'number' ? x.tgt : String(x.tgt)) }
        : x.t === 'atk' ? { t: 'atk', from: x.from | 0, to: typeof x.to === 'number' ? x.to : String(x.to) }
        : x.t === 'power' ? { t: 'power', tgt: x.tgt == null ? undefined : (typeof x.tgt === 'number' ? x.tgt : String(x.tgt)) }
        : x.t === 'pick' ? { t: 'pick', i: x.i | 0 } : { t: 'end' };
      const err = PVP.check(st, 0, a);
      if (err) return fail(err);
      const steps = [{ a, ev: PVP.act(st, 0, a), view: PVP.view(st, 0) }];
      if (a.t === 'end' && !st.over && st.cur === 1) steps.push(...PVP.aiTurn(st, 1, 0));
      // verrou optimiste : une action à la fois
      const { data: ok } = await admin.from('pvp_matchs').update({ etat: st, tour: next, maj_le: new Date().toISOString() }).eq('id', m.id).eq('tour', m.tour).select('id');
      if (!ok?.length) return fail('Le match a changé, on recharge.', 409);
      let fin = null, res = null;
      if (st.over) { res = st.res.w === 0 ? 1 : st.res.w === 1 ? -1 : 0; fin = await finish(m.id, res); }
      return json({ steps, view: PVP.view(st, 0), seq: next, fin, res });
    }
    return fail('Action inconnue.');
  } catch (e) {
    console.error(e);
    return fail('Erreur du serveur, réessaie.', 500);
  }
});

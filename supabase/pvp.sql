-- =====================================================================
-- Mode classé (PvP) : decks, matchs, rangs par saison, récompenses.
-- Les matchs sont arbitrés par la fonction serveur « pvp » (supabase/functions/pvp) :
-- le navigateur n'envoie que ses coups, le serveur calcule tout.
-- À lancer après amis.sql.
-- =====================================================================

insert into public.reglages (cle, valeur) values
  ('pvp_victoire_points', '30'), ('pvp_defaite_points', '20'), ('pvp_nul_points', '5'),
  ('pvp_victoire_pieces', '60'), ('pvp_defaite_pieces', '20'), ('pvp_nul_pieces', '30'),
  ('pvp_gains_jour', '15')                                   -- matchs récompensés en pièces par jour
on conflict (cle) do nothing;

insert into public.quetes (id, nom, objectif, pieces, boosters, ordre) values
  ('match3',   'Jouer 3 matchs classés',  3, 60, 0, 6),
  ('victoire', 'Gagner un match classé',  1,  0, 1, 7)
on conflict (id) do nothing;

create table if not exists public.decks (
  id      bigint generated always as identity primary key,
  joueur  uuid not null references public.profils (id) on delete cascade,
  nom     text not null check (char_length(nom) between 1 and 24),
  cartes  int[] not null,
  maj_le  timestamptz not null default now()
);
create index if not exists decks_joueur on public.decks (joueur, maj_le desc);

-- Une ligne par joueur et par saison (une saison = un mois, ex. « 2026-12 »)
create table if not exists public.pvp_rangs (
  joueur     uuid not null references public.profils (id) on delete cascade,
  saison     text not null,
  points     int  not null default 0,
  victoires  int  not null default 0,
  defaites   int  not null default 0,
  nuls       int  not null default 0,
  serie      int  not null default 0,
  meilleur   int  not null default 0,
  recompense boolean not null default false,
  maj_le     timestamptz not null default now(),
  primary key (joueur, saison)
);
create index if not exists pvp_rangs_saison on public.pvp_rangs (saison, points desc);

create table if not exists public.pvp_matchs (
  id         uuid primary key default gen_random_uuid(),
  joueur     uuid not null references public.profils (id) on delete cascade,
  deck       int[] not null,
  adversaire text not null,
  adv_id     uuid references public.profils (id) on delete set null,
  adv_deck   int[] not null,
  etat       jsonb not null,
  tour       int  not null default 1,
  fini       boolean not null default false,
  resultat   smallint,                      -- 1 victoire, 0 nul, -1 défaite
  points     int,
  saison     text not null,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now()
);
create index if not exists pvp_matchs_joueur on public.pvp_matchs (joueur, fini, cree_le desc);

alter table public.decks enable row level security;
alter table public.pvp_rangs enable row level security;
alter table public.pvp_matchs enable row level security;
revoke all on public.decks, public.pvp_rangs, public.pvp_matchs from anon, authenticated;

create or replace function public.pvp_saison() returns text
language sql stable set search_path = '' as $$ select to_char(now() at time zone 'Europe/Paris', 'YYYY-MM') $$;

create or replace function public.pvp_rang(pts int) returns text
language sql immutable set search_path = '' as $$
  select case when pts >= 1000 then 'Légende' when pts >= 700 then 'Diamant' when pts >= 450 then 'Platine'
              when pts >= 250 then 'Or' when pts >= 100 then 'Argent' else 'Bronze' end
$$;

-- ---------- Decks ----------
create or replace function public._deck_erreur(u uuid, cartes int[]) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when cardinality(cartes) <> 20 then 'Un deck contient exactement 20 cartes.'
    when exists (select 1 from unnest(cartes) x where not exists (select 1 from public.cartes c where c.id = x)) then 'Carte inconnue.'
    when exists (select 1 from (select x, count(*) n from unnest(cartes) x group by x) w join public.cartes c on c.id = w.x
                 where w.n > case when c.rarete in ('legend', 'secret', 'goat') then 1 else 2 end)
      then 'Une seule copie de chaque légendaire, secrète ou GOAT, et 2 copies maximum des autres.'
    when not public._possede(u, cartes) then 'Tu ne possèdes pas assez d''exemplaires de certaines cartes.'
  end
$$;

create or replace function public.sauver_deck(p_id bigint, p_nom text, p_cartes int[]) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); e text; nid bigint;
begin
  p_nom := btrim(coalesce(p_nom, ''));
  if char_length(p_nom) not between 1 and 24 then raise exception 'Donne un nom à ton deck (24 caractères maximum).'; end if;
  e := public._deck_erreur(u, p_cartes); if e is not null then raise exception '%', e; end if;
  if p_id is null then
    if (select count(*) from public.decks where joueur = u) >= 10 then raise exception '10 decks maximum.'; end if;
    insert into public.decks (joueur, nom, cartes) values (u, p_nom, p_cartes) returning id into nid;
  else
    update public.decks set nom = p_nom, cartes = p_cartes, maj_le = now() where id = p_id and joueur = u returning id into nid;
    if nid is null then raise exception 'Deck introuvable.'; end if;
  end if;
  return nid;
end $$;

create or replace function public.supprimer_deck(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.decks where id = p_id and joueur = public._moi();
  if not found then raise exception 'Deck introuvable.'; end if;
end $$;

create or replace function public.mes_decks() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nom', d.nom, 'cartes', to_jsonb(d.cartes), 'maj_le', d.maj_le,
         'valide', public._deck_erreur(auth.uid(), d.cartes) is null) order by d.maj_le desc), '[]'::jsonb)
  from public.decks d where d.joueur = auth.uid()
$$;

-- ---------- Classement et état ----------
create or replace function public.mon_pvp() returns jsonb
language sql stable security definer set search_path = '' as $$
  with r as (select * from public.pvp_rangs where joueur = auth.uid() and saison = public.pvp_saison())
  select jsonb_build_object(
    'saison', public.pvp_saison(),
    'fin', (date_trunc('month', now() at time zone 'Europe/Paris') + interval '1 month') at time zone 'Europe/Paris',
    'points', coalesce((select points from r), 0), 'rang', public.pvp_rang(coalesce((select points from r), 0)),
    'victoires', coalesce((select victoires from r), 0), 'defaites', coalesce((select defaites from r), 0), 'nuls', coalesce((select nuls from r), 0),
    'serie', coalesce((select serie from r), 0),
    'position', (select count(*) + 1 from public.pvp_rangs x where x.saison = public.pvp_saison() and x.points > coalesce((select points from r), 0)),
    'en_cours', (select id from public.pvp_matchs where joueur = auth.uid() and not fini order by cree_le desc limit 1),
    'a_recuperer', (select coalesce(jsonb_agg(jsonb_build_object('saison', saison, 'points', points, 'rang', public.pvp_rang(meilleur))), '[]'::jsonb)
                    from public.pvp_rangs where joueur = auth.uid() and saison < public.pvp_saison() and not recompense and victoires + defaites + nuls > 0))
$$;

create or replace function public.classement_pvp() returns table (pseudo text, avatar int, titre text, points int, rang text, victoires int, defaites int)
language sql stable security definer set search_path = '' as $$
  select p.pseudo, case when exists (select 1 from public.collection where joueur = p.id and carte = p.avatar) then p.avatar end, p.titre,
         r.points, public.pvp_rang(r.points), r.victoires, r.defaites
  from public.pvp_rangs r join public.profils p on p.id = r.joueur
  where r.saison = public.pvp_saison() and p.pseudo is not null
  order by r.points desc, r.victoires desc, p.pseudo limit 100
$$;

-- ---------- Récompenses de fin de saison (à récupérer par le joueur) ----------
-- Boosters selon le meilleur rang atteint ; le top 10 reçoit en plus 5 boosters et le titre « Top 10 ».
create or replace function public.recuperer_saison(p_saison text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); r public.pvp_rangs; pos int; b int;
begin
  select * into r from public.pvp_rangs where joueur = u and saison = p_saison and saison < public.pvp_saison() for update;
  if r.joueur is null or r.recompense then raise exception 'Rien à récupérer pour cette saison.'; end if;
  pos := (select count(*) + 1 from public.pvp_rangs x where x.saison = p_saison and (x.points > r.points or (x.points = r.points and x.victoires > r.victoires)));
  b := case public.pvp_rang(r.meilleur) when 'Légende' then 12 when 'Diamant' then 8 when 'Platine' then 5 when 'Or' then 3 when 'Argent' then 2 else 1 end
       + case when pos <= 10 then 5 else 0 end;
  update public.pvp_rangs set recompense = true where joueur = u and saison = p_saison;
  update public.profils set boosters = boosters + b where id = u;
  return jsonb_build_object('boosters', b, 'position', pos, 'rang', public.pvp_rang(r.meilleur));
end $$;

-- ---------- Fin de match : appelée uniquement par le serveur (fonction « pvp ») ----------
create or replace function public._pvp_fin(p_match uuid, p_res smallint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.pvp_matchs; r public.pvp_rangs; d int; pcs int; nb int; s text; floor_pts int;
begin
  select * into m from public.pvp_matchs where id = p_match for update;
  if m.id is null or m.points is not null then return null; end if;
  s := m.saison;
  insert into public.pvp_rangs (joueur, saison) values (m.joueur, s) on conflict do nothing;
  select * into r from public.pvp_rangs where joueur = m.joueur and saison = s for update;
  if p_res = 1 then d := (public.reglage('pvp_victoire_points'))::int + least(r.serie, 3) * 5;
  elsif p_res = 0 then d := (public.reglage('pvp_nul_points'))::int;
  else d := -(public.reglage('pvp_defaite_points'))::int; end if;
  -- on ne redescend jamais sous le palier du meilleur rang atteint
  floor_pts := case when r.meilleur >= 1000 then 1000 when r.meilleur >= 700 then 700 when r.meilleur >= 450 then 450 when r.meilleur >= 250 then 250 when r.meilleur >= 100 then 100 else 0 end;
  d := greatest(d, floor_pts - r.points);
  update public.pvp_rangs set points = points + d, maj_le = now(),
    victoires = victoires + (p_res = 1)::int, defaites = defaites + (p_res = -1)::int, nuls = nuls + (p_res = 0)::int,
    serie = case when p_res = 1 then serie + 1 else 0 end, meilleur = greatest(meilleur, points + d)
  where joueur = m.joueur and saison = s;
  nb := (select count(*) from public.pvp_matchs where joueur = m.joueur and fini and points is not null and maj_le > now() - interval '1 day');
  pcs := case when nb >= (public.reglage('pvp_gains_jour'))::int then 0
              when p_res = 1 then (public.reglage('pvp_victoire_pieces'))::int when p_res = 0 then (public.reglage('pvp_nul_pieces'))::int
              else (public.reglage('pvp_defaite_pieces'))::int end;
  update public.profils set pieces = pieces + pcs where id = m.joueur;
  update public.pvp_matchs set fini = true, resultat = p_res, points = d, maj_le = now() where id = m.id;
  perform public._quete(m.joueur, 'match3', 1);
  if p_res = 1 then perform public._quete(m.joueur, 'victoire', 1); end if;
  return jsonb_build_object('points', d, 'pieces', pcs, 'total', r.points + d, 'rang', public.pvp_rang(r.points + d), 'ancien_rang', public.pvp_rang(r.points));
end $$;

revoke all on function public._deck_erreur(uuid, int[]), public._pvp_fin(uuid, smallint) from public, anon, authenticated;
revoke all on function public.sauver_deck(bigint, text, int[]), public.supprimer_deck(bigint), public.mes_decks(), public.mon_pvp(), public.recuperer_saison(text) from public, anon;
grant execute on function public.sauver_deck(bigint, text, int[]), public.supprimer_deck(bigint), public.mes_decks(), public.mon_pvp(), public.recuperer_saison(text) to authenticated;
revoke all on function public.classement_pvp() from public;
grant execute on function public.classement_pvp(), public.pvp_saison(), public.pvp_rang(int) to anon, authenticated;
grant execute on function public._pvp_fin(uuid, smallint), public._deck_erreur(uuid, int[]) to service_role;
grant select, insert, update on public.pvp_matchs, public.decks, public.pvp_rangs to service_role;

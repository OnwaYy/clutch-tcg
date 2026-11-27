-- =====================================================================
-- Marché : les joueurs vendent leurs cartes au prix qu'ils veulent.
-- Chaque vente alimente le « cours » de la carte (courbe des prix).
-- La carte mise en vente quitte la collection (séquestre) et y revient si l'annonce est retirée.
-- =====================================================================

insert into public.reglages (cle, valeur) values
  ('marche_taxe', '5'),          -- % prélevé sur chaque vente (disparaît : évite l'inflation et les abus)
  ('marche_prix_min', '10'),
  ('marche_prix_max', '1000000'),
  ('marche_max_annonces', '30')
on conflict (cle) do nothing;

create table if not exists public.annonces (
  id       bigint generated always as identity primary key,
  vendeur  uuid not null references public.profils (id) on delete cascade,
  carte    int  not null references public.cartes (id),
  prix     int  not null check (prix > 0),
  cree_le  timestamptz not null default now()
);
create index if not exists annonces_carte_prix on public.annonces (carte, prix);
create index if not exists annonces_vendeur on public.annonces (vendeur);

create table if not exists public.ventes (
  id        bigint generated always as identity primary key,
  carte     int  not null references public.cartes (id),
  prix      int  not null,
  vendeur   uuid references public.profils (id) on delete set null,
  acheteur  uuid references public.profils (id) on delete set null,
  quand     timestamptz not null default now()
);
create index if not exists ventes_carte_quand on public.ventes (carte, quand desc);
create index if not exists ventes_vendeur on public.ventes (vendeur);
create index if not exists ventes_acheteur on public.ventes (acheteur);

alter table public.annonces enable row level security;
alter table public.ventes enable row level security;
revoke all on public.annonces, public.ventes from anon, authenticated;

-- Mettre une carte en vente (le profil du vendeur est verrouillé : ses actions passent une par une)
create or replace function public.mettre_en_vente(p_carte int, p_prix int) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); n int; nid bigint;
begin
  if p_prix is null or p_prix < (public.reglage('marche_prix_min'))::int or p_prix > (public.reglage('marche_prix_max'))::int then
    raise exception 'Prix entre % et % pièces.', public.reglage('marche_prix_min'), public.reglage('marche_prix_max');
  end if;
  perform 1 from public.profils where id = u for update;
  if (select count(*) from public.annonces where vendeur = u) >= (public.reglage('marche_max_annonces'))::int then
    raise exception 'Tu as déjà trop d''annonces en cours.';
  end if;
  select nombre into n from public.collection where joueur = u and carte = p_carte for update;
  if n is null then raise exception 'Tu ne possèdes pas cette carte.'; end if;
  if n = 1 then delete from public.collection where joueur = u and carte = p_carte;
  else update public.collection set nombre = nombre - 1 where joueur = u and carte = p_carte; end if;
  insert into public.annonces (vendeur, carte, prix) values (u, p_carte, p_prix) returning id into nid;
  return nid;
end $$;

-- Retirer son annonce : la carte revient dans la collection
create or replace function public.retirer_annonce(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); a public.annonces;
begin
  delete from public.annonces where id = p_id and vendeur = u returning * into a;
  if a.id is null then raise exception 'Annonce introuvable.'; end if;
  insert into public.collection as co (joueur, carte) values (u, a.carte)
    on conflict (joueur, carte) do update set nombre = co.nombre + 1;
end $$;

-- Acheter une annonce : l'annonce puis les deux profils sont verrouillés, toujours dans le même ordre
-- (deux achats simultanés de la même annonce : le second échoue proprement ; aucun blocage entre achats croisés)
create or replace function public.acheter_annonce(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); a public.annonces; taxe int; solde int;
begin
  select * into a from public.annonces where id = p_id for update;
  if a.id is null then raise exception 'Cette carte vient d''être vendue ou retirée.'; end if;
  if a.vendeur = u then raise exception 'C''est ta propre annonce.'; end if;
  perform 1 from public.profils where id in (u, a.vendeur) order by id for update;
  select pieces into solde from public.profils where id = u;
  if solde < a.prix then raise exception 'Pas assez de pièces.'; end if;
  taxe := ceil(a.prix * (public.reglage('marche_taxe'))::numeric / 100);
  update public.profils set pieces = pieces - a.prix where id = u;
  update public.profils set pieces = pieces + (a.prix - taxe) where id = a.vendeur;
  insert into public.collection as co (joueur, carte) values (u, a.carte)
    on conflict (joueur, carte) do update set nombre = co.nombre + 1;
  insert into public.ventes (carte, prix, vendeur, acheteur) values (a.carte, a.prix, a.vendeur, u);
  delete from public.annonces where id = a.id;
  return jsonb_build_object('carte', a.carte, 'prix', a.prix, 'pieces', solde - a.prix);
end $$;

-- Vue d'ensemble du marché : une ligne par carte avec annonces ou ventes récentes
create or replace function public.marche() returns table (
  carte int, annonces int, prix_min int, dernier int, ref_24h int, ventes_7j int, spark int[]
) language sql security definer set search_path = '' stable as $$
  with a as (select carte, count(*)::int n, min(prix)::int pmin from public.annonces group by carte),
       v as (select carte, count(*) filter (where quand > now() - interval '7 days')::int n7,
                    (array_agg(prix order by quand desc))[1] dernier,
                    (array_agg(prix order by quand desc) filter (where quand <= now() - interval '24 hours'))[1] ref
             from public.ventes group by carte),
       s as (select carte, array_agg(prix order by quand) sp
             from (select carte, prix, quand, row_number() over (partition by carte order by quand desc) rn from public.ventes) x
             where rn <= 20 group by carte)
  select c.id, coalesce(a.n, 0), a.pmin, v.dernier, v.ref, coalesce(v.n7, 0), coalesce(s.sp, '{}')
  from public.cartes c left join a on a.carte = c.id left join v on v.carte = c.id left join s on s.carte = c.id
  where a.n is not null or v.dernier is not null;
$$;

-- Fiche d'une carte : annonces (moins chères d'abord) et cours sur 30 jours
create or replace function public.fiche_marche(p_carte int) returns jsonb
language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'annonces', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'prix', a.prix, 'vendeur', coalesce(p.pseudo, 'Joueur'),
                 'moi', a.vendeur = auth.uid(), 'cree_le', a.cree_le) order by a.prix, a.cree_le)
               from public.annonces a join public.profils p on p.id = a.vendeur where a.carte = p_carte), '[]'::jsonb),
    'cours', coalesce((select jsonb_agg(jsonb_build_array(extract(epoch from quand)::bigint, prix) order by quand)
               from public.ventes where carte = p_carte and quand > now() - interval '30 days'), '[]'::jsonb),
    'plus_haut', (select max(prix) from public.ventes where carte = p_carte),
    'plus_bas', (select min(prix) from public.ventes where carte = p_carte),
    'volume', (select count(*) from public.ventes where carte = p_carte),
    'taxe', (public.reglage('marche_taxe'))::int
  );
$$;

-- Mes annonces en cours
create or replace function public.mes_annonces() returns jsonb
language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'carte', carte, 'prix', prix, 'cree_le', cree_le) order by cree_le desc), '[]'::jsonb)
  from public.annonces where vendeur = auth.uid();
$$;

revoke all on function public.mettre_en_vente(int, int), public.retirer_annonce(bigint), public.acheter_annonce(bigint), public.mes_annonces() from public, anon;
grant execute on function public.mettre_en_vente(int, int), public.retirer_annonce(bigint), public.acheter_annonce(bigint), public.mes_annonces() to authenticated;
revoke all on function public.marche(), public.fiche_marche(int) from public;
grant execute on function public.marche(), public.fiche_marche(int) to anon, authenticated;

-- =====================================================================
-- Profil public : photo de profil (une carte possédée), vitrine de 5 cartes,
-- bannière, titre à débloquer. Tout le monde peut voir le profil d'un joueur.
-- À lancer après schema.sql, catalogue.sql et marche.sql.
-- =====================================================================

alter table public.profils add column if not exists avatar   int references public.cartes (id);
alter table public.profils add column if not exists vitrine  int[] not null default '{}';
alter table public.profils add column if not exists banniere text not null default 'g-nuit';
alter table public.profils add column if not exists titre    text not null default 'recrue';

-- Titres débloqués par un joueur (calculés à la volée : rien à tenir à jour)
create or replace function public._titres(u uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with c as (
    select count(*) n,
           count(*) filter (where ca.rarete = 'legend') leg,
           count(*) filter (where ca.rarete = 'secret') sec,
           count(*) filter (where ca.rarete = 'goat') goat,
           count(*) filter (where ca.rarete <> 'goat' and ca.serie = 'ori') ori
    from public.collection co join public.cartes ca on ca.id = co.carte where co.joueur = u
  ),
  p as (select ouverts from public.profils where id = u),
  v as (select count(*) n from public.ventes where vendeur = u)
  select array_remove(array[
    'recrue',
    case when c.n   >= 50  then 'collectionneur' end,
    case when c.n   >= 150 then 'archiviste' end,
    case when c.leg >= 5   then 'legendes' end,
    case when c.sec >= 10  then 'secrets' end,
    case when c.goat >= 1  then 'goat' end,
    case when v.n   >= 10  then 'marchand' end,
    case when p.ouverts >= 100 then 'ouvreur' end,
    case when c.ori >= (select count(*) from public.cartes where serie = 'ori' and rarete <> 'goat') then 'maitre' end
  ], null)
  from c, p, v
$$;

-- Une bannière est valable si c'est un dégradé de base, ou l'illustration d'une grosse carte possédée
create or replace function public._banniere_ok(u uuid, b text) returns boolean
language sql stable security definer set search_path = '' as $$
  select b in ('g-nuit', 'g-braise', 'g-ocean', 'g-neon', 'g-or')
      or (b ~ '^c-[0-9]{1,4}$' and exists (
            select 1 from public.collection co join public.cartes ca on ca.id = co.carte
            where co.joueur = u and co.carte = substr(b, 3)::int and ca.rarete in ('legend', 'secret', 'goat')))
$$;

-- Ce que le joueur voit de son propre profil (ajouté à mon_etat)
create or replace function public._mon_profil(u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('avatar', p.avatar, 'vitrine', to_jsonb(p.vitrine), 'banniere', p.banniere,
                            'titre', p.titre, 'titres', to_jsonb(public._titres(u)))
  from public.profils p where p.id = u
$$;

-- Modifier son profil. Chaque champ null = inchangé ; avatar 0 = retirer la photo.
create or replace function public.modifier_profil(p_avatar int default null, p_vitrine int[] default null,
                                                  p_banniere text default null, p_titre text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi();
begin
  perform 1 from public.profils where id = u for update;
  if p_avatar is not null then
    if p_avatar = 0 then
      update public.profils set avatar = null where id = u;
    elsif exists (select 1 from public.collection where joueur = u and carte = p_avatar) then
      update public.profils set avatar = p_avatar where id = u;
    else raise exception 'Tu ne possèdes pas cette carte.'; end if;
  end if;
  if p_vitrine is not null then
    if cardinality(p_vitrine) > 5 then raise exception 'La vitrine contient 5 cartes maximum.'; end if;
    if (select count(distinct x) from unnest(p_vitrine) x) <> cardinality(p_vitrine) then raise exception 'Une carte ne peut être exposée qu''une fois.'; end if;
    if exists (select 1 from unnest(p_vitrine) x where not exists (select 1 from public.collection where joueur = u and carte = x)) then
      raise exception 'Tu ne possèdes pas une des cartes de la vitrine.';
    end if;
    update public.profils set vitrine = p_vitrine where id = u;
  end if;
  if p_banniere is not null then
    if not public._banniere_ok(u, p_banniere) then raise exception 'Bannière indisponible.'; end if;
    update public.profils set banniere = p_banniere where id = u;
  end if;
  if p_titre is not null then
    if not (p_titre = any (public._titres(u))) then raise exception 'Titre pas encore débloqué.'; end if;
    update public.profils set titre = p_titre where id = u;
  end if;
  return public._mon_profil(u);
end $$;

-- Profil public d'un joueur : seules les cartes qu'il possède encore sont montrées
create or replace function public.profil_public(p_pseudo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select * from public.profils where lower(pseudo) = lower(p_pseudo)),
  st as (
    select coalesce(sum((public.reglage('points') ->> ca.rarete)::int), 0) score, count(co.carte) cartes
    from p
    left join public.collection co on co.joueur = p.id
    left join public.cartes ca on ca.id = co.carte
  ),
  rr as (select ca.rarete, count(*) n from p join public.collection co on co.joueur = p.id
         join public.cartes ca on ca.id = co.carte group by ca.rarete),
  sc as (select pr.id, coalesce(sum((public.reglage('points') ->> ca.rarete)::int), 0) s
         from public.profils pr left join public.collection co on co.joueur = pr.id left join public.cartes ca on ca.id = co.carte
         where pr.pseudo is not null group by pr.id)
  select jsonb_build_object(
    'pseudo', p.pseudo, 'cree_le', p.cree_le, 'ouverts', p.ouverts,
    'avatar', case when exists (select 1 from public.collection where joueur = p.id and carte = p.avatar) then p.avatar end,
    'vitrine', coalesce((select jsonb_agg(x order by i) from unnest(p.vitrine) with ordinality t(x, i)
                         where exists (select 1 from public.collection where joueur = p.id and carte = x)), '[]'::jsonb),
    'banniere', case when public._banniere_ok(p.id, p.banniere) then p.banniere else 'g-nuit' end,
    'titre', case when p.titre = any (public._titres(p.id)) then p.titre else 'recrue' end,
    'titres', to_jsonb(public._titres(p.id)),
    'score', st.score, 'cartes', st.cartes,
    'par_rarete', coalesce((select jsonb_object_agg(rarete, n) from rr), '{}'::jsonb),
    'ventes', (select count(*) from public.ventes where vendeur = p.id),
    'rang', (select count(*) + 1 from sc where sc.s > st.score),
    'joueurs', (select count(*) from sc)
  )
  from p, st
$$;

-- Classement : avec la photo de profil et le titre
drop function if exists public.classement(text);
create function public.classement(tri text default 'score') returns table (pseudo text, score bigint, legendaires bigint, cartes bigint, avatar int, titre text)
language sql stable security definer set search_path = '' as $$
  with s as (
    select p.pseudo,
           coalesce(sum((public.reglage('points') ->> c.rarete)::int), 0) as score,
           count(*) filter (where c.rarete in ('legend','secret','goat')) as legendaires,
           count(c.id) as cartes,
           case when bool_or(c.id = p.avatar) then p.avatar end as avatar,
           p.titre
    from public.profils p
    left join public.collection co on co.joueur = p.id
    left join public.cartes c on c.id = co.carte
    where p.pseudo is not null
    group by p.id, p.pseudo, p.avatar, p.titre
  )
  select * from s order by case tri when 'legendaires' then legendaires when 'cartes' then cartes else score end desc, pseudo
  limit 100
$$;

revoke all on function public._titres(uuid), public._banniere_ok(uuid, text), public._mon_profil(uuid) from public, anon, authenticated;
revoke all on function public.modifier_profil(int, int[], text, text) from public, anon;
grant execute on function public.modifier_profil(int, int[], text, text) to authenticated;
revoke all on function public.profil_public(text), public.classement(text) from public;
grant execute on function public.profil_public(text), public.classement(text) to anon, authenticated;

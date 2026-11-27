-- =====================================================================
-- Amis et échanges directs (carte contre carte) entre amis.
-- Pas de séquestre : les cartes restent chez leur propriétaire jusqu'à l'acceptation.
-- À l'acceptation, tout est revérifié et transféré d'un bloc (ou rien du tout).
-- À lancer après profil.sql.
-- =====================================================================

create table if not exists public.amis (
  a          uuid not null references public.profils (id) on delete cascade,   -- toujours a < b
  b          uuid not null references public.profils (id) on delete cascade,
  demandeur  uuid not null references public.profils (id) on delete cascade,
  statut     text not null default 'attente' check (statut in ('attente', 'ok')),
  cree_le    timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists amis_b on public.amis (b);

create table if not exists public.echanges (
  id       bigint generated always as identity primary key,
  de       uuid not null references public.profils (id) on delete cascade,
  pour     uuid not null references public.profils (id) on delete cascade,
  donne    int[] not null default '{}',    -- cartes données par « de » (une entrée = un exemplaire)
  demande  int[] not null default '{}',    -- cartes demandées à « pour »
  statut   text not null default 'attente' check (statut in ('attente', 'acceptee', 'refusee', 'annulee')),
  cree_le  timestamptz not null default now(),
  fini_le  timestamptz
);
create index if not exists echanges_de on public.echanges (de, statut);
create index if not exists echanges_pour on public.echanges (pour, statut);

alter table public.amis enable row level security;
alter table public.echanges enable row level security;
revoke all on public.amis, public.echanges from anon, authenticated;

-- ---------- Outils internes ----------
create or replace function public._joueur(p_pseudo text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profils where lower(pseudo) = lower(p_pseudo)
$$;

create or replace function public._sont_amis(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.amis where a = least(x, y) and b = greatest(x, y) and statut = 'ok')
$$;

-- Le joueur possède-t-il toutes ces cartes (en tenant compte des doublons) ?
create or replace function public._possede(u uuid, cartes int[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from (select x, count(*) n from unnest(cartes) x group by x) w
    where coalesce((select nombre from public.collection where joueur = u and carte = w.x), 0) < w.n)
$$;

-- Déplace un exemplaire de chaque carte de « src » vers « dst » (à appeler profils verrouillés)
create or replace function public._transferer(src uuid, dst uuid, cartes int[]) returns void
language plpgsql security definer set search_path = '' as $$
declare x int;
begin
  foreach x in array cartes loop
    update public.collection set nombre = nombre - 1 where joueur = src and carte = x and nombre > 1;
    if not found then
      delete from public.collection where joueur = src and carte = x;
      if not found then raise exception 'Carte manquante pendant l''échange.'; end if;
    end if;
    insert into public.collection as co (joueur, carte) values (dst, x)
      on conflict (joueur, carte) do update set nombre = co.nombre + 1;
  end loop;
end $$;

-- ---------- Amis ----------
create or replace function public.mes_amis() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'pseudo', p.pseudo, 'titre', p.titre,
      'avatar', case when exists (select 1 from public.collection where joueur = p.id and carte = p.avatar) then p.avatar end,
      'etat', case when x.statut = 'ok' then 'ami' when x.demandeur = auth.uid() then 'envoyee' else 'recue' end,
      'depuis', x.cree_le) order by x.statut, lower(p.pseudo)), '[]'::jsonb)
  from public.amis x
  join public.profils p on p.id = case when x.a = auth.uid() then x.b else x.a end
  where auth.uid() in (x.a, x.b)
$$;

create or replace function public.demander_ami(p_pseudo text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); t uuid := public._joueur(p_pseudo); x public.amis;
begin
  if t is null then raise exception 'Aucun joueur ne s''appelle « % ».', p_pseudo; end if;
  if t = u then raise exception 'Tu ne peux pas t''ajouter toi-même.'; end if;
  perform 1 from public.profils where id = u for update;
  select * into x from public.amis where a = least(u, t) and b = greatest(u, t) for update;
  if x.a is not null then
    if x.statut = 'ok' then raise exception 'Vous êtes déjà amis.'; end if;
    if x.demandeur = u then raise exception 'Demande déjà envoyée.'; end if;
    update public.amis set statut = 'ok', cree_le = now() where a = x.a and b = x.b;   -- il t'avait déjà demandé
    return 'ami';
  end if;
  if (select count(*) from public.amis where u in (a, b)) >= 200 then raise exception 'Tu as atteint la limite d''amis.'; end if;
  if (select count(*) from public.amis where demandeur = u and statut = 'attente') >= 30 then raise exception 'Trop de demandes en attente.'; end if;
  insert into public.amis (a, b, demandeur) values (least(u, t), greatest(u, t), u);
  return 'envoyee';
end $$;

create or replace function public.repondre_ami(p_pseudo text, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); t uuid := public._joueur(p_pseudo);
begin
  if p_ok then
    update public.amis set statut = 'ok', cree_le = now() where a = least(u, t) and b = greatest(u, t) and statut = 'attente' and demandeur = t;
  else
    delete from public.amis where a = least(u, t) and b = greatest(u, t) and statut = 'attente' and demandeur = t;
  end if;
  if not found then raise exception 'Demande introuvable.'; end if;
end $$;

-- Retirer un ami (ou annuler une demande) : les échanges en attente entre vous sont annulés
create or replace function public.retirer_ami(p_pseudo text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); t uuid := public._joueur(p_pseudo);
begin
  delete from public.amis where a = least(u, t) and b = greatest(u, t);
  if not found then raise exception 'Introuvable.'; end if;
  update public.echanges set statut = 'annulee', fini_le = now()
    where statut = 'attente' and ((de = u and pour = t) or (de = t and pour = u));
end $$;

-- Collection d'un ami (pour choisir ce qu'on lui demande)
create or replace function public.collection_ami(p_pseudo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := public._moi(); t uuid := public._joueur(p_pseudo);
begin
  if t is null or not public._sont_amis(u, t) then raise exception 'Vous n''êtes pas amis.'; end if;
  return coalesce((select jsonb_object_agg(carte, nombre) from public.collection where joueur = t), '{}'::jsonb);
end $$;

-- ---------- Échanges ----------
create or replace function public.proposer_echange(p_pseudo text, p_donne int[], p_demande int[]) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); t uuid := public._joueur(p_pseudo); nid bigint;
begin
  p_donne := coalesce(p_donne, '{}'); p_demande := coalesce(p_demande, '{}');
  if t is null or not public._sont_amis(u, t) then raise exception 'Tu ne peux échanger qu''avec tes amis.'; end if;
  if cardinality(p_donne) > 5 or cardinality(p_demande) > 5 then raise exception '5 cartes maximum de chaque côté.'; end if;
  if cardinality(p_donne) + cardinality(p_demande) = 0 then raise exception 'Choisis au moins une carte.'; end if;
  perform 1 from public.profils where id = u for update;
  if (select count(*) from public.echanges where de = u and statut = 'attente') >= 20 then raise exception 'Tu as déjà 20 échanges en attente.'; end if;
  if not public._possede(u, p_donne) then raise exception 'Tu ne possèdes pas toutes les cartes proposées.'; end if;
  if not public._possede(t, p_demande) then raise exception 'Ton ami ne possède pas toutes les cartes demandées.'; end if;
  insert into public.echanges (de, pour, donne, demande) values (u, t, p_donne, p_demande) returning id into nid;
  return nid;
end $$;

-- Accepter ou refuser un échange reçu. Tout passe d'un bloc : si une carte manque, rien ne bouge.
create or replace function public.repondre_echange(p_id bigint, p_ok boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); e public.echanges;
begin
  select * into e from public.echanges where id = p_id and pour = u and statut = 'attente' for update;
  if e.id is null then raise exception 'Échange introuvable ou déjà traité.'; end if;
  if not p_ok then
    update public.echanges set statut = 'refusee', fini_le = now() where id = e.id;
    return jsonb_build_object('statut', 'refusee');
  end if;
  perform 1 from public.profils where id in (e.de, e.pour) order by id for update;
  if not public._sont_amis(e.de, e.pour) or not public._possede(e.de, e.donne) or not public._possede(e.pour, e.demande) then
    update public.echanges set statut = 'annulee', fini_le = now() where id = e.id;
    return jsonb_build_object('statut', 'annulee', 'raison', 'Une des cartes n''est plus disponible : l''échange est annulé.');
  end if;
  perform public._transferer(e.de, e.pour, e.donne);
  perform public._transferer(e.pour, e.de, e.demande);
  update public.echanges set statut = 'acceptee', fini_le = now() where id = e.id;
  return jsonb_build_object('statut', 'acceptee');
end $$;

create or replace function public.annuler_echange(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.echanges set statut = 'annulee', fini_le = now() where id = p_id and de = public._moi() and statut = 'attente';
  if not found then raise exception 'Échange introuvable ou déjà traité.'; end if;
end $$;

-- Mes échanges : en attente d'abord, puis l'historique des 30 derniers jours
create or replace function public.mes_echanges() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'sens', case when e.de = auth.uid() then 'envoye' else 'recu' end,
      'pseudo', p.pseudo,
      'avatar', case when exists (select 1 from public.collection where joueur = p.id and carte = p.avatar) then p.avatar end,
      'donne', to_jsonb(e.donne), 'demande', to_jsonb(e.demande), 'statut', e.statut, 'cree_le', e.cree_le, 'fini_le', e.fini_le,
      'possible', case when e.statut = 'attente' then public._possede(e.de, e.donne) and public._possede(e.pour, e.demande) end)
    order by (e.statut = 'attente') desc, coalesce(e.fini_le, e.cree_le) desc), '[]'::jsonb)
  from public.echanges e
  join public.profils p on p.id = case when e.de = auth.uid() then e.pour else e.de end
  where auth.uid() in (e.de, e.pour) and (e.statut = 'attente' or e.fini_le > now() - interval '30 days')
$$;

-- Ce que le joueur voit de lui-même (mon_etat) : + le nombre de choses qui l'attendent
create or replace function public._mon_profil(u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('avatar', p.avatar, 'vitrine', to_jsonb(p.vitrine), 'banniere', p.banniere,
                            'titre', p.titre, 'titres', to_jsonb(public._titres(u)),
                            'notifs', (select count(*) from public.amis where u in (a, b) and statut = 'attente' and demandeur <> u)
                                    + (select count(*) from public.echanges where pour = u and statut = 'attente'))
  from public.profils p where p.id = u
$$;

revoke all on function public._joueur(text), public._sont_amis(uuid, uuid), public._possede(uuid, int[]), public._transferer(uuid, uuid, int[]) from public, anon, authenticated;
revoke all on function public.mes_amis(), public.demander_ami(text), public.repondre_ami(text, boolean), public.retirer_ami(text), public.collection_ami(text),
  public.proposer_echange(text, int[], int[]), public.repondre_echange(bigint, boolean), public.annuler_echange(bigint), public.mes_echanges() from public, anon;
grant execute on function public.mes_amis(), public.demander_ami(text), public.repondre_ami(text, boolean), public.retirer_ami(text), public.collection_ami(text),
  public.proposer_echange(text, int[], int[]), public.repondre_echange(bigint, boolean), public.annuler_echange(bigint), public.mes_echanges() to authenticated;

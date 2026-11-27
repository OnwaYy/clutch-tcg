-- =====================================================================
-- Clutch TCG — base de données (Supabase / PostgreSQL)
--
-- Principe de sécurité : le navigateur ne peut RIEN écrire directement.
-- Toutes les tables sont en lecture seule pour le joueur (et seulement
-- ses propres lignes). Chaque action du jeu (ouvrir un booster, acheter,
-- tourner la roue…) passe par une fonction serveur qui vérifie tout :
-- qui appelle, s'il a le droit, s'il a assez de pièces, si le délai est
-- passé. Les tirages de cartes se font ici, sur le serveur.
-- =====================================================================

-- ---------- Réglages du jeu ----------
create table if not exists public.reglages (
  cle text primary key,
  valeur jsonb not null
);
insert into public.reglages (cle, valeur) values
  ('prix_booster',      '200'),
  ('prix_lot5',         '900'),
  ('gratuit_minutes',   '60'),
  ('roue_heures',       '24'),
  ('cadeau_depart',     '{"pieces": 300, "boosters": 3}'),
  -- chance par carte (sur 100 000) pour les 4 premières cartes du booster
  ('chances',           '{"common": 50000, "uncommon": 30000, "epic": 15000, "legend": 4500, "secret": 490, "goat": 10}'),
  -- 5e carte : au moins une épique
  ('chances_rare',      '{"epic": 88000, "legend": 10000, "secret": 1900, "goat": 100}'),
  ('points',            '{"common": 1, "uncommon": 2, "epic": 10, "legend": 50, "secret": 100, "goat": 500}'),
  -- roue : nombre de boosters gagnés et poids de chaque case
  ('roue',              '[{"boosters":0,"poids":10},{"boosters":1,"poids":40},{"boosters":2,"poids":30},{"boosters":3,"poids":15},{"boosters":4,"poids":5}]')
on conflict (cle) do nothing;

create or replace function public.reglage(k text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select valeur from public.reglages where cle = k
$$;

-- ---------- Catalogue des cartes ----------
create table if not exists public.cartes (
  id      int primary key,              -- 1 à 175, puis 176+ pour les GOAT
  serie   text not null default 'ori',
  rarete  text not null check (rarete in ('common','uncommon','epic','legend','secret','goat')),
  nom     text not null
);

-- ---------- Profils joueurs ----------
create table if not exists public.profils (
  id            uuid primary key references auth.users (id) on delete cascade,
  pseudo        text unique,
  pieces        int not null default 0 check (pieces >= 0),
  boosters      int not null default 0 check (boosters >= 0),
  ouverts       int not null default 0,
  achetes       int not null default 0,
  depense       int not null default 0,
  dernier_gratuit timestamptz,
  derniere_roue   timestamptz,
  cree_le       timestamptz not null default now(),
  constraint pseudo_format check (pseudo is null or pseudo ~ '^[A-Za-z0-9_.-]{3,16}$')
);
create unique index if not exists profils_pseudo_ci on public.profils (lower(pseudo));

-- ---------- Collection ----------
create table if not exists public.collection (
  joueur   uuid not null references public.profils (id) on delete cascade,
  carte    int  not null references public.cartes (id),
  nombre   int  not null default 1 check (nombre >= 1),
  premiere timestamptz not null default now(),
  primary key (joueur, carte)
);

-- ---------- Historique des tirages ----------
create table if not exists public.tirages (
  id      bigint generated always as identity primary key,
  joueur  uuid not null references public.profils (id) on delete cascade,
  cartes  int[] not null,
  score   int not null,
  le      timestamptz not null default now()
);
create index if not exists tirages_joueur on public.tirages (joueur, le desc);

-- ---------- Quêtes du jour ----------
create table if not exists public.quetes (
  id        text primary key,
  nom       text not null,
  objectif  int  not null,
  pieces    int  not null default 0,
  boosters  int  not null default 0,
  ordre     int  not null default 0
);
insert into public.quetes (id, nom, objectif, pieces, boosters, ordre) values
  ('ouvrir3',  'Ouvrir 3 boosters',                     3,  60, 0, 1),
  ('gratuit2', 'Récupérer 2 boosters gratuits',         2,   0, 1, 2),
  ('roue',     'Tourner la roue',                       1,  30, 0, 3),
  ('epique',   'Obtenir une carte épique ou mieux',     1,  80, 0, 4),
  ('ouvrir10', 'Ouvrir 10 boosters',                   10,   0, 2, 5)
on conflict (id) do nothing;

create table if not exists public.quetes_joueur (
  joueur    uuid not null references public.profils (id) on delete cascade,
  jour      date not null,
  quete     text not null references public.quetes (id),
  progres   int  not null default 0,
  recuperee boolean not null default false,
  primary key (joueur, jour, quete)
);

-- ---------- Récompenses de complétion ----------
create table if not exists public.recompenses (
  id        text primary key,            -- ex. 'ori:common', 'ori:all'
  nom       text not null,
  serie     text not null,
  rarete    text,                        -- null = toute la série (hors GOAT)
  pieces    int not null default 0,
  boosters  int not null default 0,
  ordre     int not null default 0
);
insert into public.recompenses (id, nom, serie, rarete, pieces, boosters, ordre) values
  ('ori:common',   'Toutes les communes',       'ori', 'common',      0,  2, 1),
  ('ori:uncommon', 'Toutes les peu communes',   'ori', 'uncommon',    0,  3, 2),
  ('ori:epic',     'Toutes les épiques',        'ori', 'epic',      500,  5, 3),
  ('ori:legend',   'Toutes les légendaires',    'ori', 'legend',   1000, 10, 4),
  ('ori:secret',   'Toutes les secrètes',       'ori', 'secret',   2000, 10, 5),
  ('ori:all',      'Série Origines complète',   'ori', null,       5000, 20, 6)
on conflict (id) do nothing;

create table if not exists public.recompenses_joueur (
  joueur     uuid not null references public.profils (id) on delete cascade,
  recompense text not null references public.recompenses (id),
  le         timestamptz not null default now(),
  primary key (joueur, recompense)
);

-- =====================================================================
-- Sécurité : RLS partout, lecture de ses propres lignes uniquement
-- =====================================================================
alter table public.reglages           enable row level security;
alter table public.cartes             enable row level security;
alter table public.profils            enable row level security;
alter table public.collection         enable row level security;
alter table public.tirages            enable row level security;
alter table public.quetes             enable row level security;
alter table public.quetes_joueur      enable row level security;
alter table public.recompenses        enable row level security;
alter table public.recompenses_joueur enable row level security;

drop policy if exists "lecture publique" on public.cartes;
create policy "lecture publique" on public.cartes for select using (true);
drop policy if exists "lecture publique" on public.quetes;
create policy "lecture publique" on public.quetes for select using (true);
drop policy if exists "lecture publique" on public.recompenses;
create policy "lecture publique" on public.recompenses for select using (true);
drop policy if exists "lecture publique" on public.reglages;
create policy "lecture publique" on public.reglages for select using (true);

drop policy if exists "mon profil" on public.profils;
create policy "mon profil" on public.profils for select to authenticated using (id = (select auth.uid()));
drop policy if exists "ma collection" on public.collection;
create policy "ma collection" on public.collection for select to authenticated using (joueur = (select auth.uid()));
drop policy if exists "mes tirages" on public.tirages;
create policy "mes tirages" on public.tirages for select to authenticated using (joueur = (select auth.uid()));
drop policy if exists "mes quetes" on public.quetes_joueur;
create policy "mes quetes" on public.quetes_joueur for select to authenticated using (joueur = (select auth.uid()));
drop policy if exists "mes recompenses" on public.recompenses_joueur;
create policy "mes recompenses" on public.recompenses_joueur for select to authenticated using (joueur = (select auth.uid()));

-- Aucune écriture directe possible depuis le navigateur
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

-- =====================================================================
-- Outils internes
-- =====================================================================
-- Nombre aléatoire sûr (cryptographique) entre 0 et n-1
create or replace function public._alea(n int) returns int
language sql volatile set search_path = '' as $$
  select (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % n)::int
$$;

-- Tire une rareté selon une table de poids {"rarete": poids}
create or replace function public._tirer_rarete(poids jsonb) returns text
language plpgsql volatile set search_path = '' as $$
declare total int := 0; r int; k text; v int;
begin
  select sum(value::int) into total from jsonb_each_text(poids);
  r := public._alea(total);
  for k, v in select key, value::int from jsonb_each_text(poids) order by value::int desc loop
    if r < v then return k; end if;
    r := r - v;
  end loop;
  return 'common';
end $$;

-- Jour de jeu (les quêtes changent à minuit, heure de Paris)
create or replace function public._jour() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Europe/Paris')::date $$;

-- Avance une quête du jour
create or replace function public._quete(j uuid, q text, n int) returns void
language sql volatile set search_path = '' as $$
  insert into public.quetes_joueur (joueur, jour, quete, progres) values (j, public._jour(), q, n)
  on conflict (joueur, jour, quete) do update set progres = public.quetes_joueur.progres + excluded.progres
$$;

-- Vérifie qu'un joueur est connecté et a un profil ; renvoie son id
create or replace function public._moi() returns uuid
language plpgsql stable set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Connecte-toi pour jouer.' using errcode = '28000'; end if;
  if not exists (select 1 from public.profils where id = u) then raise exception 'Profil introuvable.' using errcode = 'P0002'; end if;
  return u;
end $$;

-- =====================================================================
-- Création du profil à l'inscription (Google, Discord ou mail)
-- =====================================================================
create or replace function public._nouveau_joueur() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p text := nullif(trim(new.raw_user_meta_data ->> 'pseudo'), ''); cadeau jsonb := public.reglage('cadeau_depart');
begin
  -- Le pseudo choisi à l'inscription par mail ; sinon il sera demandé ensuite
  if p is not null and (p !~ '^[A-Za-z0-9_.-]{3,16}$' or exists (select 1 from public.profils where lower(pseudo) = lower(p))) then p := null; end if;
  insert into public.profils (id, pseudo, pieces, boosters) values
    (new.id, p, coalesce((cadeau ->> 'pieces')::int, 0), coalesce((cadeau ->> 'boosters')::int, 0));
  return new;
end $$;
drop trigger if exists nouveau_joueur on auth.users;
create trigger nouveau_joueur after insert on auth.users for each row execute function public._nouveau_joueur();

-- =====================================================================
-- Fonctions appelées par le site
-- =====================================================================

-- Pseudo libre ? (utilisé pendant l'inscription, avant d'avoir un compte)
create or replace function public.pseudo_libre(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p ~ '^[A-Za-z0-9_.-]{3,16}$' and not exists (select 1 from public.profils where lower(pseudo) = lower(p))
$$;

-- Choisir ou changer son pseudo
create or replace function public.choisir_pseudo(p text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi();
begin
  p := trim(p);
  if p !~ '^[A-Za-z0-9_.-]{3,16}$' then raise exception 'Le pseudo doit faire 3 à 16 caractères : lettres, chiffres, point, _ ou -.'; end if;
  if exists (select 1 from public.profils where lower(pseudo) = lower(p) and id <> u) then raise exception 'Ce pseudo est déjà pris.'; end if;
  update public.profils set pseudo = p where id = u;
  return p;
end $$;

-- Tout l'état du joueur en un appel
create or replace function public.mon_etat() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); pr public.profils; j date := public._jour();
begin
  select * into pr from public.profils where id = u;
  return jsonb_build_object(
    'pseudo', pr.pseudo, 'pieces', pr.pieces, 'boosters', pr.boosters,
    'ouverts', pr.ouverts, 'achetes', pr.achetes, 'depense', pr.depense, 'cree_le', pr.cree_le,
    'maintenant', now(),
    'prochain_gratuit', coalesce(pr.dernier_gratuit + make_interval(mins => (public.reglage('gratuit_minutes'))::int), now() - interval '1 second'),
    'prochaine_roue',   coalesce(pr.derniere_roue + make_interval(hours => (public.reglage('roue_heures'))::int), now() - interval '1 second'),
    'prix', jsonb_build_object('un', public.reglage('prix_booster'), 'cinq', public.reglage('prix_lot5')),
    'collection', coalesce((select jsonb_object_agg(carte, nombre) from public.collection where joueur = u), '{}'::jsonb),
    'quetes', (select jsonb_agg(jsonb_build_object('id', q.id, 'nom', q.nom, 'objectif', q.objectif, 'pieces', q.pieces, 'boosters', q.boosters,
                  'progres', least(coalesce(qj.progres, 0), q.objectif), 'recuperee', coalesce(qj.recuperee, false)) order by q.ordre)
               from public.quetes q left join public.quetes_joueur qj on qj.quete = q.id and qj.joueur = u and qj.jour = j),
    'recompenses', (select jsonb_agg(jsonb_build_object('id', r.id, 'nom', r.nom, 'rarete', r.rarete, 'pieces', r.pieces, 'boosters', r.boosters,
                  'total', (select count(*) from public.cartes c where c.serie = r.serie and c.rarete <> 'goat' and (r.rarete is null or c.rarete = r.rarete)),
                  'possede', (select count(*) from public.collection co join public.cartes c on c.id = co.carte where co.joueur = u and c.serie = r.serie and c.rarete <> 'goat' and (r.rarete is null or c.rarete = r.rarete)),
                  'recuperee', exists (select 1 from public.recompenses_joueur rj where rj.joueur = u and rj.recompense = r.id)) order by r.ordre)
               from public.recompenses r)
  );
end $$;

-- Acheter des boosters (1 ou 5)
create or replace function public.acheter_boosters(quantite int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); prix int;
begin
  if quantite not in (1, 5) then raise exception 'Quantité invalide.'; end if;
  prix := case quantite when 1 then (public.reglage('prix_booster'))::int else (public.reglage('prix_lot5'))::int end;
  update public.profils set pieces = pieces - prix, boosters = boosters + quantite, achetes = achetes + quantite, depense = depense + prix
    where id = u and pieces >= prix;
  if not found then raise exception 'Pas assez de pièces.'; end if;
  return jsonb_build_object('pieces', (select pieces from public.profils where id = u), 'boosters', (select boosters from public.profils where id = u));
end $$;

-- Booster gratuit (toutes les heures, ne se cumule pas)
create or replace function public.recuperer_gratuit() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); m int := (public.reglage('gratuit_minutes'))::int;
begin
  update public.profils set boosters = boosters + 1, dernier_gratuit = now()
    where id = u and (dernier_gratuit is null or dernier_gratuit <= now() - make_interval(mins => m));
  if not found then raise exception 'Le booster gratuit n''est pas encore prêt.'; end if;
  perform public._quete(u, 'gratuit2', 1);
  return jsonb_build_object('boosters', (select boosters from public.profils where id = u));
end $$;

-- Roue quotidienne : 0 à 4 boosters
create or replace function public.tourner_roue() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); h int := (public.reglage('roue_heures'))::int; cases jsonb := public.reglage('roue');
        total int; r int; c jsonb; idx int := 0; gagne int := 0; choisi int := 0;
begin
  perform 1 from public.profils where id = u and (derniere_roue is null or derniere_roue <= now() - make_interval(hours => h)) for update;
  if not found then raise exception 'La roue n''est pas encore prête.'; end if;
  select sum((x ->> 'poids')::int) into total from jsonb_array_elements(cases) x;
  r := public._alea(total);
  for c in select x from jsonb_array_elements(cases) x loop
    if r < (c ->> 'poids')::int then gagne := (c ->> 'boosters')::int; choisi := idx; exit; end if;
    r := r - (c ->> 'poids')::int; idx := idx + 1;
  end loop;
  update public.profils set boosters = boosters + gagne, derniere_roue = now() where id = u;
  perform public._quete(u, 'roue', 1);
  return jsonb_build_object('gagne', gagne, 'case', choisi, 'boosters', (select boosters from public.profils where id = u));
end $$;

-- Ouvrir un booster : tirage sur le serveur, score et pièces
create or replace function public.ouvrir_booster() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); ch jsonb := public.reglage('chances'); chr jsonb := public.reglage('chances_rare'); pts jsonb := public.reglage('points');
        tirees int[] := '{}'; nouvelles int[] := '{}'; rar text; c_id int; score int := 0; i int; meilleure boolean := false;
begin
  update public.profils set boosters = boosters - 1, ouverts = ouverts + 1 where id = u and boosters >= 1;
  if not found then raise exception 'Tu n''as plus de booster à ouvrir.'; end if;
  for i in 1..5 loop
    rar := public._tirer_rarete(case when i = 5 then chr else ch end);
    select id into c_id from public.cartes where serie = 'ori' and rarete = rar order by public._alea(1000000) limit 1;
    tirees := tirees || c_id;
    score := score + (pts ->> rar)::int;
    if rar in ('epic','legend','secret','goat') then meilleure := true; end if;
    if not exists (select 1 from public.collection co where co.joueur = u and co.carte = c_id) and not (c_id = any(nouvelles)) then
      nouvelles := nouvelles || c_id;
    end if;
    insert into public.collection as co (joueur, carte) values (u, c_id)
      on conflict (joueur, carte) do update set nombre = co.nombre + 1;
  end loop;
  -- Le score du booster rapporte autant de pièces
  update public.profils set pieces = pieces + score where id = u;
  insert into public.tirages (joueur, cartes, score) values (u, tirees, score);
  perform public._quete(u, 'ouvrir3', 1);
  perform public._quete(u, 'ouvrir10', 1);
  if meilleure then perform public._quete(u, 'epique', 1); end if;
  return jsonb_build_object('cartes', tirees, 'nouvelles', nouvelles, 'score', score,
    'pieces', (select pieces from public.profils where id = u), 'boosters', (select boosters from public.profils where id = u));
end $$;

-- Récupérer la récompense d'une quête terminée
create or replace function public.recuperer_quete(q text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); qt public.quetes;
begin
  select * into qt from public.quetes where id = q;
  if not found then raise exception 'Quête inconnue.'; end if;
  update public.quetes_joueur set recuperee = true
    where joueur = u and jour = public._jour() and quete = q and progres >= qt.objectif and not recuperee;
  if not found then raise exception 'Quête pas encore terminée ou déjà récupérée.'; end if;
  update public.profils set pieces = pieces + qt.pieces, boosters = boosters + qt.boosters where id = u;
  return jsonb_build_object('pieces', qt.pieces, 'boosters', qt.boosters);
end $$;

-- Récupérer une récompense de complétion (rareté ou série complète)
create or replace function public.recuperer_recompense(r text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := public._moi(); rc public.recompenses; total int; possede int;
begin
  select * into rc from public.recompenses where id = r;
  if not found then raise exception 'Récompense inconnue.'; end if;
  select count(*) into total from public.cartes c where c.serie = rc.serie and c.rarete <> 'goat' and (rc.rarete is null or c.rarete = rc.rarete);
  select count(*) into possede from public.collection co join public.cartes c on c.id = co.carte
    where co.joueur = u and c.serie = rc.serie and c.rarete <> 'goat' and (rc.rarete is null or c.rarete = rc.rarete);
  if possede < total then raise exception 'Il te manque encore % carte(s).', total - possede; end if;
  insert into public.recompenses_joueur (joueur, recompense) values (u, r) on conflict do nothing;
  if not found then raise exception 'Récompense déjà récupérée.'; end if;
  update public.profils set pieces = pieces + rc.pieces, boosters = boosters + rc.boosters where id = u;
  return jsonb_build_object('pieces', rc.pieces, 'boosters', rc.boosters);
end $$;

-- Classement public : pseudo et chiffres seulement
create or replace function public.classement(tri text default 'score') returns table (pseudo text, score bigint, legendaires bigint, cartes bigint)
language sql stable security definer set search_path = '' as $$
  with s as (
    select p.pseudo,
           coalesce(sum((public.reglage('points') ->> c.rarete)::int), 0) as score,
           count(*) filter (where c.rarete in ('legend','secret','goat')) as legendaires,
           count(c.id) as cartes
    from public.profils p
    left join public.collection co on co.joueur = p.id
    left join public.cartes c on c.id = co.carte
    where p.pseudo is not null
    group by p.id, p.pseudo
  )
  select * from s order by case tri when 'legendaires' then legendaires when 'cartes' then cartes else score end desc, pseudo
  limit 100
$$;

-- Droits : seules ces fonctions sont appelables, et seulement connecté (sauf pseudo_libre et classement)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.pseudo_libre(text), public.classement(text) to anon, authenticated;
grant execute on function public.choisir_pseudo(text), public.mon_etat(), public.acheter_boosters(int), public.recuperer_gratuit(),
  public.tourner_roue(), public.ouvrir_booster(), public.recuperer_quete(text), public.recuperer_recompense(text) to authenticated;

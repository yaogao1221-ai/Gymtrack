-- GymTrack v9 : compétitions de la ligue.
-- Migration additive : aucune table existante n'est supprimée ni réécrite. Les pas (ligue.steps, raccourcis « pas » et « sante »)
-- ne sont pas modifiés : les compétitions les lisent seulement.

-- 1. Rôles dans la ligue (le créateur, c'est-à-dire le premier membre, devient admin)
alter table ligue.members add column if not exists role text not null default 'member' check (role in ('admin','member'));
update ligue.members m set role = 'admin'
  where m.id = (select x.id from ligue.members x where x.league_id = m.league_id order by x.created_at limit 1) and m.role <> 'admin';

-- 2. Totaux par jour envoyés par le téléphone (séances terminées, séries, records, cardio). Une ligne par membre et par jour,
--    remplacée à chaque synchro : un renvoi ou une correction ne crée jamais de doublon.
create table if not exists ligue.days (
  member_id uuid not null references ligue.members(id) on delete cascade,
  day date not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, day)
);
alter table ligue.days enable row level security;

-- 3. Compétitions : chacune a son identifiant, ses dates, ses participants et son cycle de vie
create table if not exists ligue.competitions (
  id bigint generated always as identity primary key,
  league_id uuid not null references ligue.leagues(id) on delete cascade,
  creator_id uuid not null references ligue.members(id),
  title text not null,
  description text,
  metric text not null,
  mode text not null default 'solo' check (mode in ('solo','team')),
  goal numeric,
  start_d date not null,
  end_d date not null,
  max_n int not null default 20,
  scope text not null default 'league' check (scope in ('league','invite')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  final jsonb,
  finalized_at timestamptz,
  check (end_d >= start_d)
);
create index if not exists competitions_league on ligue.competitions(league_id, end_d);
alter table ligue.competitions enable row level security;

create table if not exists ligue.comp_members (
  competition_id bigint not null references ligue.competitions(id) on delete cascade,
  member_id uuid not null references ligue.members(id) on delete cascade,
  state text not null check (state in ('invited','joined','declined','left')),
  invited_by uuid,
  updated_at timestamptz not null default now(),
  primary key (competition_id, member_id)
);
alter table ligue.comp_members enable row level security;

-- 4. Événements réels du fil (compétition créée/terminée, séance terminée, record)
create table if not exists ligue.events (
  id bigint generated always as identity primary key,
  league_id uuid not null references ligue.leagues(id) on delete cascade,
  member_id uuid references ligue.members(id) on delete cascade,
  kind text not null,
  competition_id bigint references ligue.competitions(id) on delete cascade,
  day date,
  data jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists events_once_per_day on ligue.events(member_id, kind, day) where competition_id is null;
create unique index if not exists events_once_per_comp on ligue.events(competition_id, kind) where competition_id is not null;
create index if not exists events_league on ligue.events(league_id, created_at desc);
alter table ligue.events enable row level security;

-- ---------- Moteur de scoring (déterministe, côté base) ----------
create or replace function ligue.league_today(lid uuid) returns date language sql stable set search_path = '' as $$
  select (now() at time zone coalesce((select m.tz from ligue.members m where m.league_id = lid and m.tz is not null order by m.created_at limit 1), 'America/Toronto'))::date
$$;

-- Valeur d'une journée pour une métrique. Plafonds par jour : une compétition ne doit jamais pousser au surentraînement.
create or replace function ligue.comp_day_value(p_metric text, d jsonb, p_steps int, p_goal numeric) returns numeric
language sql immutable set search_path = '' as $$
  select case p_metric
    when 'steps' then coalesce(p_steps, 0)::numeric
    when 'goal_days' then case when coalesce(p_steps, 0) >= coalesce(p_goal, 10000) then 1 else 0 end
    when 'workouts' then least(coalesce((d->>'workouts')::numeric, 0), 1)
    when 'active_days' then case when coalesce((d->>'workouts')::numeric, 0) + coalesce((d->>'cardio_n')::numeric, 0) > 0 then 1 else 0 end
    when 'sets' then least(coalesce((d->>'sets')::numeric, 0), 30)
    when 'prs' then least(coalesce((d->>'prs')::numeric, 0), 5)
    when 'km' then least(coalesce((d->>'km')::numeric, 0), 42.2)
    when 'cardio_min' then least(coalesce((d->>'cardio_min')::numeric, 0), 180)
    else 0 end
$$;

-- Classement d'une compétition à une date donnée (jour inclus). Ne lit que les données de SES participants et de SES dates :
-- deux compétitions ne peuvent pas s'influencer.
create or replace function ligue.comp_standings(p_id bigint, p_asof date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare c ligue.competitions; e date; n int; cap numeric;
begin
  select * into c from ligue.competitions where id = p_id;
  if c.id is null then return '[]'::jsonb; end if;
  e := least(c.end_d, p_asof);
  n := greatest(0, e - c.start_d + 1);
  -- séances et jours actifs : 6 jours sur 7 au maximum, un jour de repos ne coûte rien
  cap := (case when c.metric in ('workouts','active_days') then ceil(n * 6 / 7.0) else null end);
  return coalesce((
    select jsonb_agg(jsonb_build_object('member', t.member_id, 'score', t.score, 'rank', t.rk, 'days', t.days_with_data) order by t.rk, t.member_id)
    from (
      select s.member_id, s.score, rank() over (order by s.score desc) rk, s.days_with_data
      from (
        select p.member_id,
          round(case when cap is null then coalesce(sum(v.v), 0) else least(coalesce(sum(v.v), 0), cap) end, 1) score,
          count(v.has) days_with_data
        from ligue.comp_members p
        left join lateral (
          select ligue.comp_day_value(c.metric, dd.data, st.steps, c.goal) v, case when dd.day is not null or st.day is not null then 1 end has
          from generate_series(c.start_d, e, interval '1 day') g(day)
          left join ligue.days dd on dd.member_id = p.member_id and dd.day = g.day::date
          left join ligue.steps st on st.member_id = p.member_id and st.day = g.day::date
          where n > 0
        ) v on true
        where p.competition_id = p_id and p.state = 'joined'
        group by p.member_id
      ) s
    ) t), '[]'::jsonb);
end $$;

create or replace function ligue.comp_status(c ligue.competitions, p_today date) returns text language sql immutable set search_path = '' as $$
  select case when c.cancelled_at is not null then 'cancelled'
    when c.finalized_at is not null then 'finished'
    when p_today < c.start_d then 'upcoming'
    when p_today <= c.end_d then 'active'
    when p_today <= c.end_d + 1 then 'closing'   -- 1 jour de grâce pour les synchros tardives
    else 'finished' end
$$;

-- Fige le résultat final une seule fois (jamais réécrit ensuite), attribue le titre et publie l'événement
create or replace function ligue.comp_finalize(p_id bigint) returns void language plpgsql set search_path = '' as $$
declare c ligue.competitions; st jsonb; total numeric; win uuid;
begin
  select * into c from ligue.competitions where id = p_id for update;
  if c.id is null or c.finalized_at is not null or c.cancelled_at is not null then return; end if;
  if ligue.league_today(c.league_id) <= c.end_d + 1 then return; end if;
  st := ligue.comp_standings(p_id, c.end_d);
  select coalesce(sum((x->>'score')::numeric), 0) into total from jsonb_array_elements(st) x;
  select (x->>'member')::uuid into win from jsonb_array_elements(st) x where (x->>'rank')::int = 1 and (x->>'score')::numeric > 0 order by x->>'member' limit 1;
  update ligue.competitions set finalized_at = now(), final = jsonb_build_object(
    'standings', (select coalesce(jsonb_agg(x || jsonb_build_object('pseudo', m.pseudo)), '[]'::jsonb) from jsonb_array_elements(st) x join ligue.members m on m.id = (x->>'member')::uuid),
    'total', total, 'success', case when c.mode = 'team' then total >= coalesce(c.goal, 0) else null end,
    'winner', case when c.mode = 'solo' then win else null end, 'computed_at', now())
  where id = p_id;
  insert into ligue.events(league_id, member_id, kind, competition_id, data)
  values (c.league_id, case when c.mode = 'solo' then win else null end, 'comp_finished', p_id,
    jsonb_build_object('title', c.title, 'total', total, 'success', case when c.mode = 'team' then total >= coalesce(c.goal, 0) else null end))
  on conflict do nothing;
end $$;

create or replace function ligue.comp_visible(c ligue.competitions, p_member uuid) returns boolean language sql stable set search_path = '' as $$
  select c.scope = 'league' or exists (select 1 from ligue.comp_members x where x.competition_id = c.id and x.member_id = p_member)
$$;

-- ---------- RPC publiques ----------
-- Totaux par jour (35 derniers jours) : idempotent, valeurs bornées, champs inconnus ignorés
create or replace function public.ligue_days(p_member uuid, p_token text, p_days jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); t date := ligue.league_today(lid); x jsonb; d date; old jsonb; nw jsonb; k int := 0;
  num text[] := array['workouts','sets','prs','km','cardio_min','cardio_n'];
  mx numeric[] := array[4, 80, 30, 300, 900, 8];
  i int; v numeric;
begin
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 62 then raise exception 'Données invalides' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(p_days) loop
    begin d := (x->>'day')::date; exception when others then continue; end;
    if d is null or d < t - 60 or d > t + 1 then continue; end if;
    nw := '{}'::jsonb;
    for i in 1..array_length(num, 1) loop
      v := ligue.num(x->>num[i]);
      if v is not null and v >= 0 then nw := nw || jsonb_build_object(num[i], least(round(v, 1), mx[i])); end if;
    end loop;
    old := null;
    select data into old from ligue.days where member_id = p_member and day = d;
    if old is not distinct from nw then continue; end if;
    insert into ligue.days(member_id, day, data) values (p_member, d, nw)
      on conflict (member_id, day) do update set data = excluded.data, updated_at = now();
    k := k + 1;
    -- Fil : séance terminée / record, une fois par jour, seulement pour les 2 derniers jours (pas de rattrapage bruyant)
    if d >= t - 1 then
      if coalesce((nw->>'workouts')::numeric, 0) > coalesce((old->>'workouts')::numeric, 0) then
        insert into ligue.events(league_id, member_id, kind, day, data) values (lid, p_member, 'workout', d, jsonb_build_object('sets', nw->'sets')) on conflict do nothing;
      end if;
      if coalesce((nw->>'prs')::numeric, 0) > coalesce((old->>'prs')::numeric, 0) then
        insert into ligue.events(league_id, member_id, kind, day, data) values (lid, p_member, 'record', d, jsonb_build_object('n', nw->'prs')) on conflict (member_id, kind, day) where competition_id is null do update set data = excluded.data;
      end if;
    end if;
  end loop;
  return jsonb_build_object('updated', k);
end $$;

create or replace function public.ligue_comp_create(p_member uuid, p_token text, p_c jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); t date := ligue.league_today(lid); nid bigint;
  ttl text := btrim(coalesce(p_c->>'title', '')); descr text := nullif(btrim(coalesce(p_c->>'description', '')), '');
  met text := p_c->>'metric'; md text := coalesce(p_c->>'mode', 'solo'); sc text := coalesce(p_c->>'scope', 'league');
  s date; e date; mx int; g numeric; ndays int; inv uuid; me ligue.members; per_day numeric;
begin
  select * into me from ligue.members where id = p_member;
  if char_length(ttl) < 2 or char_length(ttl) > 60 then raise exception 'Nom de compétition invalide (2 à 60 caractères)' using errcode = '22023'; end if;
  if char_length(coalesce(descr, '')) > 280 then raise exception 'Description trop longue' using errcode = '22023'; end if;
  if met is null or met not in ('steps','goal_days','workouts','active_days','sets','prs','km','cardio_min') then raise exception 'Type de compétition inconnu' using errcode = '22023'; end if;
  if md not in ('solo','team') then raise exception 'Mode invalide' using errcode = '22023'; end if;
  if md = 'team' and met not in ('steps','workouts','active_days','km','cardio_min') then raise exception 'Ce type ne peut pas être collectif' using errcode = '22023'; end if;
  if sc not in ('league','invite') then raise exception 'Visibilité invalide' using errcode = '22023'; end if;
  begin s := (p_c->>'start')::date; e := (p_c->>'end')::date; exception when others then raise exception 'Dates invalides' using errcode = '22023'; end;
  if s is null or e is null or s < t or s > t + 60 then raise exception 'Le début doit être entre aujourd''hui et dans 60 jours' using errcode = '22023'; end if;
  ndays := e - s + 1;
  if ndays < 1 or ndays > 90 then raise exception 'Durée entre 1 et 90 jours' using errcode = '22023'; end if;
  mx := coalesce((p_c->>'max_n')::int, 20);
  if mx < 2 or mx > 50 then raise exception 'Entre 2 et 50 participants' using errcode = '22023'; end if;
  g := ligue.num(p_c->>'goal');
  if met = 'goal_days' and (g is null or g < 1000 or g > 40000) then raise exception 'Objectif quotidien de pas entre 1 000 et 40 000' using errcode = '22023'; end if;
  if md = 'team' and (g is null or g <= 0) then raise exception 'Un défi collectif a besoin d''un objectif' using errcode = '22023'; end if;
  per_day := (case met when 'steps' then 30000 when 'km' then 20 when 'cardio_min' then 120 else 1 end);
  if md = 'team' and g > ndays * mx * per_day then raise exception 'Objectif collectif irréaliste pour cette durée' using errcode = '22023'; end if;
  if md = 'solo' and met <> 'goal_days' then g := null; end if;
  if (select count(*) from ligue.competitions x where x.league_id = lid and x.cancelled_at is null and x.finalized_at is null and x.end_d >= t - 1) >= 15 then
    raise exception 'Déjà 15 compétitions en cours ou à venir dans la ligue' using errcode = '22023'; end if;
  insert into ligue.competitions(league_id, creator_id, title, description, metric, mode, goal, start_d, end_d, max_n, scope)
  values (lid, p_member, ttl, descr, met, md, g, s, e, mx, sc) returning id into nid;
  insert into ligue.comp_members(competition_id, member_id, state, invited_by) values (nid, p_member, 'joined', p_member);
  for inv in select distinct (jsonb_array_elements_text(coalesce(p_c->'invite', '[]'::jsonb)))::uuid loop
    if inv <> p_member and exists (select 1 from ligue.members m where m.id = inv and m.league_id = lid and m.left_at is null) then
      insert into ligue.comp_members(competition_id, member_id, state, invited_by) values (nid, inv, 'invited', p_member) on conflict do nothing;
    end if;
  end loop;
  insert into ligue.events(league_id, member_id, kind, competition_id, data) values (lid, p_member, 'comp_created', nid, jsonb_build_object('title', ttl, 'metric', met, 'mode', md));
  perform ligue.notify(array(select member_id from ligue.comp_members where competition_id = nid and state = 'invited'), 'challenge',
    me.pseudo || ' t''invite', ttl, null, 'comp' || nid);
  return nid;
end $$;

create or replace function public.ligue_comp_respond(p_member uuid, p_token text, p_id bigint, p_action text) returns text
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); c ligue.competitions; st text; cur text;
begin
  select * into c from ligue.competitions where id = p_id and league_id = lid for update;
  if c.id is null or not ligue.comp_visible(c, p_member) then raise exception 'Compétition introuvable' using errcode = '22023'; end if;
  st := ligue.comp_status(c, ligue.league_today(lid));
  if st in ('finished','cancelled','closing') then raise exception 'Compétition terminée' using errcode = '22023'; end if;
  select state into cur from ligue.comp_members where competition_id = p_id and member_id = p_member;
  if p_action = 'join' then
    if cur = 'joined' then return 'joined'; end if;
    if c.scope = 'invite' and cur is null then raise exception 'Sur invitation seulement' using errcode = '22023'; end if;
    if (select count(*) from ligue.comp_members where competition_id = p_id and state = 'joined') >= c.max_n then raise exception 'Compétition complète' using errcode = '22023'; end if;
    insert into ligue.comp_members(competition_id, member_id, state) values (p_id, p_member, 'joined')
      on conflict (competition_id, member_id) do update set state = 'joined', updated_at = now();
    return 'joined';
  elsif p_action = 'decline' and cur = 'invited' then
    update ligue.comp_members set state = 'declined', updated_at = now() where competition_id = p_id and member_id = p_member; return 'declined';
  elsif p_action = 'leave' and cur = 'joined' then
    update ligue.comp_members set state = 'left', updated_at = now() where competition_id = p_id and member_id = p_member; return 'left';
  end if;
  raise exception 'Action impossible' using errcode = '22023';
end $$;

create or replace function public.ligue_comp_invite(p_member uuid, p_token text, p_id bigint, p_members uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); c ligue.competitions; k int := 0; x uuid; me text;
begin
  select * into c from ligue.competitions where id = p_id and league_id = lid;
  if c.id is null or not exists (select 1 from ligue.comp_members where competition_id = p_id and member_id = p_member and state = 'joined') then
    raise exception 'Seuls les participants peuvent inviter' using errcode = '22023'; end if;
  if ligue.comp_status(c, ligue.league_today(lid)) not in ('upcoming','active') then raise exception 'Compétition terminée' using errcode = '22023'; end if;
  foreach x in array coalesce(p_members, '{}') loop
    if exists (select 1 from ligue.members m where m.id = x and m.league_id = lid and m.left_at is null) then
      insert into ligue.comp_members(competition_id, member_id, state, invited_by) values (p_id, x, 'invited', p_member)
        on conflict (competition_id, member_id) do update set state = 'invited', invited_by = p_member, updated_at = now() where ligue.comp_members.state in ('declined','left');
      k := k + 1;
    end if;
  end loop;
  select pseudo into me from ligue.members where id = p_member;
  perform ligue.notify(p_members, 'challenge', me || ' t''invite', c.title, null, 'comp' || p_id);
  return k;
end $$;

-- Annuler : le créateur ou un admin, seulement avant le début ou si personne d'autre n'y participe (on ne vole pas une compétition en cours)
create or replace function public.ligue_comp_cancel(p_member uuid, p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); c ligue.competitions; st text;
begin
  select * into c from ligue.competitions where id = p_id and league_id = lid for update;
  if c.id is null then raise exception 'Compétition introuvable' using errcode = '22023'; end if;
  if c.creator_id <> p_member and (select role from ligue.members where id = p_member) <> 'admin' then raise exception 'Réservé au créateur ou à un admin' using errcode = '22023'; end if;
  st := ligue.comp_status(c, ligue.league_today(lid));
  if st in ('finished','cancelled') then raise exception 'Compétition déjà terminée : son résultat est conservé' using errcode = '22023'; end if;
  if st <> 'upcoming' and (select count(*) from ligue.comp_members where competition_id = p_id and state = 'joined' and member_id <> c.creator_id) > 0 then
    raise exception 'Compétition en cours avec d''autres participants : elle ne peut plus être annulée' using errcode = '22023'; end if;
  update ligue.competitions set cancelled_at = now() where id = p_id;
end $$;

create or replace function ligue.comp_card(c ligue.competitions, p_member uuid, t date) returns jsonb language plpgsql stable set search_path = '' as $$
declare st jsonb; mine jsonb; lead jsonb; total numeric; s text := ligue.comp_status(c, t);
begin
  st := case when c.final is not null then c.final->'standings' when s = 'upcoming' then '[]'::jsonb else ligue.comp_standings(c.id, t) end;
  select x into mine from jsonb_array_elements(st) x where x->>'member' = p_member::text;
  select x into lead from jsonb_array_elements(st) x order by (x->>'rank')::int, x->>'member' limit 1;
  select coalesce(sum((x->>'score')::numeric), 0) into total from jsonb_array_elements(st) x;
  return jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'metric', c.metric, 'mode', c.mode, 'goal', c.goal,
    'start', c.start_d, 'end', c.end_d, 'max_n', c.max_n, 'scope', c.scope, 'creator', c.creator_id, 'status', s, 'today', t,
    'joined', (select count(*) from ligue.comp_members x where x.competition_id = c.id and x.state = 'joined'),
    'my_state', (select x.state from ligue.comp_members x where x.competition_id = c.id and x.member_id = p_member),
    'me', mine, 'leader', lead, 'total', total, 'final', c.final is not null,
    'success', c.final->'success', 'winner', c.final->'winner');
end $$;

create or replace function public.ligue_comps(p_member uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); t date := ligue.league_today(lid); r record;
begin
  for r in select id from ligue.competitions where league_id = lid and finalized_at is null and cancelled_at is null and end_d + 1 < t loop
    perform ligue.comp_finalize(r.id);
  end loop;
  return jsonb_build_object('today', t,
    'list', coalesce((select jsonb_agg(ligue.comp_card(c, p_member, t) order by c.end_d desc, c.id desc)
      from ligue.competitions c where c.league_id = lid and c.cancelled_at is null and ligue.comp_visible(c, p_member)
        and (c.finalized_at is null or c.end_d >= t - 120)), '[]'::jsonb),
    -- Palmarès : victoires figées de chaque membre (compétitions individuelles avec au moins 2 participants)
    'trophies', coalesce((select jsonb_object_agg(w.winner, w.n) from (
      select c.final->>'winner' winner, count(*) n from ligue.competitions c
      where c.league_id = lid and c.final->>'winner' is not null and jsonb_array_length(c.final->'standings') >= 2 group by 1) w), '{}'::jsonb));
end $$;

create or replace function public.ligue_comp(p_member uuid, p_token text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); t date := ligue.league_today(lid); c ligue.competitions; s text; st jsonb; prev jsonb; e date;
begin
  perform ligue.comp_finalize(p_id);
  select * into c from ligue.competitions where id = p_id and league_id = lid;
  if c.id is null or c.cancelled_at is not null or not ligue.comp_visible(c, p_member) then raise exception 'Compétition introuvable' using errcode = '22023'; end if;
  s := ligue.comp_status(c, t);
  e := least(c.end_d, t);
  st := case when c.final is not null then c.final->'standings' when s = 'upcoming' then ligue.comp_standings(p_id, c.start_d - 1) else ligue.comp_standings(p_id, t) end;
  prev := case when s in ('active','closing') and e > c.start_d then ligue.comp_standings(p_id, e - 1) else '[]'::jsonb end;
  return ligue.comp_card(c, p_member, t) || jsonb_build_object(
    'standings', (select coalesce(jsonb_agg(x || jsonb_build_object(
        'prev_rank', (select (y->>'rank')::int from jsonb_array_elements(prev) y where y->>'member' = x->>'member'),
        'synced', greatest((select max(d.updated_at) from ligue.days d where d.member_id = (x->>'member')::uuid), (select max(sp.updated_at) from ligue.steps sp where sp.member_id = (x->>'member')::uuid)))
      order by (x->>'rank')::int, x->>'member'), '[]'::jsonb) from jsonb_array_elements(st) x),
    'participants', (select coalesce(jsonb_agg(jsonb_build_object('member', x.member_id, 'state', x.state) order by x.updated_at), '[]'::jsonb) from ligue.comp_members x where x.competition_id = p_id),
    -- Courbe : cumul jour par jour de chaque participant (données réelles uniquement)
    'series', case when s = 'upcoming' then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('day', g.day::date, 'v', (
        select coalesce(jsonb_object_agg(z->>'member', z->'score'), '{}'::jsonb) from jsonb_array_elements(ligue.comp_standings(p_id, g.day::date)) z)) order by g.day), '[]'::jsonb)
      from generate_series(c.start_d, e, interval '1 day') g(day) where e - c.start_d < 31) end,
    'events', (select coalesce(jsonb_agg(jsonb_build_object('kind', ev.kind, 'member', ev.member_id, 'data', ev.data, 'at', ev.created_at) order by ev.created_at desc), '[]'::jsonb)
      from ligue.events ev where ev.competition_id = p_id));
end $$;

-- Fil d'événements réels de la ligue
create or replace function public.ligue_events(p_member uuid, p_token text, p_limit int default 40) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token);
begin
  return coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', ev.id, 'kind', ev.kind, 'member', ev.member_id, 'competition', ev.competition_id, 'data', ev.data, 'day', ev.day, 'at', ev.created_at) x
    from ligue.events ev left join ligue.competitions c on c.id = ev.competition_id
    where ev.league_id = lid and (c.id is null or (c.cancelled_at is null and ligue.comp_visible(c, p_member)))
    order by ev.created_at desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) s), '[]'::jsonb);
end $$;

-- Paramètres de la ligue (admin) : nom
create or replace function public.ligue_settings(p_member uuid, p_token text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token);
begin
  if (select role from ligue.members where id = p_member) <> 'admin' then raise exception 'Réservé aux admins de la ligue' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 or char_length(p_name) > 40 then raise exception 'Nom invalide' using errcode = '22023'; end if;
  update ligue.leagues set name = btrim(p_name) where id = lid;
end $$;

-- ligue_board : identique, avec en plus le rôle de chaque membre
create or replace function public.ligue_board(p_member uuid, p_token text, p_periods jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lid uuid := ligue.auth(p_member, p_token); l ligue.leagues;
begin
  select * into l from ligue.leagues where id = lid;
  return jsonb_build_object(
    'league', jsonb_build_object('name', l.name, 'code', l.code, 'stake_week', l.stake_week, 'stake_month', l.stake_month, 'shortcut_url', l.shortcut_url, 'created_at', l.created_at),
    'me', p_member,
    'unread', (select count(*) from ligue.dms d where d.league_id = lid and d.to_id = p_member and d.read_at is null and d.hidden_to is null),
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'pseudo', m.pseudo, 'last_seen', m.last_seen, 'photo', m.photo, 'since', m.created_at, 'role', m.role,
      'shares', exists (select 1 from ligue.shares s where s.member_id = m.id and not (s.data ? 'off')),
      'periods', (select coalesce(jsonb_object_agg(pp->>'key', jsonb_build_object(
          'stats', (select st.data from ligue.stats st where st.member_id = m.id and st.period = pp->>'key'),
          'steps', (select coalesce(sum(sp.steps), 0) from ligue.steps sp where sp.member_id = m.id and sp.day between (pp->>'from')::date and (pp->>'to')::date))), '{}'::jsonb)
        from jsonb_array_elements(p_periods) pp)
    ) order by m.created_at) from ligue.members m where m.league_id = lid and m.left_at is null), '[]'::jsonb));
end $$;

revoke all on function public.ligue_days(uuid,text,jsonb), public.ligue_comp_create(uuid,text,jsonb), public.ligue_comp_respond(uuid,text,bigint,text),
  public.ligue_comp_invite(uuid,text,bigint,uuid[]), public.ligue_comp_cancel(uuid,text,bigint), public.ligue_comps(uuid,text),
  public.ligue_comp(uuid,text,bigint), public.ligue_events(uuid,text,int), public.ligue_settings(uuid,text,text) from public;
grant execute on function public.ligue_days(uuid,text,jsonb), public.ligue_comp_create(uuid,text,jsonb), public.ligue_comp_respond(uuid,text,bigint,text),
  public.ligue_comp_invite(uuid,text,bigint,uuid[]), public.ligue_comp_cancel(uuid,text,bigint), public.ligue_comps(uuid,text),
  public.ligue_comp(uuid,text,bigint), public.ligue_events(uuid,text,int), public.ligue_settings(uuid,text,text) to anon, authenticated;
revoke all on function ligue.comp_standings(bigint,date), ligue.comp_finalize(bigint), ligue.comp_day_value(text,jsonb,int,numeric),
  ligue.comp_status(ligue.competitions,date), ligue.comp_visible(ligue.competitions,uuid), ligue.comp_card(ligue.competitions,uuid,date), ligue.league_today(uuid) from public, anon, authenticated;

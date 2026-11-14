-- Test automatique du moteur de compétitions, à lancer dans l'éditeur SQL Supabase (ou via execute_sql).
-- Tout se passe dans un bloc qui se termine par une erreur volontaire « SELFTEST_OK » : rien n'est enregistré (annulation complète).
-- Toute autre erreur indique la règle cassée.
do $$
declare a jsonb; b jsonb; lid uuid; ma uuid; mb uuid; ta text; tb text; t date; c1 bigint; c2 bigint; c3 bigint; st jsonb; r text; fin jsonb; cnt int;
begin
  a := public.ligue_create('Test auto', 'Alpha'); ma := (a->>'member_id')::uuid; ta := a->>'token';
  b := public.ligue_join(a->>'code', 'Beta'); mb := (b->>'member_id')::uuid; tb := b->>'token';
  select league_id into lid from ligue.members where id = ma;
  t := ligue.league_today(lid);
  -- Pas : par le contrat du raccourci (ligue_pas / ligue_sante), envoyés deux fois → aucun doublon
  perform public.ligue_pas(ma::text || '.' || ta, 8000);
  perform public.ligue_pas(ma::text || '.' || ta, 9000);
  perform public.ligue_sante(mb::text || '.' || tb, '{"pas":"12 500"}'::jsonb);
  if (select count(*) from ligue.steps where member_id = ma) <> 1 then raise exception 'doublon pas'; end if;
  -- Totaux du jour envoyés deux fois → une seule ligne, un seul événement
  perform public.ligue_days(ma, ta, jsonb_build_array(jsonb_build_object('day', t, 'workouts', 3, 'sets', 50, 'prs', 2)));
  perform public.ligue_days(ma, ta, jsonb_build_array(jsonb_build_object('day', t, 'workouts', 3, 'sets', 50, 'prs', 2)));
  if (select count(*) from ligue.days where member_id = ma) <> 1 then raise exception 'doublon jours'; end if;
  if (select count(*) from ligue.events where member_id = ma and kind = 'workout') <> 1 then raise exception 'événement séance'; end if;
  -- Plusieurs compétitions en parallèle
  c1 := public.ligue_comp_create(ma, ta, jsonb_build_object('title','Pas 7 j','metric','steps','start',t,'end',t+6));
  c2 := public.ligue_comp_create(ma, ta, jsonb_build_object('title','Muscu','metric','workouts','start',t,'end',t+13,'scope','invite','invite',jsonb_build_array(mb)));
  r := public.ligue_comp_respond(mb, tb, c1, 'join');
  st := public.ligue_comp(ma, ta, c1)->'standings';
  if (st->0->>'member')::uuid <> mb or (st->0->>'score')::numeric <> 12500 or (st->1->>'score')::numeric <> 9000 then raise exception 'classement pas %', st; end if;
  -- Séances plafonnées à 1 par jour (pas de prime au surentraînement)
  st := public.ligue_comp(ma, ta, c2)->'standings';
  if jsonb_array_length(st) <> 1 or (st->0->>'score')::numeric <> 1 then raise exception 'plafond séances %', st; end if;
  -- Une nouvelle compétition ne modifie ni les scores ni l'état des autres
  c3 := public.ligue_comp_create(mb, tb, jsonb_build_object('title','Collectif','metric','steps','mode','team','goal',100000,'start',t,'end',t+2));
  st := public.ligue_comp(ma, ta, c1)->'standings';
  if (st->0->>'score')::numeric <> 12500 then raise exception 'c1 modifiée'; end if;
  if (select count(*) from ligue.competitions where league_id = lid and cancelled_at is null) <> 3 then raise exception 'compétitions perdues'; end if;
  if jsonb_array_length(public.ligue_comps(mb, tb)->'list') <> 3 then raise exception 'visibilité'; end if;
  -- Une compétition en cours avec d'autres participants ne peut pas être annulée
  begin perform public.ligue_comp_cancel(ma, ta, c1); raise exception 'annulation acceptée'; exception when sqlstate '22023' then null; end;
  -- Objectif collectif irréaliste refusé
  begin perform public.ligue_comp_create(ma, ta, jsonb_build_object('title','Fou','metric','km','mode','team','goal',99999,'start',t,'end',t)); raise exception 'objectif fou accepté'; exception when sqlstate '22023' then null; end;
  -- Fin : résultat figé, gagnant, palmarès, événement
  update ligue.competitions set start_d = t - 10, end_d = t - 3 where id = c1;
  update ligue.steps set day = t - 4 where member_id in (ma, mb);
  fin := public.ligue_comp(ma, ta, c1);
  if fin->>'status' <> 'finished' or (fin->>'winner')::uuid <> mb then raise exception 'résultat final %', fin; end if;
  -- Un résultat final n'est jamais réécrit, même si les données changent ensuite
  update ligue.steps set steps = 99999 where member_id = ma;
  fin := public.ligue_comp(ma, ta, c1);
  if (fin->>'winner')::uuid <> mb then raise exception 'résultat réécrit'; end if;
  if (public.ligue_comps(ma, ta)->'trophies'->>mb::text)::int <> 1 then raise exception 'palmarès'; end if;
  select count(*) into cnt from jsonb_array_elements(public.ligue_events(ma, ta, 50)) x where x->>'kind' = 'comp_finished';
  if cnt <> 1 then raise exception 'événement fin'; end if;
  raise exception 'SELFTEST_OK';
end $$;

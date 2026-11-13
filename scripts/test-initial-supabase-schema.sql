-- 仅在隔离测试库中运行；测试数据将在事务结束时回滚。
begin;

insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.qimen_records (id, user_id, question, qimen_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'A', '{}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'B', '{}');

insert into public.bazi_profiles (id, user_id, name, gender, birth_date, bazi_str) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'A', 'male', '2000-01-01', 'test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'B', 'female', '2000-01-01', 'test');

insert into public.fortune_cache (user_id, dimension, period_key, data_json, expires_at) values
  ('11111111-1111-4111-8111-111111111111', 'day', 'test', '{}', now() + interval '1 day'),
  ('22222222-2222-4222-8222-222222222222', 'day', 'test', '{}', now() + interval '1 day');

insert into public.qimen_question_audit (question) values ('test');
insert into public.compatibility_sessions (name_a) values ('test');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  affected integer;
  new_record_id uuid;
begin
  if (select count(*) from public.qimen_records) <> 1
    or (select count(*) from public.bazi_profiles) <> 1
    or (select count(*) from public.fortune_cache) <> 1 then
    raise exception 'A user can see another user''s records';
  end if;

  if (select count(*) from public.qimen_question_audit) <> 0 then
    raise exception 'A regular user can read audit records';
  end if;

  insert into public.qimen_records (user_id, question, category, qimen_data)
    values ('11111111-1111-4111-8111-111111111111', 'own record', 'general', '{}')
    returning id into new_record_id;
  update public.qimen_records set qimen_data = '{"updated":true}' where id = new_record_id;
  if not exists (
    select 1 from public.qimen_records where id = new_record_id and qimen_data->>'updated' = 'true'
  ) then
    raise exception 'A user cannot save and update their own record';
  end if;

  insert into public.bazi_profiles
    (user_id, name, gender, birth_date, bazi_str, birth_location, solar_time_mode)
    values ('11111111-1111-4111-8111-111111111111', 'own profile', 'male', '2000-01-01', 'test', '', 'clock');
  update public.bazi_profiles set favorable_elements = '["test"]'::jsonb
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  update public.qimen_records set qimen_data = '{"updated":true}'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'A user can update another user''s record';
  end if;

  delete from public.bazi_profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'A user can delete another user''s profile';
  end if;

  begin
    insert into public.qimen_records (user_id, question, qimen_data)
      values ('22222222-2222-4222-8222-222222222222', 'wrong owner', '{}');
    raise exception 'A user can insert a record for another user';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.qimen_records set created_at = now()
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'A user can change a record timestamp';
  exception when insufficient_privilege then null;
  end;

  insert into public.qimen_feedback (record_id, user_id, accuracy_status, actual_direction)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111', 'pending', 'pending');
  begin
    insert into public.qimen_feedback (record_id, user_id, accuracy_status, actual_direction)
      values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '11111111-1111-4111-8111-111111111111', 'pending', 'pending');
    raise exception 'A user can add feedback to another user''s record';
  exception when insufficient_privilege then null;
  end;

  if has_table_privilege(current_user, 'public.profile_contexts', 'select')
    or has_table_privilege(current_user, 'public.compatibility_sessions', 'select')
    or has_table_privilege(current_user, 'public.fortune_cache', 'insert') then
    raise exception 'A regular user has an unexpected table privilege';
  end if;
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"admin"}}', true);
do $$
begin
  if (select count(*) from public.qimen_records) <> 3
    or (select count(*) from public.qimen_question_audit) <> 1 then
    raise exception 'An administrator cannot read the expected records';
  end if;
end $$;

reset role;
set local role anon;
insert into public.guest_events (guest_id, event_name, feature)
  values ('guest_test', 'guest_started', 'auth');
do $$
begin
  if has_table_privilege(current_user, 'public.guest_events', 'select')
    or has_table_privilege(current_user, 'public.compatibility_sessions', 'select') then
    raise exception 'Anonymous users can read private data';
  end if;

  begin
    insert into public.guest_events (guest_id, event_name, feature)
      values ('guest_test', 'invalid', 'auth');
    raise exception 'An invalid guest event was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role service_role;
do $$
begin
  if (select count(*) from public.qimen_records) <> 3
    or (select count(*) from public.compatibility_sessions) <> 1 then
    raise exception 'The service role cannot access backend tables';
  end if;
end $$;

rollback;

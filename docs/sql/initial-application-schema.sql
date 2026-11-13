begin;

create table public.qimen_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  category text not null default 'general',
  qimen_data jsonb not null,
  created_at timestamptz not null default now()
);

create index qimen_records_user_created_idx
  on public.qimen_records (user_id, created_at desc);

create table public.bazi_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  gender text not null,
  birth_date timestamp not null,
  adjusted_birth_date timestamp,
  birth_location text,
  birth_latitude double precision,
  birth_longitude double precision,
  solar_time_mode text default 'clock',
  solar_time_adjustment_minutes integer default 0,
  bazi_str text not null,
  bazi_summary text,
  bazi_detail jsonb,
  strong_weak text,
  geju text,
  shensha text,
  favorable_elements jsonb,
  unfavorable_elements jsonb,
  day_zhi text,
  year_zhi text,
  month_zhi text,
  ri_zhu text,
  display_yuanju_core text,
  display_current_dayun text,
  display_current_liunian text,
  llm_yuanju_core text,
  llm_current_dayun text,
  llm_current_liunian text,
  engine_yuanju_core text,
  engine_current_dayun text,
  engine_current_liunian text,
  life_events jsonb default '[]'::jsonb,
  calibrated_yuanju_core text,
  calibrated_current_dayun text,
  calibrated_current_liunian text,
  calibrated_at timestamptz,
  calibrated_version text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index bazi_profiles_user_created_idx
  on public.bazi_profiles (user_id, created_at desc);

create table public.fortune_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension text not null,
  period_key text not null,
  data_json jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, dimension, period_key)
);

create table public.profile_contexts (
  profile_id uuid primary key references public.bazi_profiles(id) on delete cascade,
  career_profile jsonb not null default '{}'::jsonb,
  wealth_profile jsonb not null default '{}'::jsonb,
  love_profile jsonb not null default '{}'::jsonb,
  health_profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.monthly_context_logs (
  profile_id uuid not null references public.bazi_profiles(id) on delete cascade,
  month_key text not null,
  carry_from_previous boolean not null default false,
  overall_note text not null default '',
  career_monthly jsonb not null default '{}'::jsonb,
  wealth_monthly jsonb not null default '{}'::jsonb,
  love_monthly jsonb not null default '{}'::jsonb,
  health_monthly jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, month_key)
);

create table public.bazi_profile_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.bazi_profiles(id) on delete cascade,
  action_type text not null default 'profile_generate'
    check (action_type in ('profile_generate')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bazi_profile_usage_user_created_idx
  on public.bazi_profile_usage (user_id, created_at desc);
create index bazi_profile_usage_profile_created_idx
  on public.bazi_profile_usage (profile_id, created_at desc);

create table public.qimen_feedback (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.qimen_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accuracy_status text not null check (
    accuracy_status in ('fulfilled', 'partially_fulfilled', 'not_fulfilled', 'pending')
  ),
  actual_direction text not null check (
    actual_direction in ('better', 'matched', 'worse', 'pending')
  ),
  note text check (char_length(coalesce(note, '')) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_id, user_id)
);

create index qimen_feedback_user_id_idx on public.qimen_feedback (user_id);
create index qimen_feedback_record_id_idx on public.qimen_feedback (record_id);

create table public.qimen_question_audit (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  record_id uuid references public.qimen_records(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  question text not null,
  rule_route_hint jsonb,
  route_raw jsonb,
  route_normalized jsonb,
  role_audit jsonb,
  qimen_chart_snapshot jsonb,
  timing_target_symbols jsonb,
  timing_input_snapshot jsonb,
  timing_analysis_backend jsonb,
  timing_prompt_section text,
  timing_llm_output jsonb,
  timing_final jsonb,
  yongshen_rule_snapshot jsonb,
  polarity_overrides jsonb,
  backend_score_input jsonb,
  backend_score_audit jsonb,
  backend_score_intermediate jsonb,
  prompt_blocks jsonb,
  llm_input_snapshot jsonb,
  llm_prompt_text text,
  llm_output_raw jsonb,
  llm_output_normalized jsonb,
  postprocess_audit jsonb,
  final_output jsonb,
  fallbacks jsonb,
  model_name text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index qimen_question_audit_user_created_idx
  on public.qimen_question_audit (user_id, created_at desc);
create index qimen_question_audit_request_idx
  on public.qimen_question_audit (request_id);
create index qimen_question_audit_record_idx
  on public.qimen_question_audit (record_id);
create index qimen_question_audit_category_idx
  on public.qimen_question_audit ((route_normalized->>'category'), created_at desc);
create index qimen_question_audit_role_idx
  on public.qimen_question_audit ((route_normalized->>'role'), created_at desc);
create index qimen_question_audit_timing_method_idx
  on public.qimen_question_audit ((timing_analysis_backend->>'method'), created_at desc);
create index qimen_question_audit_timing_event_mode_idx
  on public.qimen_question_audit ((timing_analysis_backend->>'event_mode'), created_at desc);

create table public.bazi_question_audit (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  question text not null,
  rule_route_hint jsonb,
  semantic_route_raw jsonb,
  semantic_route_normalized jsonb,
  time_scope_resolved jsonb,
  analysis_params_snapshot jsonb,
  target_spec jsonb,
  state_report jsonb,
  dynamic_report jsonb,
  timing_candidates jsonb,
  prompt_blocks jsonb,
  llm_prompt_text text,
  llm_output_raw jsonb,
  llm_output_normalized jsonb,
  fallbacks jsonb,
  llm_limitations jsonb,
  model_name text,
  latency_ms integer,
  analysis_mode text generated always as (semantic_route_normalized->>'analysis_mode') stored,
  category text generated always as (semantic_route_normalized->>'category') stored,
  subcategory text generated always as (semantic_route_normalized->>'subcategory') stored,
  llm_level text generated always as (llm_output_normalized->'summary'->>'level') stored,
  llm_confidence text generated always as (llm_output_normalized->'meta'->>'confidence') stored,
  target_fallback_level text generated always as (target_spec->>'fallback_level') stored
);

create index bazi_qa_user_created_idx
  on public.bazi_question_audit (user_id, created_at desc);
create index bazi_qa_request_idx on public.bazi_question_audit (request_id);
create index bazi_qa_mode_created_idx on public.bazi_question_audit (analysis_mode, created_at desc);
create index bazi_qa_category_idx on public.bazi_question_audit (category, subcategory, created_at desc);
create index bazi_qa_level_idx on public.bazi_question_audit (llm_level, created_at desc);
create index bazi_qa_target_fallback_idx
  on public.bazi_question_audit (target_fallback_level, created_at desc);
create index bazi_qa_has_fallback_idx on public.bazi_question_audit (created_at desc)
  where fallbacks is not null and jsonb_array_length(fallbacks) > 0;
create index bazi_qa_has_llm_limitations_idx on public.bazi_question_audit (created_at desc)
  where llm_limitations is not null and jsonb_array_length(llm_limitations) > 0;

create table public.followup_audit (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  record_id uuid references public.qimen_records(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  branch text,
  origin_question text,
  followup text not null,
  classifier_model text,
  classifier_prompt text,
  route_raw jsonb,
  route_normalized jsonb,
  scope text,
  needs_data jsonb,
  extra_evidence jsonb,
  patch_model text,
  patch_prompt text,
  patch_output_raw text,
  supplements jsonb,
  nature text,
  target_sections jsonb,
  evidence_snapshot jsonb,
  origin_sections jsonb,
  fallbacks jsonb,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index followup_audit_user_created_idx on public.followup_audit (user_id, created_at desc);
create index followup_audit_record_idx on public.followup_audit (record_id);
create index followup_audit_scope_idx on public.followup_audit (scope, created_at desc);

create table public.guest_events (
  id bigint generated by default as identity primary key,
  guest_id text not null,
  event_name text not null,
  feature text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index guest_events_created_at_idx on public.guest_events (created_at desc);
create index guest_events_guest_id_idx on public.guest_events (guest_id);
create index guest_events_feature_event_idx on public.guest_events (feature, event_name);

create table public.compatibility_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name_a text,
  gender_a text,
  birth_date_a date,
  birth_location_a text,
  birth_lat_a double precision,
  birth_lng_a double precision,
  hour_index_a integer,
  name_b text,
  gender_b text,
  birth_date_b date,
  birth_location_b text,
  birth_lat_b double precision,
  birth_lng_b double precision,
  hour_index_b integer,
  bazi_compact_a jsonb,
  bazi_compact_b jsonb,
  dim_scores jsonb,
  total_score integer
);

alter table public.qimen_records enable row level security;
alter table public.bazi_profiles enable row level security;
alter table public.fortune_cache enable row level security;
alter table public.profile_contexts enable row level security;
alter table public.monthly_context_logs enable row level security;
alter table public.bazi_profile_usage enable row level security;
alter table public.qimen_feedback enable row level security;
alter table public.qimen_question_audit enable row level security;
alter table public.bazi_question_audit enable row level security;
alter table public.followup_audit enable row level security;
alter table public.guest_events enable row level security;
alter table public.compatibility_sessions enable row level security;

revoke all on public.qimen_records, public.bazi_profiles, public.fortune_cache,
  public.profile_contexts, public.monthly_context_logs, public.bazi_profile_usage,
  public.qimen_feedback, public.qimen_question_audit, public.bazi_question_audit,
  public.followup_audit, public.guest_events, public.compatibility_sessions
  from public, anon, authenticated;

grant all on public.qimen_records, public.bazi_profiles, public.fortune_cache,
  public.profile_contexts, public.monthly_context_logs, public.bazi_profile_usage,
  public.qimen_feedback, public.qimen_question_audit, public.bazi_question_audit,
  public.followup_audit, public.guest_events, public.compatibility_sessions
  to service_role;

grant select on public.qimen_records to authenticated;
grant insert (user_id, question, category, qimen_data) on public.qimen_records to authenticated;
grant update (qimen_data) on public.qimen_records to authenticated;
grant select, insert, update, delete on public.bazi_profiles to authenticated;
grant select on public.fortune_cache to authenticated;
grant select, insert, update, delete on public.qimen_feedback to authenticated;
grant select on public.bazi_profile_usage, public.qimen_question_audit,
  public.bazi_question_audit, public.followup_audit to authenticated;
grant insert on public.guest_events to anon;
grant usage on sequence public.guest_events_id_seq to anon, service_role;

create policy qimen_records_select_own on public.qimen_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy qimen_records_insert_own on public.qimen_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy qimen_records_update_own on public.qimen_records
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy qimen_records_admin_select on public.qimen_records
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy bazi_profiles_own on public.bazi_profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy bazi_profiles_admin_select on public.bazi_profiles
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy fortune_cache_select_own on public.fortune_cache
  for select to authenticated using ((select auth.uid()) = user_id);

create policy qimen_feedback_select_own on public.qimen_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy qimen_feedback_insert_own on public.qimen_feedback
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.qimen_records
      where id = record_id and user_id = (select auth.uid())
    )
  );
create policy qimen_feedback_update_own on public.qimen_feedback
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.qimen_records
      where id = record_id and user_id = (select auth.uid())
    )
  );
create policy qimen_feedback_delete_own on public.qimen_feedback
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy qimen_feedback_admin_select on public.qimen_feedback
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy bazi_profile_usage_admin_select on public.bazi_profile_usage
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy qimen_question_audit_admin_select on public.qimen_question_audit
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy bazi_question_audit_admin_select on public.bazi_question_audit
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy followup_audit_admin_select on public.followup_audit
  for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy guest_events_anon_insert on public.guest_events
  for insert to anon with check (
    guest_id like 'guest_%'
    and event_name in (
      'guest_started', 'guest_qimen_asked', 'guest_bazi_viewed',
      'guest_bazi_profile_added', 'guest_fortune_viewed'
    )
    and feature in ('auth', 'qimen', 'bazi', 'fortune')
  );

notify pgrst, 'reload schema';

commit;

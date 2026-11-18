-- 合盘引擎（lib/synastry，engine synastry/1）落库所需的新增列。
-- 先执行 docs/sql/compatibility-sessions-migration.sql 建表（RLS 开启、不建策略），再执行本脚本。
-- 两个脚本都可以重复执行。线上执行前须经项目负责人确认（spec §8）。

alter table compatibility_sessions
  add column if not exists relation_type  text not null default 'friend',
  add column if not exists engine_version text,
  add column if not exists report         jsonb;

-- relation_type 只允许 friend 与 romance
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'compatibility_sessions_relation_type_check'
  ) then
    alter table compatibility_sessions
      add constraint compatibility_sessions_relation_type_check
      check (relation_type in ('friend', 'romance'));
  end if;
end $$;

comment on column compatibility_sessions.relation_type  is 'friend | romance';
comment on column compatibility_sessions.engine_version is '合盘引擎版本，如 synastry/1';
comment on column compatibility_sessions.report         is '引擎报告：证据、四问、结构类型、朋友合盘五维度（仅 friend）';
comment on column compatibility_sessions.dim_scores     is '朋友合盘五维度 d1–d5，由 Worker 在同一次请求里写入；romance 为空';
comment on column compatibility_sessions.total_score    is '朋友合盘总分；romance 为空（婚恋合盘不给总分）';

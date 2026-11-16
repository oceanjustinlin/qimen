-- compatibility_sessions: stores anonymous bazi compatibility sessions
-- No user_id required — supports unauthenticated users on the wrapped.html flow

create table if not exists compatibility_sessions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- Person A
  name_a           text,
  gender_a         text,
  birth_date_a     date,
  birth_location_a text,
  birth_lat_a      double precision,
  birth_lng_a      double precision,
  hour_index_a     integer,   -- 0-11 (子丑…亥), -1 = unknown

  -- Person B
  name_b           text,
  gender_b         text,
  birth_date_b     date,
  birth_location_b text,
  birth_lat_b      double precision,
  birth_lng_b      double precision,
  hour_index_b     integer,

  -- Computed compact bazi data (JSON)
  bazi_compact_a   jsonb,
  bazi_compact_b   jsonb,

  -- Final scores (optional, stored after frontend computes)
  dim_scores       jsonb,
  total_score      integer
);

-- RLS 开启且不建任何策略：匿名与登录角色都不能直接读写这张表。
-- 读写只经 Worker（/api/compatibility/init），它使用服务端密钥，不受 RLS 限制。
-- 2026-11-16：原先这里有两条匿名策略（insert with check (true)、select using (true)），
-- 其中查询策略会让任何持匿名密钥的人读出全表的姓名、生日和出生地，已删除。
alter table compatibility_sessions enable row level security;

-- 若旧版脚本曾被执行过，清掉遗留策略（幂等）
drop policy if exists "allow anon insert"     on compatibility_sessions;
drop policy if exists "allow anon select own" on compatibility_sessions;

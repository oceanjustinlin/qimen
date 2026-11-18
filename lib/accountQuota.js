const DAILY_QIMEN_LIMIT = 2;
const DAILY_PROFILE_ACTION_LIMIT = 1;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildBeijingNaturalDayRange(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const beijingTime = new Date(current.getTime() + BEIJING_OFFSET_MS);
  const year = beijingTime.getUTCFullYear();
  const month = beijingTime.getUTCMonth();
  const day = beijingTime.getUTCDate();
  const startMs = Date.UTC(year, month, day) - BEIJING_OFFSET_MS;
  const endMs = startMs + DAY_MS;

  return {
    dayKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

function isWhitelistedEmail(email, configuredEmails = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return String(configuredEmails || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

async function countDailyRows({ supabase, table, userId, now = new Date(), actionType = '' }) {
  const range = buildBeijingNaturalDayRange(now);
  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', range.startIso);

  if (actionType) query = query.eq('action_type', actionType);

  const { count, error } = await query.lt('created_at', range.endIso);
  if (error) throw error;
  return count || 0;
}

async function assertDailyQimenQuota({ supabase, userId, now = new Date() }) {
  const count = await countDailyRows({
    supabase,
    table: 'qimen_records',
    userId,
    now,
  });

  if (count >= DAILY_QIMEN_LIMIT) {
    const err = new Error('今日 2 次占卜额度已用尽，请明日再来');
    err.status = 403;
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }
}

async function assertDailyProfileActionQuota({ supabase, userId, now = new Date() }) {
  const count = await countDailyRows({
    supabase,
    table: 'bazi_profile_usage',
    userId,
    now,
    actionType: 'profile_generate',
  });

  if (count >= DAILY_PROFILE_ACTION_LIMIT) {
    const err = new Error('今日最多添加或刷新 1 个档案，请明日再来');
    err.status = 403;
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }
}

async function recordProfileAction({ supabase, userId, profileId, action = 'profile_generate', metadata = {} }) {
  const { error } = await supabase
    .from('bazi_profile_usage')
    .insert({
      user_id: userId,
      profile_id: profileId,
      action_type: action,
      metadata,
    });

  if (error) throw error;
}

module.exports = {
  DAILY_PROFILE_ACTION_LIMIT,
  DAILY_QIMEN_LIMIT,
  assertDailyProfileActionQuota,
  assertDailyQimenQuota,
  buildBeijingNaturalDayRange,
  isWhitelistedEmail,
  recordProfileAction,
};

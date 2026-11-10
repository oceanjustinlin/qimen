'use strict';
// 当地钟表时间 + IANA 时区 → UTC。用 Node 内置 Intl（完整 ICU + tzdata），含各地历史夏令时。

const pad2 = (n) => String(n).padStart(2, '0');

function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// 某 UTC 时刻在该时区的偏移（分钟，东正西负）
function offsetMinutes(tz, utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

const formatOffset = (min) => {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
};

// clock: {year,month,day,hour,minute}；返回 { utc: Date, offset_minutes, warning? }
function localToUtc(clock, tz) {
  const localMs = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);
  // 该时刻前后一天内可能出现的偏移（覆盖夏令时切换）
  const offsets = [...new Set([-1, 0, 1].map((d) => offsetMinutes(tz, localMs + d * 86400000)))];
  const valid = offsets.filter((o) => offsetMinutes(tz, localMs - o * 60000) === o).sort((a, b) => b - a);
  if (valid.length >= 1) {
    // 两个都成立 = 拨回时钟造成的重复时刻：取较早的那个（偏移较大者）
    const o = valid[0];
    const out = { utc: new Date(localMs - o * 60000), offset_minutes: o };
    if (valid.length > 1) out.warning = `当地时间 ${fmtClock(clock)} 在 ${tz} 出现两次（夏令时结束），已取较早的一次（UTC${formatOffset(o)}）`;
    return out;
  }
  // 都不成立 = 拨快时钟跳过的时刻：按切换前的偏移解释
  const before = offsetMinutes(tz, localMs - 86400000);
  return {
    utc: new Date(localMs - before * 60000),
    offset_minutes: before,
    warning: `当地时间 ${fmtClock(clock)} 在 ${tz} 不存在（夏令时开始被跳过），已按切换前的 UTC${formatOffset(before)} 解释`,
  };
}

function fmtClock(c) {
  return `${c.year}-${pad2(c.month)}-${pad2(c.day)} ${pad2(c.hour)}:${pad2(c.minute)}`;
}

module.exports = { isValidTimeZone, localToUtc, formatOffset, fmtClock };

'use strict';

const GENDER_MAP = new Map([
  ['男', 'male'],
  ['m', 'male'],
  ['male', 'male'],
  ['乾造', 'male'],
  ['乾', 'male'],
  ['女', 'female'],
  ['f', 'female'],
  ['female', 'female'],
  ['坤造', 'female'],
  ['坤', 'female'],
]);

const TIME_SLOTS = [
  { start: 0, end: 60, index: 0, label: '早子时' },
  { start: 60, end: 180, index: 1, label: '丑时' },
  { start: 180, end: 300, index: 2, label: '寅时' },
  { start: 300, end: 420, index: 3, label: '卯时' },
  { start: 420, end: 540, index: 4, label: '辰时' },
  { start: 540, end: 660, index: 5, label: '巳时' },
  { start: 660, end: 780, index: 6, label: '午时' },
  { start: 780, end: 900, index: 7, label: '未时' },
  { start: 900, end: 1020, index: 8, label: '申时' },
  { start: 1020, end: 1140, index: 9, label: '酉时' },
  { start: 1140, end: 1260, index: 10, label: '戌时' },
  { start: 1260, end: 1380, index: 11, label: '亥时' },
  { start: 1380, end: 1440, index: 12, label: '晚子时' },
];

function makeZiweiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeProfileGender(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const gender = GENDER_MAP.get(normalized);
  if (!gender) throw makeZiweiError('PROFILE_GENDER_INVALID', '紫微排盘需要可识别的性别（男或女）。');
  return gender;
}

function parseLocalDateTime(value) {
  const text = String(value ?? '').trim();
  if (!text) throw makeZiweiError('PROFILE_INCOMPLETE', '缺少出生日期时间。');

  const dateOnly = /^\d{4}-\d{1,2}-\d{1,2}$/.test(text);
  if (dateOnly) throw makeZiweiError('PROFILE_BIRTH_TIME_MISSING', '紫微排盘需要精确的出生时间。');

  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw makeZiweiError('PROFILE_BIRTH_TIME_INVALID', '出生日期时间格式必须为 YYYY-MM-DD HH:mm[:ss]。');

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const valid = check.getUTCFullYear() === year
    && check.getUTCMonth() === month - 1
    && check.getUTCDate() === day
    && check.getUTCHours() === hour
    && check.getUTCMinutes() === minute
    && check.getUTCSeconds() === second;
  if (!valid) throw makeZiweiError('PROFILE_BIRTH_TIME_INVALID', '出生日期时间不合法。');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    date_str: `${year}-${month}-${day}`,
    datetime: `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  };
}

function timeSlotFor(hour, minute) {
  const minuteOfDay = hour * 60 + minute;
  return TIME_SLOTS.find((slot) => minuteOfDay >= slot.start && minuteOfDay < slot.end);
}

function buildZiweiInput(profile) {
  if (!profile || typeof profile !== 'object') {
    throw makeZiweiError('PROFILE_INCOMPLETE', '缺少紫微档案快照。');
  }

  const gender = normalizeProfileGender(profile.gender);
  const hasAdjusted = profile.adjusted_birth_date !== null
    && profile.adjusted_birth_date !== undefined
    && String(profile.adjusted_birth_date).trim() !== '';
  const rawDateTime = hasAdjusted ? profile.adjusted_birth_date : profile.birth_date;
  const parsed = parseLocalDateTime(rawDateTime);
  const slot = timeSlotFor(parsed.hour, parsed.minute);
  if (!slot) throw makeZiweiError('PROFILE_BIRTH_TIME_INVALID', '出生时间不在有效时段内。');

  return {
    birth: {
      date_str: parsed.date_str,
      solar_datetime: parsed.datetime,
      time_index: slot.index,
      time_label: slot.label,
      gender,
    },
    source: {
      time_source: hasAdjusted ? 'profile_adjusted' : 'profile_legacy_clock',
      time_correction_minutes: Number.isFinite(Number(profile.solar_time_adjustment_minutes))
        ? Number(profile.solar_time_adjustment_minutes)
        : 0,
      solar_time_mode: String(profile.solar_time_mode || 'clock'),
    },
    warnings: hasAdjusted ? [] : ['ZIWEI_USING_UNADJUSTED_PROFILE_TIME'],
  };
}

module.exports = {
  buildZiweiInput,
  makeZiweiError,
  normalizeProfileGender,
  parseLocalDateTime,
  timeSlotFor,
};

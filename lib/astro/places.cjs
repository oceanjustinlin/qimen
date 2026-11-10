'use strict';
// 地名 → 经纬度 + IANA 时区。地名库 src/data/birthplaces.mjs 只有坐标、没有时区，这里按地区补。

const { lookupPlace } = require('../birthInput.cjs');

// 地名库里的海外种子记录（国家|省州）
const OVERSEAS_TZ = {
  '美国|纽约州': 'America/New_York',
  '美国|加利福尼亚州': 'America/Los_Angeles',
  '英国|英格兰': 'Europe/London',
  '法国|法兰西岛': 'Europe/Paris',
  '日本|东京都': 'Asia/Tokyo',
  '新加坡|新加坡': 'Asia/Singapore',
};

function timezoneOf(record) {
  if (record.country === '中国') {
    const label = record.label || '';
    if (/香港/.test(label)) return 'Asia/Hong_Kong';
    if (/澳门|澳門/.test(label)) return 'Asia/Macau';
    if (record.admin1 === '港澳台') return 'Asia/Taipei';
    // 全国（含新疆、西藏）法定时间都是北京时间；tzdata 的 Asia/Shanghai 含 1986–1991 年夏令时
    return 'Asia/Shanghai';
  }
  return OVERSEAS_TZ[`${record.country}|${record.admin1}`] || null;
}

// 返回 { label, latitude, longitude, timezone }；时区未知时 timezone 为 null
function placeForAstro(place) {
  const rec = lookupPlace(place);
  return { label: rec.label, latitude: rec.lat, longitude: rec.lng, timezone: timezoneOf(rec) };
}

module.exports = { placeForAstro, timezoneOf };

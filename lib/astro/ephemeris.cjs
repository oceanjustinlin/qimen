'use strict';
// 星历封装：只依赖 astronomy-engine（MIT，纯 JS）。
// 输出地心、真春分点的黄道坐标（ecliptic of date），与主流占星软件口径一致。

const Astronomy = require('astronomy-engine');
const { PLANETS, NODE } = require('./constants.cjs');

const norm360 = (x) => ((x % 360) + 360) % 360;
const rad = (d) => (d * Math.PI) / 180;
// 两个黄经的带符号差 b - a，落在 (-180, 180]
const signedDelta = (a, b) => {
  const d = norm360(b - a);
  return d > 180 ? d - 360 : d;
};

// 速度用 ±半天中心差分（度/日）
const SPEED_STEP_DAYS = 0.5;

function eclipticOf(body, time) {
  if (body === 'Moon') {
    const m = Astronomy.EclipticGeoMoon(time);
    return { lon: norm360(m.lon), lat: m.lat };
  }
  const ecl = Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true));
  return { lon: norm360(ecl.elon), lat: ecl.elat };
}

// 月亮平均升交点（Meeus《天文算法》47.7），T 为自 J2000 起的儒略世纪数（TT）
function meanNode(time) {
  const T = time.tt / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T ** 3) / 467441 - (T ** 4) / 60616000);
}

// 真实（密切）升交点：由月亮地心位置与速度矢量求轨道面，取其与黄道的升交点，口径同 Swiss Ephemeris 的 true node
function moonVector(time) {
  const m = Astronomy.EclipticGeoMoon(time);
  const lo = rad(m.lon);
  const la = rad(m.lat);
  return [m.dist * Math.cos(la) * Math.cos(lo), m.dist * Math.cos(la) * Math.sin(lo), m.dist * Math.sin(la)];
}

function trueNode(time) {
  const step = 1 / 1440; // 1 分钟
  const r = moonVector(time);
  const a = moonVector(time.AddDays(-step));
  const b = moonVector(time.AddDays(step));
  const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const hx = r[1] * v[2] - r[2] * v[1];
  const hy = r[2] * v[0] - r[0] * v[2];
  return norm360((Math.atan2(hx, -hy) * 180) / Math.PI);
}

function nodeLongitude(time, kind) {
  return kind === 'true' ? trueNode(time) : meanNode(time);
}

// date: UTC Date；返回各星体黄经、黄纬、日速度
function bodyPositions(date, { node = 'mean' } = {}) {
  const t = Astronomy.MakeTime(date);
  const before = t.AddDays(-SPEED_STEP_DAYS);
  const after = t.AddDays(SPEED_STEP_DAYS);
  const out = PLANETS.map((p) => {
    const now = eclipticOf(p.body, t);
    const speed = signedDelta(eclipticOf(p.body, before).lon, eclipticOf(p.body, after).lon) / (2 * SPEED_STEP_DAYS);
    return { key: p.key, name: p.name, longitude: now.lon, latitude: now.lat, speed };
  });
  const nodeSpeed = signedDelta(nodeLongitude(before, node), nodeLongitude(after, node)) / (2 * SPEED_STEP_DAYS);
  out.push({ key: NODE.key, name: NODE.name, longitude: nodeLongitude(t, node), latitude: 0, speed: nodeSpeed });
  return out;
}

// 地方恒星时（RAMC，度）与真黄赤交角（度）
function siderealFrame(date, longitude) {
  const t = Astronomy.MakeTime(date);
  const gast = Astronomy.SiderealTime(t); // 小时，含章动
  return {
    ramc: norm360(gast * 15 + longitude),
    obliquity: Astronomy.e_tilt(t).tobl,
    julian_day: t.ut + 2451545.0,
  };
}

module.exports = { bodyPositions, siderealFrame, norm360, signedDelta };

'use strict';
// 四轴与宫位。Placidus 用半弧三分法迭代；高纬度无解时由调用方降级。

const { norm360 } = require('./ephemeris.cjs');

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// 赤经 ra 所在的黄道点的黄经
const raToLongitude = (ra, eps) => norm360(deg(Math.atan2(Math.sin(rad(ra)), Math.cos(rad(ra)) * Math.cos(rad(eps)))));
const declinationOf = (lon, eps) => deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lon))));

function angles(ramc, eps, latitude) {
  const mc = raToLongitude(ramc, eps);
  const r = rad(ramc);
  const e = rad(eps);
  let asc = norm360(deg(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(rad(latitude)) * Math.sin(e)))));
  // 上升必须在天顶以东（黄经差 0–180）；极区附近 atan2 可能给出对面的点
  if (norm360(asc - mc) > 180) asc = norm360(asc + 180);
  return { asc, mc, dsc: norm360(asc + 180), ic: norm360(mc + 180) };
}

class PlacidusUnsolvable extends Error {}

// 赤经 = RAMC + offset + k·(昼半弧)；k、offset 取值见 placidusCusps
function placidusCusp(ramc, eps, latitude, offset, k) {
  const tanPhi = Math.tan(rad(latitude));
  let ra = norm360(ramc + offset + k * 90);
  for (let i = 0; i < 60; i += 1) {
    const dec = declinationOf(raToLongitude(ra, eps), eps);
    const x = -tanPhi * Math.tan(rad(dec));
    if (x < -1 || x > 1) throw new PlacidusUnsolvable('Placidus 在该纬度无解');
    const dsa = deg(Math.acos(x)); // 昼半弧
    const next = norm360(ramc + offset + k * dsa);
    if (Math.abs(((next - ra + 540) % 360) - 180) < 1e-9) { ra = next; break; }
    ra = next;
  }
  return raToLongitude(ra, eps);
}

function placidusCusps(ramc, eps, latitude, ax) {
  // 11、12 宫：MC 起昼半弧的 1/3、2/3；2、3 宫：上升起夜半弧的 1/3、2/3
  // 夜半弧 = 180 − 昼半弧，故 2 宫 RA = RAMC + 60 + (2/3)·DSA，3 宫 RA = RAMC + 120 + (1/3)·DSA
  const c11 = placidusCusp(ramc, eps, latitude, 0, 1 / 3);
  const c12 = placidusCusp(ramc, eps, latitude, 0, 2 / 3);
  const c2 = placidusCusp(ramc, eps, latitude, 60, 2 / 3);
  const c3 = placidusCusp(ramc, eps, latitude, 120, 1 / 3);
  const half = [ax.asc, c2, c3, ax.ic, null, null, ax.dsc, null, null, ax.mc, c11, c12];
  half[4] = norm360(c11 + 180);
  half[5] = norm360(c12 + 180);
  half[7] = norm360(c2 + 180);
  half[8] = norm360(c3 + 180);
  return half;
}

const wholeSignCusps = (asc) => Array.from({ length: 12 }, (_, i) => norm360(Math.floor(asc / 30) * 30 + i * 30));
const equalCusps = (asc) => Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30));

// 返回 { system, cusps[12], fallback_reason }
function computeHouses(system, ramc, eps, latitude, ax) {
  if (system === 'whole_sign') return { system, cusps: wholeSignCusps(ax.asc) };
  if (system === 'equal') return { system, cusps: equalCusps(ax.asc) };
  try {
    const cusps = placidusCusps(ramc, eps, latitude, ax);
    if (cusps.some((c) => !Number.isFinite(c))) throw new PlacidusUnsolvable('Placidus 结果无效');
    return { system: 'placidus', cusps };
  } catch (err) {
    if (!(err instanceof PlacidusUnsolvable)) throw err;
    return { system: 'whole_sign', cusps: wholeSignCusps(ax.asc), fallback_reason: `纬度 ${latitude}° 过高，Placidus 宫位无解，已改用整宫制` };
  }
}

// 黄经所在宫位（1–12）：从各宫头逆时针量到下一宫头
function houseOf(longitude, cusps) {
  for (let i = 0; i < 12; i += 1) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const span = norm360(end - start);
    if (norm360(longitude - start) < span) return i + 1;
  }
  return 12;
}

module.exports = { angles, computeHouses, houseOf };

'use strict';
// 西洋本命盘组装：只产出可复算的天文事实（落座、落宫、四轴、相位、分布），不含断语。

const { SIGNS, PLANETS, ANGLE_NAMES, ASPECTS, ORB_PRESETS, DIGNITIES, DIGNITY_NAMES } = require('./constants.cjs');
const { bodyPositions, siderealFrame, norm360, signedDelta } = require('./ephemeris.cjs');
const { angles: computeAngles, computeHouses, houseOf } = require('./houses.cjs');

const round = (x, n = 2) => Number(x.toFixed(n));
const pad2 = (n) => String(n).padStart(2, '0');

// 星座内度数：26°07′（向下取整到分，避免 29°60′）
function dms(lonInSign) {
  const totalMin = Math.floor(lonInSign * 60 + 1e-9);
  return `${Math.floor(totalMin / 60)}°${pad2(totalMin % 60)}′`;
}

function zodiacPoint(longitude) {
  const lon = norm360(longitude);
  const sign = SIGNS[Math.floor(lon / 30)];
  return { longitude: round(lon), sign: sign.name, sign_key: sign.key, degree: dms(lon - Math.floor(lon / 30) * 30) };
}

function dignityOf(key, signKey) {
  const table = DIGNITIES[key];
  if (!table) return null;
  // 水星在处女座同时入庙、擢升：按表顺序取第一个（入庙）
  for (const kind of ['domicile', 'exaltation', 'detriment', 'fall']) {
    if (table[kind].includes(signKey)) return DIGNITY_NAMES[kind];
  }
  return null;
}

// 相位：只算星体之间（含北交点），容许度取两者中适用的该相位容许度
function findAspects(bodies, orbs) {
  const out = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      const sep = Math.abs(signedDelta(a.longitude, b.longitude));
      for (const asp of ASPECTS) {
        const orb = Math.abs(sep - asp.angle);
        if (orb > orbs[asp.type]) continue;
        // 入相/出相：一小时后相位误差变小即为入相
        const dt = 1 / 24;
        const sepLater = Math.abs(signedDelta(a.longitude + a.speed * dt, b.longitude + b.speed * dt));
        out.push({
          a: a.key,
          b: b.key,
          type: asp.type,
          name: `${a.name}${asp.name}${b.name}`,
          angle: asp.angle,
          orb: round(orb),
          applying: Math.abs(sepLater - asp.angle) < orb,
        });
        break;
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

function countBy(planets, field) {
  const keys = field === 'element' ? ['fire', 'earth', 'air', 'water'] : ['cardinal', 'fixed', 'mutable'];
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const p of planets) out[SIGNS.find((s) => s.key === p.sign_key)[field]] += 1;
  return out;
}

// 主体：utc（Date）、latitude、longitude、options { house_system, node, orbs }
function buildNatalChart({ utc, latitude, longitude, options }) {
  const warnings = [];
  const raw = bodyPositions(utc, { node: options.node });
  const frame = siderealFrame(utc, longitude);
  const ax = computeAngles(frame.ramc, frame.obliquity, latitude);
  const houses = computeHouses(options.house_system, frame.ramc, frame.obliquity, latitude, ax);
  if (houses.fallback_reason) warnings.push(houses.fallback_reason);

  const bodies = raw.map((b) => {
    const z = zodiacPoint(b.longitude);
    return {
      key: b.key,
      name: b.name,
      ...z,
      latitude: round(b.latitude),
      speed: round(b.speed, 4),
      // 日月不逆行；交点的逆行是常态，不标
      retrograde: !['sun', 'moon', 'north_node'].includes(b.key) && b.speed < 0,
      house: houseOf(b.longitude, houses.cusps),
      dignity: dignityOf(b.key, z.sign_key),
    };
  });

  const angles = Object.fromEntries(Object.entries(ax).map(([k, v]) => [k, { key: k, name: ANGLE_NAMES[k], ...zodiacPoint(v) }]));
  const houseList = houses.cusps.map((c, i) => ({ house: i + 1, cusp: zodiacPoint(c) }))
    .map(({ house, cusp }) => ({ house, cusp_longitude: cusp.longitude, sign: cusp.sign, sign_key: cusp.sign_key, degree: cusp.degree }));

  const aspects = findAspects(raw, ORB_PRESETS[options.orbs]);

  const planets = bodies.filter((b) => PLANETS.some((p) => p.key === b.key));
  // 用地平/子午线几何判断，不依赖宫制（整宫制下宫位与地平线不对齐）
  const isUpper = (lon) => norm360(lon - ax.asc) >= 180;
  const isEast = (lon) => norm360(lon - ax.mc) < 180;
  const upper = planets.filter((p) => isUpper(p.longitude)).length;
  const east = planets.filter((p) => isEast(p.longitude)).length;
  const distribution = {
    elements: countBy(planets, 'element'),
    modalities: countBy(planets, 'modality'),
    hemispheres: { upper, lower: planets.length - upper, east, west: planets.length - east },
  };

  const sun = bodies.find((b) => b.key === 'sun');
  const ascSign = SIGNS.find((s) => s.key === angles.asc.sign_key);
  const stelliums = [];
  const groups = (field, label) => {
    const m = new Map();
    for (const p of planets) m.set(p[field], [...(m.get(p[field]) || []), p.key]);
    for (const [k, list] of m) if (list.length >= 3) stelliums.push({ by: label, [label]: k, bodies: list });
  };
  groups('sign_key', 'sign');
  groups('house', 'house');
  const dayChart = isUpper(sun.longitude);
  const derived = {
    sect: dayChart ? 'day' : 'night',
    sect_name: dayChart ? '日生盘' : '夜生盘',
    chart_ruler: ascSign.ruler,
    chart_ruler_name: PLANETS.find((p) => p.key === ascSign.ruler).name,
    stelliums,
  };

  return {
    chart: {
      house_system: houses.system,
      bodies,
      angles,
      houses: houseList,
      aspects,
      distribution,
      derived,
    },
    frame: { julian_day: frame.julian_day, ramc: frame.ramc, obliquity: frame.obliquity },
    warnings,
  };
}

module.exports = { buildNatalChart, zodiacPoint };

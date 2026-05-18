<template>
  <div class="bazi-table-wrap">
    <table class="bazi-table">
      <thead>
        <tr>
          <th class="bz-label">柱位</th>
          <th v-for="col in columns" :key="col.name" class="bz-label">
            {{ col.name }}{{ showPillarSuffix ? '柱' : '' }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bz-label">主星</td>
          <td v-for="col in columns" :key="'star-' + col.name" class="bz-star">{{ col.star || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">天干</td>
          <td v-for="col in columns" :key="'gan-' + col.name" class="bz-char" :class="WX_MAP[col.gan] || 'wx-none'">{{ col.gan || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">地支</td>
          <td v-for="col in columns" :key="'zhi-' + col.name" class="bz-char" :class="WX_MAP[col.zhi] || 'wx-none'">{{ col.zhi || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">藏干</td>
          <td v-for="col in columns" :key="'cg-' + col.name" class="bz-sub">
            <template v-for="stem in normalizeHiddenStems(col.hidden_stems)" :key="stem.gan">
              <span :class="WX_MAP[stem.gan] || 'wx-none'">{{ hiddenStemLabel(stem) }}</span><br>
            </template>
            <span v-if="!normalizeHiddenStems(col.hidden_stems).length" style="color:#555">-</span>
          </td>
        </tr>
        <tr>
          <td class="bz-label">星运</td>
          <td v-for="col in columns" :key="'shi-' + col.name" class="bz-sub">{{ col.shi || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">自座</td>
          <td v-for="col in columns" :key="'zizuo-' + col.name" class="bz-sub">{{ col.zizuo || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">空亡</td>
          <td v-for="col in columns" :key="'kong-' + col.name" class="bz-sub">
            <span v-if="col.is_kong" style="color:var(--crimson)">空亡</span>
            <span v-else style="color:#555">-</span>
          </td>
        </tr>
        <tr>
          <td class="bz-label">纳音</td>
          <td v-for="col in columns" :key="'nayin-' + col.name" class="bz-sub">{{ col.nayin || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">神煞<br><span style="font-size:8px;color:#666">(点击查看)</span></td>
          <td v-for="col in columns" :key="'shen-' + col.name" class="bz-shensha">
            <div
              v-for="s in sortedShensha(col.shensha)"
              :key="s"
              class="clickable-shensha"
              :class="'ss-' + getShenshaInfo(s).nature"
              @click="$emit('shensha-click', s)"
            >{{ s }}</div>
            <span v-if="!sortedShensha(col.shensha).length" style="color:#555">-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { getShenshaInfo, sortedShensha } from '../utils/baziShensha.mjs'

const GAN_WUXING = { 甲: '甲木', 乙: '乙木', 丙: '丙火', 丁: '丁火', 戊: '戊土', 己: '己土', 庚: '庚金', 辛: '辛金', 壬: '壬水', 癸: '癸水' }

const WX_MAP = {
  甲: 'wx-mu', 乙: 'wx-mu', 寅: 'wx-mu', 卯: 'wx-mu',
  丙: 'wx-huo', 丁: 'wx-huo', 巳: 'wx-huo', 午: 'wx-huo',
  戊: 'wx-tu', 己: 'wx-tu', 辰: 'wx-tu', 戌: 'wx-tu', 丑: 'wx-tu', 未: 'wx-tu',
  庚: 'wx-jin', 辛: 'wx-jin', 申: 'wx-jin', 酉: 'wx-jin',
  壬: 'wx-shui', 癸: 'wx-shui', 亥: 'wx-shui', 子: 'wx-shui'
}

defineProps({
  columns: { type: Array, default: () => [] },
  showPillarSuffix: { type: Boolean, default: false }
})

defineEmits(['shensha-click'])

function normalizeHiddenStems(stems) {
  if (!Array.isArray(stems)) return []
  return stems.map(item => typeof item === 'string' ? { gan: item } : item).filter(item => item?.gan)
}

function hiddenStemLabel(stem) {
  return stem.shi_shen ? `${stem.gan}${stem.shi_shen}` : (GAN_WUXING[stem.gan] || stem.gan)
}
</script>

<style scoped>
.bazi-table-wrap { width: 100%; overflow: hidden; }
.bazi-table {
  --bz-cell-py: 8px;
  --bz-label-size: 10px;
  --bz-meta-size: 10px;
  --bz-char-size: 16px;
  table-layout: fixed;
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
.bazi-table th, .bazi-table td {
  padding: var(--bz-cell-py) 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  vertical-align: middle;
  word-wrap: break-word;
}
.bazi-table th { color: var(--gold-light); font-family: var(--font-serif); font-size: 12px; font-weight: normal; letter-spacing: 1px; }
.bazi-table th:first-child, .bazi-table td:first-child { width: 44px; }
.bz-label { color: var(--text-muted); font-weight: 500; font-size: var(--bz-label-size); }
.bz-star { font-size: var(--bz-meta-size); color: var(--text-primary); }
.bz-char { font-size: var(--bz-char-size); font-weight: 600; font-family: var(--font-ganzhi); margin: 2px 0; }
.bz-sub { font-size: var(--bz-meta-size); color: #aaa; line-height: 1.4; }
.bz-shensha { font-size: 9px; color: #B39DDB; line-height: 1.4; }
.clickable-shensha { display: block; cursor: pointer; padding: 1px 4px; border-radius: 4px; transition: background 0.2s; margin: 1px 0; white-space: nowrap; }
.clickable-shensha:hover { background: rgba(212,175,55,0.2); color: var(--gold-light) !important; }
.ss-吉 { color: #68D391; }
.ss-中性 { color: #B39DDB; }
.ss-凶 { color: #FC8181; }
.wx-jin { color: #E8CC80; }
.wx-mu { color: #81C784; }
.wx-shui { color: #64B5F6; }
.wx-huo { color: #E57373; }
.wx-tu { color: #DCE775; }
.wx-none { color: #666; }
@media (max-width: 640px) {
  .bazi-table { --bz-char-size: 14px; }
}
</style>

<template>
  <div class="bazi-table-wrap">
    <table class="bazi-table">
      <thead>
        <tr>
          <th class="bz-label">柱位</th>
          <th v-for="col in columns" :key="col.name" class="bz-label">
            {{ col.name }}{{ ['年','月','日','时'].includes(col.name) ? '柱' : '' }}
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
              <span class="cg-line"><span class="cg-gan" :class="WX_MAP[stem.gan] || 'wx-none'">{{ stem.gan }}{{ WX_NAME[WX_MAP[stem.gan]] || '' }}</span><span class="cg-shen">{{ stem.shi_shen }}</span></span>
            </template>
            <span v-if="!normalizeHiddenStems(col.hidden_stems).length" style="color:var(--ink-dim)">-</span>
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
            <span v-if="col.kong && col.kong !== '-'">{{ col.kong }}</span>
            <span v-else-if="col.is_kong" style="color:var(--crimson)">空亡</span>
            <span v-else style="color:var(--ink-dim)">-</span>
          </td>
        </tr>
        <tr>
          <td class="bz-label">纳音</td>
          <td v-for="col in columns" :key="'nayin-' + col.name" class="bz-sub">{{ col.nayin || '-' }}</td>
        </tr>
        <tr>
          <td class="bz-label">
            神煞
            <button class="ss-toggle" @click="shenshaCollapsed = !shenshaCollapsed" :title="shenshaCollapsed ? '展开' : '折叠'">
              <svg :class="['ss-arrow', { expanded: !shenshaCollapsed }]" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <span class="shensha-hint">(点击)</span>
          </td>
          <td v-for="col in columns" :key="'shen-' + col.name" class="bz-shensha">
            <template v-if="sortedShensha(col.shensha).length">
              <div
                v-for="s in (shenshaCollapsed ? sortedShensha(col.shensha).slice(0, 1) : sortedShensha(col.shensha))"
                :key="s"
                class="clickable-shensha"
                :class="'ss-' + getShenshaInfo(s).nature"
                @click="$emit('shensha-click', s)"
              >{{ s }}</div>
              <span v-if="shenshaCollapsed && sortedShensha(col.shensha).length > 1" class="ss-more">+{{ sortedShensha(col.shensha).length - 1 }}</span>
            </template>
            <span v-else style="color:var(--ink-dim)">-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getShenshaInfo, sortedShensha } from '../utils/baziShensha.mjs'

const shenshaCollapsed = ref(true)

const WX_MAP = {
  甲: 'wx-mu', 乙: 'wx-mu', 寅: 'wx-mu', 卯: 'wx-mu',
  丙: 'wx-huo', 丁: 'wx-huo', 巳: 'wx-huo', 午: 'wx-huo',
  戊: 'wx-tu', 己: 'wx-tu', 辰: 'wx-tu', 戌: 'wx-tu', 丑: 'wx-tu', 未: 'wx-tu',
  庚: 'wx-jin', 辛: 'wx-jin', 申: 'wx-jin', 酉: 'wx-jin',
  壬: 'wx-shui', 癸: 'wx-shui', 亥: 'wx-shui', 子: 'wx-shui'
}
// 藏干按传统排盘写法带五行：庚金 / 壬水 / 戊土
const WX_NAME = { 'wx-mu': '木', 'wx-huo': '火', 'wx-tu': '土', 'wx-jin': '金', 'wx-shui': '水' }

defineProps({
  columns: { type: Array, default: () => [] },
  showPillarSuffix: { type: Boolean, default: false }
})

defineEmits(['shensha-click'])

function normalizeHiddenStems(stems) {
  if (!Array.isArray(stems)) return []
  return stems.map(item => typeof item === 'string' ? { gan: item, shi_shen: '' } : item).filter(item => item?.gan)
}
</script>

<style scoped>
.bazi-table-wrap { width: 100%; overflow: hidden; }
.bazi-table {
  --bz-cell-py: 8px;
  --bz-label-size: 12px;
  --bz-meta-size: 12px;
  --bz-char-size: 20px;
  table-layout: fixed;
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
.bazi-table th, .bazi-table td {
  padding: var(--bz-cell-py) 0;
  border-bottom: 1px solid var(--line, rgba(0,0,0,0.08));
  vertical-align: middle;
  word-wrap: break-word;
}
.bazi-table th { color: var(--gold); font-family: var(--font-serif); font-size: 13px; font-weight: normal; letter-spacing: 1px; }
.bazi-table th:first-child, .bazi-table td:first-child { width: 48px; }
/* higher specificity to beat .bazi-table th on <th class="bz-label"> */
.bazi-table th.bz-label { color: var(--ink-muted, #55595d); font-size: var(--bz-label-size); letter-spacing: 0; }
.bz-label { color: var(--ink-muted, #55595d); font-weight: 500; font-size: var(--bz-label-size); }
.bz-star { font-size: var(--bz-meta-size); color: var(--ink, #0b0b0b); }
.bz-char { font-size: var(--bz-char-size); font-weight: 600; font-family: var(--font-ganzhi); margin: 2px 0; }
.bz-sub { font-size: var(--bz-meta-size); color: var(--ink-muted, #55595d); line-height: 1.45; }
.bz-shensha { font-size: 11px; color: #7c5cbf; line-height: 1.45; }
.shensha-hint { font-size: 9px; color: var(--ink-dim, #777b80); }
.clickable-shensha { display: block; cursor: pointer; padding: 1px 4px; border-radius: 4px; transition: background 0.2s; margin: 1px 0; white-space: nowrap; }
.clickable-shensha:hover { background: rgba(181,141,59,0.12); color: var(--gold) !important; }
.ss-吉 { color: #2e7d49; }
.ss-中性 { color: #7c5cbf; }
.ss-凶 { color: #c0392b; }
.cg-line { display: block; line-height: 1.55; white-space: nowrap; }
.cg-gan { font-weight: 600; }
.cg-shen { color: var(--ink-muted, #55595d); font-size: 11px; margin-left: 2px; }
.ss-toggle { display: inline-flex; align-items: center; justify-content: center; background: none; border: none; padding: 2px; margin: 2px 0 1px; cursor: pointer; color: var(--ink-muted, #55595d); vertical-align: middle; border-radius: 4px; transition: background .15s; }
.ss-toggle:hover { background: rgba(0,0,0,.06); color: var(--ink, #0b0b0b); }
.ss-arrow { width: 10px; height: 6px; display: block; transition: transform .22s cubic-bezier(.4,0,.2,1); transform: rotate(-90deg); }
.ss-arrow.expanded { transform: rotate(0deg); }
.ss-more { display: block; font-size: 10px; color: var(--ink-muted, #55595d); line-height: 1.4; }
@media (max-width: 640px) {
  .bazi-table {
    --bz-label-size: 11px;
    --bz-meta-size: 11px;
    --bz-char-size: 18px;
  }
  .bazi-table th { font-size: 12px; letter-spacing: .5px; }
  .bazi-table th:first-child, .bazi-table td:first-child { width: 44px; }
  .bz-sub { line-height: 1.35; }
  .bz-shensha { font-size: 10px; line-height: 1.35; }
  .cg-shen { font-size: 10px; }
}
</style>

import { computed } from 'vue'
import { buildLocalBaziMatrix, buildTransitColumn } from '../utils/baziLocalMatrix.mjs'
import { getShenShaArray } from '../utils/baziShensha.mjs'

/**
 * 共享的八字列数据逻辑。
 * profileRef: Ref<profile>
 * currentTabRef: Ref<string> | null — 传入时 'basic' tab 只显示四柱，其他 tab 加流年/大运列
 * selectionRef: Ref<{ liunianYear: number|null, dayun: object|null }> | null — 时间轴选中状态，覆盖左两柱
 */
export function useBaziColumns(profileRef, currentTabRef = null, selectionRef = null) {
  const resolvedMatrix = computed(() => {
    const profile = profileRef.value
    const base = profile?.bazi_detail?.matrix || buildLocalBaziMatrix(profile) || null
    if (!base) return null

    const pillarsArr = Array.isArray(base.pillars) ? base.pillars : Object.values(base.pillars || {})
    if (!pillarsArr.length) return base

    const isMale = profile?.gender === 'M'
    const yearGan = pillarsArr[0]?.gan
    const yearZhi = pillarsArr[0]?.zhi
    const monthZhi = pillarsArr[1]?.zhi
    const dayGan = pillarsArr[2]?.gan
    const dayZhi = pillarsArr[2]?.zhi
    const allGans = pillarsArr.map(p => p.gan)

    const patchShensha = (p) => {
      if (!p?.zhi) return p
      return {
        ...p,
        shensha: getShenShaArray(p.zhi, dayGan, yearZhi, dayZhi, {
          monthZhi, pillarGan: p.gan, yearGan, isMale, allGans
        })
      }
    }

    return {
      ...base,
      pillars: pillarsArr.map(patchShensha),
      current_dayun: patchShensha(base.current_dayun),
      current_liunian: patchShensha(base.current_liunian)
    }
  })

  const displayColumns = computed(() => {
    const matrix = resolvedMatrix.value
    if (!matrix) return []
    const tab = currentTabRef?.value
    if (tab === 'basic') return matrix.pillars || []

    const pillars = matrix.pillars || []
    const dayGan = pillars[2]?.gan || ''
    const profile = profileRef.value
    const isMale = profile?.gender === 'M'

    const patchCol = (col) => {
      if (!col?.zhi) return col
      return {
        ...col,
        shensha: getShenShaArray(col.zhi, dayGan, pillars[0]?.zhi, pillars[2]?.zhi, {
          monthZhi: pillars[1]?.zhi,
          pillarGan: col.gan,
          yearGan: pillars[0]?.gan,
          isMale,
          allGans: pillars.map(p => p.gan)
        })
      }
    }

    const sel = selectionRef?.value
    let activeDayun = matrix.current_dayun
    let activeLiunian = matrix.current_liunian

    if (sel?.dayun?.gan && sel?.dayun?.zhi) {
      const raw = buildTransitColumn('大运', sel.dayun.gan + sel.dayun.zhi, dayGan)
      if (raw) activeDayun = patchCol(raw)
    }

    if (Number.isFinite(sel?.liunianYear)) {
      // 先查顶层 liunian_list，再查各大运的 liunian_list
      let ln = (matrix.liunian_list || []).find(l => Number(l.year) === sel.liunianYear)
      if (!ln) {
        for (const d of (matrix.dayun_list || [])) {
          ln = (d.liunian_list || []).find(l => Number(l.year) === sel.liunianYear)
          if (ln) break
        }
      }
      if (ln?.gan && ln?.zhi) {
        const raw = buildTransitColumn('流年', ln.gan + ln.zhi, dayGan)
        if (raw) activeLiunian = patchCol(raw)
      }
    }

    const cols = []
    if (activeLiunian) cols.push(activeLiunian)
    if (activeDayun) cols.push(activeDayun)
    cols.push(...pillars)
    return cols
  })

  return { resolvedMatrix, displayColumns }
}

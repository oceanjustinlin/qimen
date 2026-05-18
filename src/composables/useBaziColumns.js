import { computed } from 'vue'
import { buildLocalBaziMatrix } from '../utils/baziLocalMatrix.mjs'
import { getShenShaArray } from '../utils/baziShensha.mjs'

/**
 * 共享的八字列数据逻辑。
 * profileRef: Ref<profile>
 * currentTabRef: Ref<string> | null — 传入时 'basic' tab 只显示四柱，其他 tab 加流年/大运列
 */
export function useBaziColumns(profileRef, currentTabRef = null) {
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
    const cols = []
    if (matrix.current_liunian) cols.push(matrix.current_liunian)
    if (matrix.current_dayun) cols.push(matrix.current_dayun)
    cols.push(...(matrix.pillars || []))
    return cols
  })

  return { resolvedMatrix, displayColumns }
}

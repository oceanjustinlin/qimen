<template>
  <div class="av">
    <header class="ah">
      <router-link class="back" to="/" aria-label="返回首页">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3 6 8l4 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        返回
      </router-link>
      <div class="atitle">管理员 · 数据总览</div>
      <div class="abadge">ADMIN</div>
    </header>

    <div class="ac">
      <!-- 统计栏 -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num">{{ qimenRecords.length }}</div>
          <div class="stat-label">奇门记录</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ baziProfiles.length }}</div>
          <div class="stat-label">八字档案</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{{ uniqueUsers }}</div>
          <div class="stat-label">活跃用户</div>
        </div>
      </div>

      <!-- Tab 切换 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="err">{{ error }}</div>

      <!-- 奇门记录表 -->
      <div v-else-if="activeTab === 'qimen'" class="table-wrap">
        <table class="dtable">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户 ID</th>
              <th>问题</th>
              <th>分类</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rec in qimenRecords" :key="rec.id" @click="openDetail(rec, 'qimen')" class="drow">
              <td class="mono">{{ fmt(rec.created_at) }}</td>
              <td class="mono uid">{{ rec.user_id }}</td>
              <td class="question-cell">{{ rec.question }}</td>
              <td>{{ rec.category || '—' }}</td>
              <td><span class="view-btn">查看</span></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!qimenRecords.length" class="empty">暂无记录</div>
      </div>

      <!-- 八字档案表 -->
      <div v-else-if="activeTab === 'bazi'" class="table-wrap">
        <table class="dtable">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户 ID</th>
              <th>姓名</th>
              <th>出生日期</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="prof in baziProfiles" :key="prof.id" @click="openDetail(prof, 'bazi')" class="drow">
              <td class="mono">{{ fmt(prof.created_at) }}</td>
              <td class="mono uid">{{ prof.user_id }}</td>
              <td>{{ prof.name || '—' }}</td>
              <td class="mono">{{ formatBirth(prof) }}</td>
              <td><span class="view-btn">查看</span></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!baziProfiles.length" class="empty">暂无档案</div>
      </div>

      <!-- 反馈表 -->
      <div v-else-if="activeTab === 'feedback'" class="table-wrap">
        <table class="dtable">
          <thead>
            <tr>
              <th>时间</th>
              <th>用户 ID</th>
              <th>记录 ID</th>
              <th>准确性</th>
              <th>实际方向</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fb in feedbacks" :key="fb.id">
              <td class="mono">{{ fmt(fb.created_at) }}</td>
              <td class="mono uid">{{ fb.user_id }}</td>
              <td class="mono uid">{{ fb.record_id }}</td>
              <td>{{ fb.accuracy_status || '—' }}</td>
              <td>{{ fb.actual_direction || '—' }}</td>
              <td>{{ fb.note || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!feedbacks.length" class="empty">暂无反馈</div>
      </div>
    </div>

    <!-- 详情抽屉 -->
    <div v-if="detail" class="detail-overlay" @click.self="detail = null">
      <div class="detail-panel">
        <div class="detail-header">
          <span class="detail-title">{{ detail.type === 'qimen' ? '奇门记录详情' : '八字档案详情' }}</span>
          <button class="close-btn" @click="detail = null">✕</button>
        </div>
        <div class="detail-meta">
          <div><span class="ml">用户 ID</span><span class="mono">{{ detail.data.user_id }}</span></div>
          <div><span class="ml">创建时间</span><span class="mono">{{ fmt(detail.data.created_at) }}</span></div>
          <div v-if="detail.type === 'qimen'"><span class="ml">问题</span><span>{{ detail.data.question }}</span></div>
          <div v-if="detail.type === 'bazi'"><span class="ml">姓名</span><span>{{ detail.data.name }}</span></div>
          <div v-if="detail.type === 'bazi'"><span class="ml">出生</span><span class="mono">{{ formatBirth(detail.data) }}</span></div>
        </div>
        <div class="detail-json-label">原始 JSON</div>
        <pre class="detail-json">{{ JSON.stringify(detail.type === 'qimen' ? detail.data.qimen_data : detail.data.bazi_detail, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xkbqiiwwgfzkyfhxuoev.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_qr9YBIA6n32r-mcqKbkpgA_0XVTUSI7'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const qimenRecords = ref([])
const baziProfiles = ref([])
const feedbacks = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref('qimen')
const detail = ref(null)

const tabs = [
  { key: 'qimen', label: '奇门记录' },
  { key: 'bazi', label: '八字档案' },
  { key: 'feedback', label: '占卜反馈' },
]

const uniqueUsers = computed(() => {
  const ids = new Set([
    ...qimenRecords.value.map(r => r.user_id),
    ...baziProfiles.value.map(p => p.user_id),
  ])
  return ids.size
})

const fmt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const formatBirth = (prof) => {
  if (!prof.birth_datetime) return `${prof.birth_year || '?'}-${String(prof.birth_month || '?').padStart(2, '0')}-${String(prof.birth_day || '?').padStart(2, '0')}`
  return new Date(prof.birth_datetime).toLocaleDateString('zh-CN')
}

const openDetail = (data, type) => {
  detail.value = { data, type }
}

onMounted(async () => {
  try {
    const [qRes, bRes, fRes] = await Promise.all([
      supabase.from('qimen_records').select('*').order('created_at', { ascending: false }),
      supabase.from('bazi_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('qimen_feedback').select('*').order('created_at', { ascending: false }),
    ])
    if (qRes.error) throw qRes.error
    if (bRes.error) throw bRes.error
    if (fRes.error) throw fRes.error
    qimenRecords.value = qRes.data
    baziProfiles.value = bRes.data
    feedbacks.value = fRes.data
  } catch (e) {
    error.value = `加载失败：${e.message}`
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.av { min-height: 100vh; color: var(--text-primary, #e8e0d0); }

.ah {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px; border-bottom: 1px solid rgba(184,143,54,0.2);
  position: sticky; top: 0; z-index: 10;
  background: var(--bg-deep, #0d0d12);
}
.back {
  display: flex; align-items: center; gap: 4px;
  color: var(--gold, #B88F36); text-decoration: none; font-size: 14px;
}
.atitle { flex: 1; font-size: 16px; font-weight: 600; text-align: center; }
.abadge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  color: #0d0d12; background: var(--gold, #B88F36);
  padding: 2px 8px; border-radius: 4px;
}

.ac { padding: 20px 16px; max-width: 1000px; margin: 0 auto; }

.stats-row { display: flex; gap: 12px; margin-bottom: 24px; }
.stat-card {
  flex: 1; text-align: center; padding: 16px 8px;
  background: rgba(184,143,54,0.08); border: 1px solid rgba(184,143,54,0.2);
  border-radius: 10px;
}
.stat-num { font-size: 28px; font-weight: 700; color: var(--gold, #B88F36); }
.stat-label { font-size: 12px; color: var(--text-secondary, #888); margin-top: 4px; }

.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab-btn {
  padding: 7px 18px; border-radius: 20px; border: 1px solid rgba(184,143,54,0.3);
  background: transparent; color: var(--text-secondary, #888); cursor: pointer; font-size: 14px;
  transition: all 0.2s;
}
.tab-btn.active {
  background: rgba(184,143,54,0.15); border-color: var(--gold, #B88F36);
  color: var(--gold, #B88F36);
}

.loading, .err, .empty {
  text-align: center; padding: 40px; color: var(--text-secondary, #888); font-size: 14px;
}
.err { color: #e05; }

.table-wrap { overflow-x: auto; }
.dtable {
  width: 100%; border-collapse: collapse; font-size: 13px;
}
.dtable th {
  text-align: left; padding: 10px 12px;
  color: var(--text-secondary, #888); font-weight: 500; font-size: 12px;
  border-bottom: 1px solid rgba(184,143,54,0.2);
  white-space: nowrap;
}
.dtable td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.drow { cursor: pointer; transition: background 0.15s; }
.drow:hover { background: rgba(184,143,54,0.06); }
.mono { font-family: monospace; font-size: 12px; }
.uid { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.6; }
.question-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.view-btn {
  font-size: 12px; color: var(--gold, #B88F36);
  border: 1px solid rgba(184,143,54,0.4); border-radius: 4px; padding: 2px 8px;
}

/* 详情抽屉 */
.detail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
  display: flex; justify-content: flex-end;
}
.detail-panel {
  width: min(600px, 95vw); height: 100%; background: var(--bg-deep, #0d0d12);
  border-left: 1px solid rgba(184,143,54,0.25); display: flex; flex-direction: column;
  overflow: hidden;
}
.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid rgba(184,143,54,0.2); flex-shrink: 0;
}
.detail-title { font-size: 15px; font-weight: 600; }
.close-btn {
  background: none; border: none; color: var(--text-secondary, #888);
  font-size: 18px; cursor: pointer; padding: 4px 8px;
}
.detail-meta {
  padding: 16px 20px; display: flex; flex-direction: column; gap: 10px;
  border-bottom: 1px solid rgba(184,143,54,0.15); flex-shrink: 0;
}
.detail-meta > div { display: flex; gap: 12px; align-items: flex-start; font-size: 13px; }
.ml { color: var(--text-secondary, #888); min-width: 72px; flex-shrink: 0; }
.detail-json-label {
  padding: 12px 20px 4px; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-secondary, #888); flex-shrink: 0;
}
.detail-json {
  flex: 1; overflow: auto; margin: 0; padding: 12px 20px 20px;
  font-family: monospace; font-size: 11px; line-height: 1.6;
  color: #b8c8a0; white-space: pre-wrap; word-break: break-all;
}
</style>

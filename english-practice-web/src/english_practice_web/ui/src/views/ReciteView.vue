<template>
  <div class="recite-layout">
    <div v-if="!store.currentPhrase" class="empty-state">Loading...</div>
    <template v-else>
      <a-card class="recite-card">
        <template #title>
          <div class="card-title-row">
            <a-button-group type="text" size="small">
              <a-button :disabled="isFirst" @click="navigate(-1)">←</a-button>
              <a-button disabled class="pos-text">{{ posText }}</a-button>
              <a-button :disabled="isLast" @click="navigate(1)">→</a-button>
            </a-button-group>
          </div>
        </template>
        <h1 class="phrase-title">{{ store.currentPhrase.phrase }}</h1>
        <p class="card-meta"><span class="card-label">Example:</span> {{ store.currentPhrase.example }}</p>

        <!-- Per-meaning sections -->
        <div v-for="m in store.currentPhrase.meanings" :key="m.meaning_index" class="meaning-section">
          <div class="meaning-header">
            <span v-if="store.currentPhrase.meanings.length > 1" class="meaning-index">#{{ m.meaning_index + 1 }}</span>
            <span class="meaning-text">{{ m.meaning }}</span>
          </div>
          <div class="btn-row meaning-btns">
            <a-button size="small" status="success" @click="doMark(m, 'known')">Known</a-button>
            <a-button size="small" status="danger" @click="doMark(m, 'unknown')">Unknown</a-button>
          </div>
          <div v-if="getMarkData(m)" class="mark-row">
            <span class="mark-count">Forgotten {{ getMarkData(m).forget_count }} / {{ getMarkData(m).history.length }}×</span>
            <div class="mark-grid">
              <span v-for="(h, i) in getMarkData(m).history" :key="i"
                class="mark-cell" :class="h.status === 'known' ? 'mg-known' : 'mg-unknown'"
                :title="h.status + ' ' + (h.created_at?.slice(0,10) || '')"></span>
            </div>
          </div>
        </div>

        <div class="recite-section">
          <p class="recite-hint" :class="{ revealed }">
            <template v-if="revealed"><span class="card-label">Meaning:</span> {{ store.currentPhrase.meanings[0].meaning }}</template>
            <template v-else>Type the Chinese meaning from memory</template>
          </p>
          <a-textarea v-model="chineseInput" :auto-size="{ minRows: 4, maxRows: 8 }"
            placeholder="Enter Chinese translation..." />
          <div class="btn-row">
            <a-button @click="revealed = !revealed">{{ revealed ? 'Hide' : 'Show Meaning' }}</a-button>
            <a-button type="primary" :loading="checking" @click="doCheck">AI Check</a-button>
          </div>
          <div v-if="feedback" class="feedback">{{ feedback }}</div>
        </div>
      </a-card>
      <NotesPanel />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../stores/app'
import { api } from '../api'
import NotesPanel from '../components/NotesPanel.vue'

const store = useAppStore()
const chineseInput = ref('')
const feedback = ref('')
const checking = ref(false)
const revealed = ref(false)

onMounted(() => {
  if (!store.currentPhrase && store.navList.length) {
    store.selectPhrase(store.navList[0])
  }
})

function markKey(m) {
  return m.total_meanings > 1 ? `${m.phrase}::${m.meaning_index}` : m.phrase
}

function getMarkData(m) {
  const key = markKey(m)
  return store.marksCache[key] || null
}

const idx = computed(() => store.navList.findIndex(p => p.phrase === store.currentPhrase?.phrase))
const total = computed(() => store.navList.length)
const isFirst = computed(() => idx.value <= 0)
const isLast = computed(() => idx.value >= total.value - 1)
const posText = computed(() => total.value ? `${idx.value + 1} / ${total.value}` : '')

function navigate(dir) {
  const ni = idx.value + dir
  if (ni < 0 || ni >= total.value) return
  store.selectPhrase(store.navList[ni])
}

async function doCheck() {
  if (!chineseInput.value.trim()) return
  checking.value = true
  feedback.value = ''
  try {
    const data = await api.checkRecite(store.currentPhrase.phrase, chineseInput.value.trim())
    feedback.value = data.feedback
  } catch (e) {
    feedback.value = 'Error: ' + e.message
  } finally {
    checking.value = false
  }
}

async function doMark(m, status) {
  try {
    const key = markKey(m)
    const result = await api.saveMark(key, status)
    store.marksCache[key] = result
  } catch (e) {
    console.error(e)
  }
}
</script>

<style scoped>
.recite-layout { display: flex; gap: 20px; align-items: flex-start; }
.empty-state { text-align: center; color: #a9aeb8; margin-top: 80px; font-size: 14px; flex: 1; }
.recite-card { flex: 1; max-width: 800px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.pos-text { color: #a9aeb8 !important; cursor: default !important; min-width: 48px; }
.phrase-title { font-size: 32px; font-weight: 600; margin: 16px 0 12px; }
.card-meta { font-size: 14px; color: #4e5969; margin-bottom: 8px; }
.card-label { font-weight: 600; color: #a9aeb8; margin-right: 4px; font-size: 13px; }

.meaning-section {
  background: #f7f8fa; border-radius: 4px; padding: 12px 16px; margin-bottom: 12px;
}
.meaning-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.meaning-index { font-size: 11px; color: #165DFF; font-weight: 600; }
.meaning-text { font-size: 14px; color: #1d2129; font-weight: 500; }
.meaning-btns { margin-top: 4px !important; }

.mark-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.mark-count { font-size: 12px; color: #a9aeb8; white-space: nowrap; }
.mark-grid { display: flex; flex-wrap: wrap; gap: 3px; }
.mark-cell { width: 10px; height: 10px; border-radius: 2px; cursor: default; }
.mg-known { background: #00B42A; }
.mg-unknown { background: #F53F3F; }

.recite-section {
  margin-top: 20px; padding-top: 20px; border-top: 1px solid #f2f3f5;
}
.recite-hint { font-size: 15px; color: #a9aeb8; margin-bottom: 14px; }
.recite-hint.revealed { color: #1d2129; font-weight: 500; }
.btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.feedback { margin-top: 14px; padding: 14px 16px; border-radius: 4px; background: #f7f8fa; font-size: 14px; line-height: 1.6; color: #4e5969; white-space: pre-wrap; }
</style>

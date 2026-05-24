<template>
  <div class="practice-layout">
    <div v-if="!store.currentPhrase" class="empty-state">Loading...</div>
    <template v-else>
      <a-card class="practice-card">
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
        <div v-if="store.currentPhrase.meanings.length > 1" class="meaning-list">
          <div v-for="m in store.currentPhrase.meanings" :key="m.meaning_index" class="meaning-item">
            <span class="meaning-idx">#{{ m.meaning_index + 1 }}</span>
            <span>{{ m.meaning }}</span>
          </div>
        </div>
        <p class="card-meta"><span class="card-label">Meaning:</span> {{ store.currentPhrase.meanings[0].meaning }}</p>
        <p class="card-meta"><span class="card-label">Example:</span> {{ store.currentPhrase.example }}</p>
        <a-textarea v-model="sentence" :auto-size="{ minRows: 4, maxRows: 8 }"
          placeholder="Write your own sentence using this phrasal verb..." />
        <div class="btn-row">
          <a-button type="primary" :loading="checking" @click="doCheck">AI Check</a-button>
        </div>
        <div v-if="feedback" class="feedback">{{ feedback }}</div>
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
const sentence = ref('')
const feedback = ref('')
const checking = ref(false)

onMounted(() => {
  if (!store.currentPhrase && store.navList.length) {
    store.selectPhrase(store.navList[0])
  }
})

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
  if (!sentence.value.trim()) return
  checking.value = true
  feedback.value = ''
  try {
    const data = await api.checkSentence(store.currentPhrase.phrase, sentence.value.trim())
    feedback.value = data.feedback
  } catch (e) {
    feedback.value = 'Error: ' + e.message
  } finally {
    checking.value = false
  }
}
</script>

<style scoped>
.practice-layout { display: flex; gap: 20px; align-items: flex-start; }
.empty-state { text-align: center; color: #a9aeb8; margin-top: 80px; font-size: 14px; flex: 1; }
.practice-card { flex: 1; max-width: 800px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.pos-text { color: #a9aeb8 !important; cursor: default !important; min-width: 48px; }
.phrase-title { font-size: 32px; font-weight: 600; margin: 16px 0 12px; }
.card-meta { font-size: 14px; color: #4e5969; margin-bottom: 8px; }
.card-label { font-weight: 600; color: #a9aeb8; margin-right: 4px; font-size: 13px; }
.meaning-list { margin-bottom: 12px; }
.meaning-item { font-size: 13px; color: #4e5969; padding: 4px 0; display: flex; gap: 6px; }
.meaning-idx { color: #165DFF; font-weight: 600; min-width: 18px; }
.btn-row { margin-top: 14px; }
.feedback { margin-top: 14px; padding: 14px 16px; border-radius: 4px; background: #f7f8fa; font-size: 14px; line-height: 1.6; color: #4e5969; white-space: pre-wrap; }
</style>

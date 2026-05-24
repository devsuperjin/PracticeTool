<template>
  <a-card title="Default View" class="settings-card">
    <a-select v-model="defaultView" :style="{ width: '160px' }" @change="saveDefaultView">
      <a-option value="practice">Practice</a-option>
      <a-option value="recite">Recite</a-option>
    </a-select>
  </a-card>

  <div class="select-toolbar">
    <a-select v-model="planFilter" :style="{ width: '200px' }" placeholder="-- All words --" allow-clear @change="onPlanChange">
      <a-option value="">-- All words --</a-option>
      <a-option v-for="p in store.plans" :key="p.name" :value="p.name">{{ p.name }} ({{ p.words.length }})</a-option>
    </a-select>
    <a-input v-model="planName" placeholder="Plan name..." :style="{ width: '150px' }" />
    <a-input-number v-model="days" :min="1" :max="365" :style="{ width: '80px' }" />
    <a-button type="primary" @click="autoCreate">Auto Create</a-button>
    <a-radio-group v-model="selectFilter" type="button" size="small">
      <a-radio value="all">All</a-radio>
      <a-radio value="selected">Selected</a-radio>
      <a-radio value="unselected">Unselected</a-radio>
    </a-radio-group>
    <a-button status="warning" @click="randomSelect20">Random 20</a-button>
    <a-button status="success" @click="saveManualPlan">Save</a-button>
    <a-button status="danger" @click="deleteCurrentPlan">Delete</a-button>
    <a-button status="danger" @click="deleteAllPlans">Delete All</a-button>
  </div>

  <div class="select-grid">
    <template v-for="letter in filteredLetters" :key="letter">
      <div class="select-letter">
        <div class="select-letter-head">
          {{ letter }}
          <span class="sel-count">{{ filteredGroups[letter].filter(p => isLocked(p)).length }}/{{ filteredGroups[letter].length }}</span>
        </div>
        <div class="select-words">
          <span v-for="p in filteredGroups[letter]" :key="p.phrase"
            class="select-word" :class="{ selected: isSelected(p), locked: isLocked(p) }"
            @click="toggleWord(p)">
            <span class="sw-cb">{{ isSelected(p) ? '✓' : '○' }}</span>
            <span v-if="store.notesCache[p.phrase]?.some(n => n.content.trim())" class="sw-dot visible"></span>
            {{ p.phrase }}
          </span>
        </div>
      </div>
    </template>

    <div class="reset-section">
      <a-card title="System" size="small">
        <a-popconfirm content="This will delete ALL notes, marks, and plans. Are you sure?" @ok="doReset">
          <a-button status="danger">Reset All Data</a-button>
        </a-popconfirm>
      </a-card>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/app'
import { api } from '../api'
import { useRouter } from 'vue-router'

const store = useAppStore()
const router = useRouter()

const defaultView = ref(localStorage.getItem('defaultView') || 'practice')
const planFilter = ref(store.activePlan?.name || '')
const planName = ref('')
const days = ref(30)
const selectFilter = ref('all')
const selectedSet = ref(new Set())

function saveDefaultView() {
  localStorage.setItem('defaultView', defaultView.value)
}

const isLocked = (p) => store.activePlan ? store.activePlan.words.includes(p.phrase) : false
const isSelected = (p) => isLocked(p) || selectedSet.value.has(p.phrase)

function toggleWord(p) {
  if (isLocked(p)) return
  if (selectedSet.value.has(p.phrase)) selectedSet.value.delete(p.phrase)
  else selectedSet.value.add(p.phrase)
  selectedSet.value = new Set(selectedSet.value)
}

const filteredGroups = computed(() => {
  const g = {}
  for (const p of store.phrases) {
    const ch = p.phrase.charAt(0).toUpperCase()
    if (!g[ch]) g[ch] = []
    const show = selectFilter.value === 'all' ? true
      : selectFilter.value === 'selected' ? isSelected(p)
      : !isSelected(p)
    if (show) g[ch].push(p)
  }
  return g
})

const filteredLetters = computed(() => {
  return Object.keys(filteredGroups.value).filter(k => filteredGroups.value[k].length).sort()
})

function onPlanChange(name) {
  if (!name) {
    store.setActivePlan(null)
  } else {
    const p = store.plans.find(x => x.name === name)
    if (p) store.setActivePlan(p)
  }
  selectedSet.value = new Set()
}

async function autoCreate() {
  const baseName = planName.value.trim() || ('Plan ' + new Date().toLocaleDateString().replaceAll('/', '-'))
  const d = days.value || 30
  const perDay = Math.max(1, Math.floor(store.phrases.length / d))
  const total = Math.min(store.phrases.length, d * perDay)
  const pool = [...store.phrases]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const picked = pool.slice(0, total).map(p => p.phrase)
  for (let i = 0; i < d; i++) {
    const words = picked.slice(i * perDay, (i + 1) * perDay)
    if (!words.length) continue
    await api.savePlan(baseName + ' - Day ' + (i + 1), words)
  }
  await store.refreshPlans()
  planName.value = ''
  const first = store.plans.find(x => x.name === baseName + ' - Day 1')
  if (first) { store.setActivePlan(first); planFilter.value = first.name }
}

async function saveManualPlan() {
  const name = planName.value.trim().replaceAll('/', '-')
  if (!name) return
  const locked = new Set(store.activePlan?.words || [])
  const words = [...new Set([...locked, ...selectedSet.value])]
  if (!words.length) return
  const res = await api.savePlan(name, words)
  await store.refreshPlans()
  store.setActivePlan(res)
  planFilter.value = name
  planName.value = ''
  selectedSet.value = new Set()
}

async function deleteCurrentPlan() {
  if (!store.activePlan) return
  await api.deletePlan(store.activePlan.name)
  await store.refreshPlans()
  store.setActivePlan(null)
  planFilter.value = ''
}

async function deleteAllPlans() {
  for (const p of store.plans) { await api.deletePlan(p.name) }
  await store.refreshPlans()
  store.setActivePlan(null)
  planFilter.value = ''
}

function randomSelect20() {
  const locked = new Set(store.activePlan?.words || [])
  const pool = store.phrases.filter(p => !locked.has(p.phrase))
  if (!pool.length) return
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const pick = new Set(pool.slice(0, Math.min(20, pool.length)).map(p => p.phrase))
  selectedSet.value = pick
async function doReset() {
  try {
    await api.resetSystem()
    window.location.reload()
  } catch (e) {
    console.error(e)
  }
}
}
</script>

<style scoped>
.settings-card { margin-bottom: 24px; }
.select-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.select-grid { max-height: calc(100vh - 260px); overflow-y: auto; }
.select-letter { margin-bottom: 4px; }
.select-letter-head {
  padding: 6px 12px; font-size: 12px; font-weight: 600; color: #165DFF;
  background: #f7f8fa; border-radius: 2px; user-select: none;
  display: flex; align-items: center; gap: 6px;
}
.sel-count { font-size: 11px; color: #a9aeb8; font-weight: 400; }
.reset-section { margin-top: 32px; }
.select-words { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 12px; }
.select-word {
  display: inline-flex; align-items: center; gap: 4px; font-size: 13px;
  padding: 3px 10px; border: 1px solid #e5e6eb; border-radius: 2px;
  cursor: pointer; user-select: none; color: #4e5969;
}
.select-word:hover { border-color: #165DFF; color: #165DFF; }
.select-word.selected { background: rgba(22,93,255,.08); border-color: #165DFF; color: #165DFF; }
.select-word.locked { background: rgba(0,180,42,.06); border-color: #00B42A; color: #00B42A; cursor: default; }
.sw-cb { font-size: 11px; }
.sw-dot { width: 5px; height: 5px; border-radius: 50%; background: #F7BA1E; display: none; }
.sw-dot.visible { display: inline-block; }
</style>

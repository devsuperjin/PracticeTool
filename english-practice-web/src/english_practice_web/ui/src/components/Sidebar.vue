<template>
  <div class="sidebar-root">
    <div class="sidebar-header">
      <div class="sidebar-title">
        <span class="sidebar-title-icon">▤</span>
        <span>Word List</span>
      </div>
      <span v-if="store.activePlan" class="plan-badge">{{ store.activePlan.name }}</span>
    </div>
    <div class="alpha-bar">
      <span v-for="ch in alphaList" :key="ch"
        class="alpha-chip" :class="{ empty: !store.groups[ch] }"
        @click="scrollToLetter(ch)">{{ ch }}</span>
    </div>
    <div class="sidebar-list" ref="listRef">
      <div v-if="!store.letters.length" class="sidebar-empty">No words</div>
      <template v-for="letter in store.letters" :key="letter">
        <div class="letter-group">
          <div class="letter-header" :data-letter="letter" @click="toggleCollapse(letter)">
            <span class="letter-label">{{ letter }}</span>
            <span class="letter-count">{{ store.groups[letter].length }}</span>
            <span class="letter-arrow" :class="{ collapsed: collapsed[letter] }">▼</span>
          </div>
          <div class="letter-items" :class="{ collapsed: collapsed[letter] }"
            :style="{ maxHeight: collapsed[letter] ? '0px' : store.groups[letter].length * 34 + 8 + 'px' }">
            <div v-for="p in store.groups[letter]" :key="p.phrase"
              class="item" :class="{ active: store.currentPhrase?.phrase === p.phrase }"
              @click="store.selectPhrase(p)">
              <span class="item-active-bar"></span>
              <span class="name">{{ p.phrase }}</span>
              <span class="item-dots">
                <span v-if="hasNotes(p)" class="dot visible" title="Has notes"></span>
                <span v-if="getMarkStatus(p)" class="mark-dot"
                  :class="getMarkStatus(p) === 'known' ? 'mark-known' : 'mark-unknown'"
                  :title="getMarkTitle(p)"></span>
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const collapsed = ref({})
const listRef = ref(null)

const alphaList = computed(() => {
  const arr = []
  for (let c = 65; c <= 90; c++) arr.push(String.fromCharCode(c))
  return arr
})

function toggleCollapse(letter) {
  collapsed.value[letter] = !collapsed.value[letter]
}

function scrollToLetter(ch) {
  if (!store.groups[ch]) return
  const el = listRef.value?.querySelector(`.letter-header[data-letter="${ch}"]`)
  if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function hasNotes(p) {
  return store.notesCache[p.phrase]?.some(n => n.content.trim())
}

function getMarkStatus(p) {
  const meanings = p.meanings
  if (!meanings || meanings.length === 0) return null

  let anyMarked = false
  let allKnown = true

  for (const m of meanings) {
    const key = m.total_meanings > 1 ? `${p.phrase}::${m.meaning_index}` : p.phrase
    const mark = store.marksCache[key]
    if (mark && mark.latest) {
      anyMarked = true
      if (mark.latest !== 'known') allKnown = false
    } else {
      allKnown = false
    }
  }

  if (!anyMarked) return null
  return allKnown ? 'known' : 'unknown'
}

function getMarkTitle(p) {
  const meanings = p.meanings
  if (!meanings) return ''
  let total = 0
  let forgotten = 0
  for (const m of meanings) {
    const key = m.total_meanings > 1 ? `${p.phrase}::${m.meaning_index}` : p.phrase
    const mark = store.marksCache[key]
    if (mark) {
      total += mark.history?.length || 0
      forgotten += mark.forget_count || 0
    }
  }
  return `Forgotten ${forgotten} / ${total}×`
}
</script>

<style scoped>
.sidebar-root {
  display: flex; flex-direction: column; height: 100%;
  background: #fafbfc;
}

/* ── Header ── */
.sidebar-header {
  padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}
.sidebar-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 600; color: #1d2129;
}
.sidebar-title-icon { font-size: 16px; color: #165DFF; }
.plan-badge {
  font-size: 11px; font-weight: 500; color: #165DFF;
  background: rgba(22,93,255,.08); padding: 2px 10px; border-radius: 10px;
  max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Alpha bar ── */
.alpha-bar {
  display: flex; flex-wrap: wrap; gap: 2px;
  padding: 8px 12px; border-bottom: 1px solid #e5e6eb;
  background: #fff;
}
.alpha-chip {
  width: 20px; height: 20px; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  border-radius: 3px; cursor: pointer; color: #86909c;
  transition: all .12s; letter-spacing: .5px;
}
.alpha-chip:hover { background: rgba(22,93,255,.08); color: #165DFF; }
.alpha-chip.empty { color: #e5e6eb; cursor: default; pointer-events: none; }
.alpha-chip.empty:hover { background: none; color: #e5e6eb; }
.alpha-chip:active { transform: scale(.92); }

/* ── List ── */
.sidebar-list { flex: 1; overflow-y: auto; }
.sidebar-list::-webkit-scrollbar { width: 4px; }
.sidebar-list::-webkit-scrollbar-thumb { background: #e5e6eb; border-radius: 2px; }
.sidebar-list::-webkit-scrollbar-track { background: transparent; }

.letter-group { /* no border, cleaner */ }

.letter-header {
  padding: 6px 20px; font-size: 11px; font-weight: 700; color: #86909c;
  background: #fafbfc; cursor: pointer; display: flex; align-items: center;
  gap: 8px; user-select: none; position: sticky; top: 0; z-index: 5;
  transition: background .12s;
}
.letter-header:hover { background: #f2f3f5; }
.letter-label { text-transform: uppercase; letter-spacing: 1px; }
.letter-count {
  font-size: 10px; color: #c9cdd4; font-weight: 500;
  background: #f2f3f5; padding: 1px 6px; border-radius: 8px;
}
.letter-arrow {
  margin-left: auto; font-size: 10px; color: #c9cdd4;
  transition: transform .2s; display: flex; align-items: center;
}
.letter-arrow.collapsed { transform: rotate(-90deg); }

.letter-items { overflow: hidden; transition: max-height .25s ease; }
.letter-items.collapsed { max-height: 0 !important; }

.item {
  padding: 7px 20px 7px 16px; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: all .12s; position: relative; color: #4e5969;
}
.item:hover { background: rgba(22,93,255,.04); color: #1d2129; }
.item.active {
  background: rgba(22,93,255,.06); color: #165DFF; font-weight: 500;
}
.item-active-bar {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: #165DFF; border-radius: 0 2px 2px 0;
  opacity: 0; transition: opacity .15s;
}
.item.active .item-active-bar { opacity: 1; }
.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-dots { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.dot {
  width: 5px; height: 5px; border-radius: 50%; background: #F7BA1E;
  flex-shrink: 0; opacity: 0; transition: opacity .15s;
}
.dot.visible { opacity: 1; }
.mark-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.mark-dot.mark-known { background: #00B42A; }
.mark-dot.mark-unknown { background: #F53F3F; }

.sidebar-empty {
  padding: 32px 20px; text-align: center; color: #c9cdd4;
  font-size: 13px; font-weight: 500;
}
</style>

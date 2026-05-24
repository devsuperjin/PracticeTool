import { defineStore } from 'pinia'
import { api } from '../api'

export const useAppStore = defineStore('app', {
  state: () => ({
    phrases: [],
    notesCache: {},
    marksCache: {},
    plans: [],
    activePlan: null,
    currentPhrase: null,
    selectedSet: new Set(),
    loading: false,
  }),
  getters: {
    planWords(state) {
      if (!state.activePlan) return [...state.phrases]
      return state.phrases.filter(p => state.activePlan.words.includes(p.phrase))
    },
    groups() {
      const g = {}
      for (const p of this.planWords) {
        const ch = p.phrase.charAt(0).toUpperCase()
        if (!g[ch]) g[ch] = []
        g[ch].push(p)
      }
      return g
    },
    letters() {
      return Object.keys(this.groups).sort()
    },
    navList() {
      return this.planWords.length ? this.planWords : this.phrases
    },
    currentNotes() {
      if (!this.currentPhrase) return []
      return this.notesCache[this.currentPhrase.phrase] || []
    },
  },
  actions: {
    async init() {
      this.loading = true
      try {
        const [phrases, notes, plans, marks] = await Promise.all([
          api.listPhrases(), api.listNotes(), api.listPlans(), api.listMarks()
        ])
        this.phrases = phrases
        this.notesCache = notes
        this.plans = plans
        this.marksCache = marks
        const lp = localStorage.getItem('activePlan')
        if (lp && plans.find(p => p.name === lp)) {
          this.setActivePlan(plans.find(p => p.name === lp))
        }
      } finally {
        this.loading = false
      }
    },
    setActivePlan(plan) {
      this.activePlan = plan
      this.selectedSet.clear()
      if (plan) {
        localStorage.setItem('activePlan', plan.name)
      } else {
        localStorage.removeItem('activePlan')
      }
    },
    selectPhrase(item) {
      this.currentPhrase = item
    },
    async addNote(content) {
      if (!this.currentPhrase || !content.trim()) return
      const note = await api.createNote(this.currentPhrase.phrase, content.trim())
      if (!this.notesCache[this.currentPhrase.phrase]) {
        this.notesCache[this.currentPhrase.phrase] = []
      }
      this.notesCache[this.currentPhrase.phrase].push(note)
      return note
    },
    async updateNote(id, content) {
      const note = await api.updateNote(id, content)
      if (this.currentPhrase && this.notesCache[this.currentPhrase.phrase]) {
        const idx = this.notesCache[this.currentPhrase.phrase].findIndex(n => n.id === id)
        if (idx >= 0) this.notesCache[this.currentPhrase.phrase][idx] = note
      }
      return note
    },
    async deleteNote(id) {
      await api.deleteNote(id)
      if (this.currentPhrase && this.notesCache[this.currentPhrase.phrase]) {
        this.notesCache[this.currentPhrase.phrase] = this.notesCache[this.currentPhrase.phrase].filter(n => n.id !== id)
      }
    },
    async refreshNotes() {
      this.notesCache = await api.listNotes()
    },
    async refreshMarks() {
      this.marksCache = await api.listMarks()
    },
    async refreshPlans() {
      this.plans = await api.listPlans()
    },
  }
})

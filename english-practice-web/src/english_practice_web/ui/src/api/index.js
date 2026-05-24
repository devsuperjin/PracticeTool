const BASE = '/api/v1'

async function fetcher(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

export const api = {
  listPhrases: () => fetcher(`${BASE}/list`),
  listNotes: () => fetcher(`${BASE}/notes`),
  getNotes: (phrase) => fetcher(`${BASE}/notes/${encodeURIComponent(phrase)}`),
  createNote: (phrase, note) => fetcher(`${BASE}/notes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase, note })
  }),
  updateNote: (id, note) => fetcher(`${BASE}/notes/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note })
  }),
  deleteNote: (id) => fetcher(`${BASE}/notes/${id}`, { method: 'DELETE' }),
  checkSentence: (phrase, sentence) => fetcher(`${BASE}/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase, sentence })
  }),
  checkRecite: (phrase, chineseInput) => fetcher(`${BASE}/check-recite`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phrase, chinese_input: chineseInput })
  }),
  listPlans: () => fetcher(`${BASE}/plans`),
  savePlan: (name, words) => fetcher(`${BASE}/plans`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, words })
  }),
  deletePlan: (name) => fetcher(`${BASE}/plans/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  listMarks: () => fetcher(`${BASE}/marks`),
  saveMark: (phrase, status) => fetcher(`${BASE}/marks/${encodeURIComponent(phrase)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
  }),
}

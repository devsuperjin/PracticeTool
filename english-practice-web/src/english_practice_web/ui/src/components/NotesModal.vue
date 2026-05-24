<template>
  <a-modal v-model:visible="visible" title="Notes" @ok="save" @cancel="close" :width="520">
    <template #title>
      📝 Notes — {{ store.currentPhrase?.phrase }}
    </template>
    <a-textarea v-model="content" :auto-size="{ minRows: 6, maxRows: 12 }" placeholder="Write your notes here..." />
    <template #footer>
      <a-button @click="remove">Delete</a-button>
      <a-button type="primary" @click="save">Save</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { api } from '../api'

const store = useAppStore()
const visible = ref(false)
const content = ref('')

watch(() => store.currentPhrase, (val) => {
  if (val) content.value = store.notesCache[val.phrase] || ''
})

async function save() {
  if (!store.currentPhrase) return
  await api.saveNote(store.currentPhrase.phrase, content.value)
  store.notesCache[store.currentPhrase.phrase] = content.value
  visible.value = false
}

async function remove() {
  content.value = ''
  await save()
}

function close() { visible.value = false }

defineExpose({ open: () => { visible.value = true } })
</script>

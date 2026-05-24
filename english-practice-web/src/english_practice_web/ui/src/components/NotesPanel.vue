<template>
  <div class="notes-panel" v-if="store.currentPhrase">
    <div class="notes-panel-header">
      <span>Notes</span>
      <a-button size="mini" type="text" @click="startAdd">+</a-button>
    </div>

    <div class="notes-list" v-if="store.currentNotes.length">
      <div v-for="n in store.currentNotes" :key="n.id"
        class="note-item" :class="{ editing: editingId === n.id }">
        <template v-if="editingId === n.id">
          <a-textarea v-model="editContent" :auto-size="{ minRows: 2, maxRows: 5 }" />
          <div class="note-item-actions">
            <a-button size="mini" status="danger" @click="doDelete(n.id)">Delete</a-button>
            <a-button size="mini" @click="editingId = null">Cancel</a-button>
            <a-button size="mini" type="primary" :loading="saving" @click="doUpdate">Save</a-button>
          </div>
        </template>
        <template v-else>
          <div class="note-item-body" @click="openView(n)">
            <p class="note-text">{{ n.content }}</p>
            <span class="note-time">{{ formatTime(n.created_at) }}</span>
          </div>
          <div class="note-item-btns">
            <a-button size="mini" type="text" status="danger" @click.stop="doDelete(n.id)">
              <template #icon>✕</template>
            </a-button>
            <a-button size="mini" type="text" @click.stop="startEdit(n)">
              <template #icon>✎</template>
            </a-button>
          </div>
        </template>
      </div>
    </div>
    <div v-else class="notes-empty">No notes yet</div>

    <!-- View Modal -->
    <a-modal v-model:visible="viewVisible" title="Note" :width="520" @cancel="viewVisible = false" :footer="false">
      <div class="modal-note-content">{{ viewContent }}</div>
      <div class="modal-note-time">{{ viewTime }}</div>
      <div class="modal-note-close">
        <a-button type="primary" @click="viewVisible = false">Close</a-button>
      </div>
    </a-modal>

    <!-- Add Modal -->
    <a-modal v-model:visible="addVisible" title="New Note" :width="520" @cancel="addVisible = false">
      <a-textarea v-model="newContent" :auto-size="{ minRows: 4, maxRows: 12 }" placeholder="Write a note..." />
      <template #footer>
        <a-button @click="addVisible = false">Cancel</a-button>
        <a-button type="primary" :loading="saving" @click="doAdd">Save</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../stores/app'


const store = useAppStore()

// View modal
const viewVisible = ref(false)
const viewContent = ref('')
const viewTime = ref('')
const activeNoteId = ref(null)

// Inline edit
const editingId = ref(null)
const editContent = ref('')
const saving = ref(false)

// Add
const addVisible = ref(false)
const newContent = ref('')

function formatTime(t) {
  if (!t) return ''
  return t.slice(0, 16).replace('T', ' ')
}

function openView(note) {
  activeNoteId.value = note.id
  viewContent.value = note.content
  viewTime.value = formatTime(note.created_at)
  viewVisible.value = true
}

function startEdit(note) {
  editingId.value = note.id
  editContent.value = note.content
}

async function doUpdate() {
  if (!editContent.value.trim()) return
  saving.value = true
  try {
    await store.updateNote(editingId.value, editContent.value)
    editingId.value = null
  } finally {
    saving.value = false
  }
}

async function doDelete(id) {
  await store.deleteNote(id)
  editingId.value = null
}

function startAdd() {
  newContent.value = ''
  addVisible.value = true
}

async function doAdd() {
  if (!newContent.value.trim()) return
  saving.value = true
  try {
    await store.addNote(newContent.value)
    newContent.value = ''
    addVisible.value = false
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.notes-panel {
  width: 280px; flex-shrink: 0;
  background: #fff; border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,.06);
  display: flex; flex-direction: column;
  max-height: calc(100vh - 120px);
}
.notes-panel-header {
  padding: 12px 16px; font-size: 14px; font-weight: 600;
  border-bottom: 1px solid #f2f3f5;
  display: flex; align-items: center; justify-content: space-between;
}
.notes-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.note-item {
  display: flex; align-items: flex-start;
  border-bottom: 1px solid #f7f8fa; transition: background .1s;
}
.note-item:hover { background: #f7f8fa; }
.note-item.editing {
  flex-direction: column; padding: 8px 12px; background: #f7f8fa;
}
.note-item-body {
  flex: 1; padding: 10px 16px; cursor: pointer; min-width: 0;
}
.note-text {
  font-size: 13px; color: #4e5969; line-height: 1.5;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  margin-bottom: 4px;
}
.note-time { font-size: 11px; color: #a9aeb8; }
.note-item-btns {
  display: flex; flex-direction: column; flex-shrink: 0;
  padding: 4px 4px 0 0; opacity: 0; transition: opacity .12s;
}
.note-item:hover .note-item-btns { opacity: 1; }
.note-item-actions {
  display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px;
}
.notes-empty {
  padding: 24px 16px; text-align: center; color: #a9aeb8; font-size: 13px;
}
.modal-note-content {
  font-size: 14px; color: #1d2129; line-height: 1.7; white-space: pre-wrap;
  max-height: 400px; overflow-y: auto;
}
.modal-note-time {
  font-size: 12px; color: #a9aeb8; margin-top: 12px; padding-top: 12px;
  border-top: 1px solid #f2f3f5;
}
.modal-note-close { margin-top: 16px; text-align: right; }
</style>

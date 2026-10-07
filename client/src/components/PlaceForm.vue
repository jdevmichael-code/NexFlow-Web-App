<script setup>
// Create / edit form for a room or channel.
import { reactive, ref } from 'vue'
import { errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  type: { type: String, required: true }, // 'room' | 'channel'
  initial: { type: Object, default: null }, // existing place when editing
  submitLabel: { type: String, default: 'Create' },
  submit: { type: Function, required: true }, // async (data) => {}
})

const form = reactive({
  name: props.initial?.name || '',
  description: props.initial?.description || '',
  isPublic: props.initial?.isPublic ?? true,
})
const saving = ref(false)
const toast = useToast()

async function save() {
  saving.value = true
  try {
    await props.submit({ ...form })
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="save">
    <div>
      <label class="label" for="place-name">Name</label>
      <input id="place-name" v-model="form.name" class="input" maxlength="50" required autofocus />
    </div>

    <div>
      <label class="label" for="place-description">Description <span class="font-normal text-subtle">(optional)</span></label>
      <textarea id="place-description" v-model="form.description" class="input" rows="2" maxlength="300" />
    </div>

    <fieldset>
      <legend class="label">Who can join?</legend>
      <div class="grid gap-2 sm:grid-cols-2">
        <label
          class="flex cursor-pointer gap-2 rounded-xl p-3 text-sm"
          :class="form.isPublic ? 'glass-selected' : 'glass-soft'"
        >
          <input v-model="form.isPublic" type="radio" :value="true" class="mt-0.5 accent-indigo-600" />
          <span><b>🌐 Public</b><br /><span class="text-muted">Anyone can find and join</span></span>
        </label>
        <label
          class="flex cursor-pointer gap-2 rounded-xl p-3 text-sm"
          :class="!form.isPublic ? 'glass-selected' : 'glass-soft'"
        >
          <input v-model="form.isPublic" type="radio" :value="false" class="mt-0.5 accent-indigo-600" />
          <span><b>🔒 Private</b><br /><span class="text-muted">Only people you add</span></span>
        </label>
      </div>
    </fieldset>

    <div class="flex justify-end">
      <button type="submit" class="btn btn-primary" :disabled="saving || !form.name.trim()">
        {{ saving ? 'Saving…' : props.submitLabel }}
      </button>
    </div>
  </form>
</template>

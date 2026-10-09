<script setup>
// Text box + image picker, used for chat messages and channel posts.
// Enter sends, Shift+Enter makes a new line.
// `submit` is an async function from the parent; the box clears when it succeeds.
import { computed, onUnmounted, ref } from 'vue'
import { errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import { formatSize } from '@/utils/format'
import Icon from './Icon.vue'

const props = defineProps({
    submit: { type: Function, required: true }, // async ({ text, file }) => {}
    placeholder: { type: String, default: 'Write a message…' },
    buttonLabel: { type: String, default: 'Send' },
    rows: { type: Number, default: 1 },
})

// 'typing': fired on every keystroke that leaves text in the box (the parent decides how often to tell others)
const emit = defineEmits(['typing'])

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const toast = useToast()
const text = ref('')
const file = ref(null)
const previewUrl = ref(null)
const sending = ref(false)
const fileInput = ref(null)

const canSend = computed(() => !sending.value && (text.value.trim() || file.value))

function pickFile(event) {
    const picked = event.target.files[0]
    event.target.value = '' // allow picking the same file again later
    if (!picked) return

    if (!ALLOWED.includes(picked.type)) return toast.error('Only JPG, PNG, GIF and WEBP images are allowed')
    if (picked.size > MAX_BYTES) return toast.error('Image is too big (max 10 MB)')

    removeFile()
    file.value = picked
    previewUrl.value = URL.createObjectURL(picked)
}

function removeFile() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    file.value = null
    previewUrl.value = null
}

async function send() {
    if (!canSend.value) return
    sending.value = true
    const sentText = text.value
    const sentFile = file.value
    try {
        await props.submit({ text: sentText.trim(), file: sentFile })
        // Only clear what was sent: the user may already be typing or attaching the next one
        if (text.value === sentText) text.value = ''
        if (file.value === sentFile) removeFile()
    } catch (error) {
        toast.error(errorMessage(error)) // keep the text so the user can try again
    } finally {
        sending.value = false
    }
}

function onKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault()
        send()
    }
}

onUnmounted(removeFile)
</script>

<template>
    <form class="flex flex-col gap-2" @submit.prevent="send">
        <div v-if="file" class="flex items-center gap-3 rounded-lg bg-hover p-2">
            <img :src="previewUrl" alt="Selected image" class="size-14 rounded object-cover" />
            <div class="min-w-0 flex-1 text-sm">
                <p class="truncate font-medium">{{ file.name }}</p>
                <p class="text-xs text-muted">
                    {{ formatSize(file.size) }}
                    <span v-if="file.size > 1024 * 1024"> · others will see a "Show" button</span>
                </p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" @click="removeFile">Remove</button>
        </div>

        <div class="flex items-end gap-2">
            <button
                type="button"
                class="btn btn-secondary shrink-0 px-3"
                aria-label="Attach an image"
                title="Attach an image"
                @click="fileInput.click()"
                >
                <Icon name="paperclip" />
            </button>
            <input 
                ref="fileInput" 
                type="file" 
                accept="image/jpeg,image/png,image/gif,image/webp" 
                class="hidden" 
                @change="pickFile" 
            />
            <textarea
                v-model="text"
                :rows="props.rows"
                :placeholder="props.placeholder"
                maxlength="5000"
                aria-label="Message"
                class="input max-h-40 min-h-10 min-w-0 resize-none field-sizing-content"
                @keydown="onKeydown"
                @input="$event.target.value.trim() && emit('typing')"
            />
            <button type="submit" class="btn btn-primary shrink-0" :disabled="!canSend">
                {{ sending ? 'Sending…' : props.buttonLabel }}
            </button>
        </div>
    </form>
</template>

<script setup>
// A pop-up window built on the native <dialog> element.
// Usage: <Modal v-model:open="showIt" title="Edit item"> ...content... </Modal>
//
// showModal() gives us focus trapping, Esc to close and a backdrop for free.
// closedby="any" also closes it when clicking outside (with a fallback for Safari).
import { onMounted, ref, useId, watch } from 'vue'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
    title: { type: String, default: '' },
    size: { type: String, default: 'md' }, // sm | md | lg | full
})

const SIZES = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    full: 'max-w-[95vw]',
}

const dialog = ref(null)
const titleId = useId()

function sync(isOpen) {
    const el = dialog.value
    if (!el) return
    if (isOpen && !el.open) el.showModal()
    if (!isOpen && el.open) el.close()
}

// flush: 'post' → open after the content is rendered, so focus lands inside it
watch(open, sync, { flush: 'post' })
onMounted(() => sync(open.value))

// Fires however the dialog was closed (Esc, backdrop click, close button)
function onClose() {
    open.value = false
}

// Fallback light-dismiss for browsers without closedby support
function onClick(event) {
    if ('closedBy' in HTMLDialogElement.prototype) return
    if (event.target !== dialog.value) return
    const rect = dialog.value.getBoundingClientRect()
    const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.bottom &&
        rect.left <= event.clientX &&
        event.clientX <= rect.right
    if (!inside) dialog.value.close()
}
</script>

<template>
    <dialog
        ref="dialog"
        closedby="any"
        :aria-labelledby="props.title ? titleId : undefined"
        :aria-label="props.title ? undefined : 'Dialog'"
        class="m-auto w-[calc(100%-2rem)] glass rounded-2xl p-0 text-fg"
        :class="SIZES[props.size]"
        @close="onClose"
        @click="onClick"
        >
        <div v-if="open" class="p-5">
            <header class="mb-4 flex items-start justify-between gap-4">
                <h2 v-if="props.title" :id="titleId" class="text-lg font-semibold text-fg">{{ props.title }}</h2>
                <button 
                    type="button" 
                    class="btn btn-ghost btn-sm ml-auto"
                    aria-label="Close" 
                    @click="open = false"
                    >✕
                </button>
            </header>
            <slot />
        </div>
    </dialog>
</template>

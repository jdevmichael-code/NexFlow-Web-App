<script setup>
// Emoji reactions under a message or post.
// Shows each used emoji with its count; your own reactions are highlighted.
// The "+" button opens the full emoji list.
import { computed, ref } from 'vue'

// Must match EMOJIS in server/src/utils/reactions.js
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

const props = defineProps({
  reactions: { type: Object, default: () => ({}) }, // { '👍': [userIds] }
  myId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['react'])
const pickerOpen = ref(false)

const used = computed(() =>
  EMOJIS.filter((emoji) => props.reactions[emoji]?.length).map((emoji) => ({
    emoji,
    count: props.reactions[emoji].length,
    mine: props.reactions[emoji].includes(props.myId),
  })),
)

function react(emoji) {
  pickerOpen.value = false
  emit('react', emoji)
}
</script>

<template>
  <div class="mt-1 flex flex-wrap items-center gap-1">
    <button
      v-for="item in used"
      :key="item.emoji"
      type="button"
      :disabled="props.disabled"
      class="badge cursor-pointer transition disabled:cursor-default"
      :class="item.mine ? 'glass-selected' : 'glass-soft text-muted hover:text-fg'"
      :aria-label="`${item.emoji} ${item.count}${item.mine ? ', you reacted' : ''}`"
      :aria-pressed="item.mine"
      @click="react(item.emoji)"
    >
      {{ item.emoji }} <span>{{ item.count }}</span>
    </button>

    <template v-if="!props.disabled">
      <div v-if="pickerOpen" class="glass flex gap-0.5 rounded-full px-1 py-0.5">
        <button
          v-for="emoji in EMOJIS"
          :key="emoji"
          type="button"
          class="cursor-pointer rounded-full px-1 text-lg transition hover:scale-125"
          :aria-label="`React with ${emoji}`"
          @click="react(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
      <button
        type="button"
        class="badge cursor-pointer text-subtle hover:text-fg"
        :aria-label="pickerOpen ? 'Close reactions' : 'Add reaction'"
        :aria-expanded="pickerOpen"
        @click="pickerOpen = !pickerOpen"
      >
        {{ pickerOpen ? '✕' : '☺ +' }}
      </button>
    </template>
  </div>
</template>

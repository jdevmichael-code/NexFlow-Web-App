<script setup>
// One channel post: author, text, image, reactions, and a comments section.
// The parent (ChannelView) owns the data and does the API calls.
import { ref } from 'vue'
import { errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import Avatar from './Avatar.vue'
import ImageView from './ImageView.vue'
import ReactionBar from './ReactionBar.vue'
import { timeAgo } from '@/utils/format'

const props = defineProps({
  post: { type: Object, required: true }, // includes comments: null (not loaded) or []
  myId: { type: String, required: true },
  canInteract: { type: Boolean, default: false }, // members only
  submitComment: { type: Function, required: true }, // async (text) => {}
})

const emit = defineEmits(['react', 'toggle-comments'])
const toast = useToast()
const commentText = ref('')
const sending = ref(false)

async function sendComment() {
  const text = commentText.value.trim()
  if (!text) return
  sending.value = true
  try {
    await props.submitComment(text)
    commentText.value = ''
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <article class="card p-4">
    <header class="flex items-center gap-3">
      <Avatar :user="props.post.author" />
      <div class="min-w-0">
        <p class="truncate font-medium text-fg">{{ props.post.author.displayName }}</p>
        <p class="text-xs text-muted">{{ timeAgo(props.post.createdAt) }}</p>
      </div>
    </header>

    <p v-if="props.post.text" class="mt-3 wrap-break-word whitespace-pre-wrap text-fg">{{ props.post.text }}</p>
    <ImageView v-if="props.post.image" :image="props.post.image" class="mt-2" />

    <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
      <ReactionBar
        :reactions="props.post.reactions"
        :my-id="props.myId"
        :disabled="!props.canInteract"
        @react="emit('react', $event)"
      />
      <button type="button" class="btn btn-ghost btn-sm" :aria-expanded="!!props.post.showComments" @click="emit('toggle-comments')">
        💬 {{ props.post.commentCount || 0 }} {{ props.post.commentCount === 1 ? 'comment' : 'comments' }}
      </button>
    </div>

    <section v-if="props.post.showComments" class="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      <p v-if="!props.post.comments" class="text-sm text-muted">Loading…</p>
      <p v-else-if="props.post.comments.length === 0" class="text-sm text-muted">No comments yet.</p>

      <div v-for="comment in props.post.comments || []" :key="comment._id" class="flex gap-2">
        <Avatar :user="comment.author" size="sm" />
        <div class="min-w-0 rounded-xl bg-hover px-3 py-2">
          <p class="text-xs">
            <span class="font-semibold text-fg">{{ comment.author.displayName }}</span>
            <span class="text-muted"> · {{ timeAgo(comment.createdAt) }}</span>
          </p>
          <p class="text-sm wrap-break-word whitespace-pre-wrap">{{ comment.text }}</p>
        </div>
      </div>

      <form v-if="props.canInteract" class="flex gap-2" @submit.prevent="sendComment">
        <input v-model="commentText" class="input" placeholder="Write a comment…" maxlength="1000" aria-label="Comment" />
        <button type="submit" class="btn btn-primary" :disabled="sending || !commentText.trim()">Reply</button>
      </form>
    </section>
  </article>
</template>

<script setup>
// A month calendar. Click a day to see its plans in a pop-up, add one, edit or delete.
import { computed, reactive, ref, watch } from 'vue'
import { api, errorMessage } from '@/api/http'
import { useToast } from '@/composables/useToast'
import { formatPlanTime, toDateKey } from '@/utils/format'
import Modal from '@/components/Modal.vue'

const toast = useToast()

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const todayKey = toDateKey(new Date())

// The first day of the month on screen
const month = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const plans = ref([])

const monthTitle = computed(() => month.value.toLocaleDateString([], { month: 'long', year: 'numeric' }))

// 6 weeks × 7 days, starting on the Sunday before the 1st
const days = computed(() => {
  const start = new Date(month.value)
  start.setDate(1 - month.value.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return { key: toDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month.value.getMonth() }
  })
})

const plansByDay = computed(() => {
  const groups = {}
  for (const plan of plans.value) (groups[plan.date] ||= []).push(plan)
  return groups
})

async function loadPlans() {
  try {
    const from = days.value[0].key
    const to = days.value[days.value.length - 1].key
    const { data } = await api.get('/plans', { params: { from, to } })
    plans.value = data
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

watch(month, loadPlans, { immediate: true })

function changeMonth(step) {
  month.value = new Date(month.value.getFullYear(), month.value.getMonth() + step, 1)
}

function goToToday() {
  month.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
}

// ---------- the day pop-up ----------

const selectedDay = ref(null) // 'YYYY-MM-DD'
const dayOpen = ref(false)
const form = reactive({ id: null, title: '', time: '', note: '' })
const saving = ref(false)

const selectedPlans = computed(() => plansByDay.value[selectedDay.value] || [])
const selectedTitle = computed(() =>
  selectedDay.value
    ? new Date(selectedDay.value + 'T00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : '',
)

function resetForm() {
  Object.assign(form, { id: null, title: '', time: '', note: '' })
}

function openDay(key) {
  selectedDay.value = key
  resetForm()
  dayOpen.value = true
}

function editPlan(plan) {
  Object.assign(form, { id: plan._id, title: plan.title, time: plan.time, note: plan.note })
}

async function savePlan() {
  saving.value = true
  const body = { date: selectedDay.value, title: form.title, time: form.time, note: form.note }
  try {
    if (form.id) {
      const { data } = await api.put(`/plans/${form.id}`, body)
      plans.value = plans.value.map((plan) => (plan._id === data._id ? data : plan))
      toast.success('Plan updated')
    } else {
      const { data } = await api.post('/plans', body)
      plans.value.push(data)
      toast.success(`Planned "${data.title}"`)
    }
    plans.value.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    resetForm()
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    saving.value = false
  }
}

async function deletePlan(plan) {
  if (!confirm(`Delete "${plan.title}"?`)) return
  try {
    await api.delete(`/plans/${plan._id}`)
    plans.value = plans.value.filter((p) => p._id !== plan._id)
    if (form.id === plan._id) resetForm()
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl p-4 sm:p-6">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="page-title">📅 Planner</h1>
        <p class="text-sm text-muted">Click a day to add or see your plans.</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-secondary" aria-label="Previous month" @click="changeMonth(-1)">‹</button>
        <p class="w-40 text-center font-semibold text-fg" aria-live="polite">{{ monthTitle }}</p>
        <button type="button" class="btn btn-secondary" aria-label="Next month" @click="changeMonth(1)">›</button>
        <button type="button" class="btn btn-ghost" @click="goToToday">Today</button>
      </div>
    </header>

    <div class="card overflow-hidden">
      <div class="grid grid-cols-7 border-b border-line bg-hover text-center text-xs font-semibold text-muted uppercase">
        <div v-for="weekday in WEEKDAYS" :key="weekday" class="py-2">{{ weekday }}</div>
      </div>

      <div class="grid grid-cols-7">
        <button
          v-for="day in days"
          :key="day.key"
          type="button"
          class="flex min-h-16 cursor-pointer flex-col gap-1 border-r border-b border-line p-1.5 text-left transition hover:bg-accent-soft sm:min-h-24"
          :class="day.inMonth ? '' : 'bg-hover text-subtle'"
          :aria-label="`${day.key}, ${(plansByDay[day.key] || []).length} plans`"
          @click="openDay(day.key)"
        >
          <span
            class="inline-flex size-6 items-center justify-center rounded-full text-xs font-medium"
            :class="day.key === todayKey ? 'bg-linear-to-br from-blue-600 to-violet-600 text-white' : ''"
          >
            {{ day.day }}
          </span>

          <!-- Phones: just a dot. Bigger screens: up to 2 plan titles. -->
          <span v-if="plansByDay[day.key]" class="size-1.5 rounded-full bg-indigo-500 sm:hidden" aria-hidden="true" />
          <span
            v-for="plan in (plansByDay[day.key] || []).slice(0, 2)"
            :key="plan._id"
            class="hidden truncate rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent sm:block"
          >
            <span v-if="plan.time" class="font-medium">{{ plan.time }}</span> {{ plan.title }}
          </span>
          <span v-if="(plansByDay[day.key] || []).length > 2" class="hidden text-xs text-muted sm:block">
            +{{ plansByDay[day.key].length - 2 }} more
          </span>
        </button>
      </div>
    </div>

    <Modal v-model:open="dayOpen" :title="selectedTitle">
      <div class="flex flex-col gap-4">
        <div v-if="selectedPlans.length" class="flex flex-col gap-2">
          <div
            v-for="plan in selectedPlans"
            :key="plan._id"
            class="flex items-start gap-3 rounded-xl p-3"
            :class="form.id === plan._id ? 'glass-selected' : 'glass-soft'"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium text-fg">
                <span v-if="plan.time" class="text-accent">{{ formatPlanTime(plan.time) }} · </span>{{ plan.title }}
              </p>
              <p v-if="plan.note" class="mt-0.5 text-sm wrap-break-word whitespace-pre-wrap text-muted">{{ plan.note }}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" @click="editPlan(plan)">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm text-danger" @click="deletePlan(plan)">Delete</button>
          </div>
        </div>
        <p v-else class="rounded-lg bg-hover p-3 text-sm text-muted">Nothing planned for this day yet.</p>

        <form class="flex flex-col gap-3 border-t border-line pt-4" @submit.prevent="savePlan">
          <h3 class="font-medium text-fg">{{ form.id ? 'Edit plan' : 'Add a plan' }}</h3>
          <div class="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div>
              <label class="label" for="plan-title">What?</label>
              <input id="plan-title" v-model="form.title" class="input" maxlength="100" required placeholder="e.g. Team lunch" />
            </div>
            <div>
              <label class="label" for="plan-time">Time</label>
              <input id="plan-time" v-model="form.time" type="time" class="input" />
            </div>
          </div>
          <div>
            <label class="label" for="plan-note">Note <span class="font-normal text-subtle">(optional)</span></label>
            <textarea id="plan-note" v-model="form.note" class="input" rows="2" maxlength="1000" />
          </div>
          <div class="flex justify-end gap-2">
            <button v-if="form.id" type="button" class="btn btn-secondary" @click="resetForm">Cancel edit</button>
            <button v-else type="button" class="btn btn-secondary" @click="dayOpen = false">Close</button>
            <button type="submit" class="btn btn-primary" :disabled="saving || !form.title.trim()">
              {{ saving ? 'Saving…' : form.id ? 'Save changes' : 'Add plan' }}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  </div>
</template>

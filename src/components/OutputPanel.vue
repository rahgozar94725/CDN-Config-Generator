<template>
  <div class="space-y-4">
    <div v-if="generating" class="space-y-2">
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-200"
          :style="{ width: progressPct + '%' }"
        ></div>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('output.progress', { current: progressCurrent, total: progressTotal }) }}
      </p>
    </div>

    <div class="flex items-center justify-between flex-wrap gap-2">
      <p class="text-sm">
        <span v-if="configs.length > 0">{{ $t('output.count', { count: configs.length }) }}</span>
        <span v-else>{{ $t('output.empty') }}</span>
      </p>
      <div class="flex gap-2" v-if="configs.length > 0">
        <button
          @click="copyAll"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition"
        >
          {{ $t('output.copyAll') }}
        </button>
        <button
          @click="download"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
        >
          {{ $t('output.download') }}
        </button>
      </div>
    </div>

    <div
      v-if="configs.length > 0"
      class="relative"
    >
      <textarea
        :value="configs.join('\n')"
        readonly
        class="w-full h-80 border rounded p-3 font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-y"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  configs: { type: Array, default: () => [] },
  generating: { type: Boolean, default: false },
  progressCurrent: { type: Number, default: 0 },
  progressTotal: { type: Number, default: 0 },
})

const progressPct = computed(() => {
  if (props.progressTotal === 0) return 0
  return Math.round((props.progressCurrent / props.progressTotal) * 100)
})

async function copyAll() {
  try {
    const text = props.configs.join('\n')
    await navigator.clipboard.writeText(text)
  } catch { /* fallback if clipboard fails */ }
}

function download() {
  const text = props.configs.join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cdn-configs.txt'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

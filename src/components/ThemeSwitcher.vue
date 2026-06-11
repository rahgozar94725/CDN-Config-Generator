<template>
  <div class="flex items-center gap-2">
    <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('theme.label') }}:</span>
    <select
      :value="current"
      @change="onChange"
      class="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
    >
      <option v-for="t in themes" :key="t" :value="t">{{ $t('theme.' + t) }}</option>
    </select>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { setTheme, getTheme, themes as themeList } from '../theme/index.js'

const themes = themeList
const current = ref(getTheme())

onMounted(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', () => {
    if (getTheme() === 'system') setTheme('system')
  })
})

function onChange(e) {
  current.value = e.target.value
  setTheme(e.target.value)
}
</script>

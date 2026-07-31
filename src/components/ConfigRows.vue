<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h2 class="font-semibold">{{ $t('rows.title') }}</h2>
      <div class="flex gap-2">
        <input
          v-model="applyAllValue"
          :placeholder="$t('rows.applyAllPlaceholder')"
          class="border rounded px-3 py-1 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        />
        <button
          @click="applyAll"
          class="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white transition"
        >
          {{ $t('rows.applyAllButton') }}
        </button>
      </div>
    </div>

    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 rounded-lg p-3 text-sm">
      {{ $t('rows.note') }}
    </div>

    <ul class="space-y-2">
      <li
        v-for="(cfg, i) in configs"
        :key="i"
        class="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-lg p-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">
            <span class="text-blue-600 dark:text-blue-400 uppercase text-xs mr-1">{{ cfg.type }}</span>
            {{ rowIdentity(cfg) }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ cfg.transport || '\u2014' }} &middot; {{ cfg.address }}
          </p>
        </div>
        <div class="flex flex-col gap-1">
          <label class="flex items-center gap-2 text-sm">
            <span class="text-gray-600 dark:text-gray-400 shrink-0">{{ $t('rows.fieldLabel') }}</span>
            <input
              v-model="cfg.routingSubdomain"
              type="text"
              :disabled="!isProcessed(cfg)"
              class="border rounded px-3 py-1 font-mono text-sm bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-64"
              :class="isMissing(i) ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'"
            />
          </label>
          <p v-if="isMissing(i)" class="text-xs text-red-600 dark:text-red-400 sm:text-right">
            {{ $t('rows.requiredError') }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ALLOWED_TRANSPORTS } from '../utils/multiplier.js'

const props = defineProps({
  configs: { type: Array, default: () => [] },
  missingRows: { type: Array, default: () => [] },
})

const applyAllValue = ref('')

const missingIndexes = computed(() => new Set(props.missingRows.map(m => m.index)))

function isMissing(i) {
  return missingIndexes.value.has(i)
}

function isProcessed(cfg) {
  return ALLOWED_TRANSPORTS.includes(cfg.transport)
}

function applyAll() {
  const v = applyAllValue.value.trim()
  if (!v) return
  for (const cfg of props.configs) {
    if (isProcessed(cfg)) cfg.routingSubdomain = v
  }
  applyAllValue.value = ''
}

function rowIdentity(cfg) {
  return cfg.remark || cfg.address || cfg.type
}
</script>

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
              :value="cfg.routingSubdomain"
              type="text"
              :disabled="!isProcessed(cfg)"
              class="border rounded px-3 py-1 font-mono text-sm bg-white dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-64"
              :class="reasonFor(i) ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'"
              @input="onEdit(cfg, $event.target.value)"
            />
            <button
              v-if="canReset(cfg)"
              type="button"
              :title="$t('rows.resetTitle')"
              :aria-label="$t('rows.resetTitle')"
              @click="$emit('reset', cfg.fingerprint)"
              class="shrink-0 px-2 py-1 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              &#8635;
            </button>
          </label>
          <p v-if="reasonFor(i)" class="text-xs text-red-600 dark:text-red-400 sm:text-right">
            {{ $t(errorKey(reasonFor(i))) }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { isProcessedConfig } from '../utils/rows.js'

const props = defineProps({
  configs: { type: Array, default: () => [] },
  invalidRows: { type: Array, default: () => [] },
})

const emit = defineEmits(['edit', 'reset', 'apply-all'])

const applyAllValue = ref('')

const ERROR_KEYS = {
  required: 'rows.requiredError',
  trailingDot: 'rows.trailingDotError',
  format: 'rows.invalidError',
}

const reasonByIndex = computed(() => new Map(props.invalidRows.map(r => [r.index, r.reason])))

function reasonFor(i) {
  return reasonByIndex.value.get(i) || null
}

function errorKey(reason) {
  return ERROR_KEYS[reason] || ERROR_KEYS.format
}

// Reset restores the derived value by dropping the override, so it is offered
// only when both exist — there is nothing to fall back to otherwise.
function canReset(cfg) {
  return isProcessed(cfg) && cfg.hasOverride && !!cfg.derivedRoutingSubdomain
}

function isProcessed(cfg) {
  return isProcessedConfig(cfg)
}

// Field edits never touch the derived row; they report (fingerprint, value) to
// the owner, which writes the override map and lets effective rows re-resolve.
function onEdit(cfg, value) {
  emit('edit', cfg.fingerprint, value)
}

function applyAll() {
  emit('apply-all', applyAllValue.value)
  applyAllValue.value = ''
}

function rowIdentity(cfg) {
  return cfg.remark || cfg.address || cfg.type
}
</script>

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
        class="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-lg p-3"
        :class="isExcluded(cfg)
          ? 'bg-gray-50 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700'
          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">
            <span v-if="cfg.type" class="text-blue-600 dark:text-blue-400 uppercase text-xs mr-1">{{ cfg.type }}</span>
            {{ rowIdentity(cfg) }}
          </p>
          <p v-if="!isUnparsed(cfg)" class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ cfg.transport || '—' }} &middot; {{ cfg.address }}
          </p>
        </div>

        <!-- An excluded row carries the reason instead of a field: it has no
             routing subdomain to hold, and a disabled field said something was
             wrong without saying what. -->
        <p
          v-if="isExcluded(cfg)"
          class="text-xs text-amber-700 dark:text-amber-300 sm:text-right sm:max-w-md"
        >
          {{ $t(excludedKey(cfg)) }}
        </p>

        <div v-else class="flex flex-col gap-1">
          <label class="flex items-center gap-2 text-sm">
            <span class="text-gray-600 dark:text-gray-400 shrink-0">{{ $t('rows.fieldLabel') }}</span>
            <input
              :value="cfg.routingSubdomain"
              type="text"
              class="border rounded px-3 py-1 font-mono text-sm bg-white dark:bg-gray-800 w-full sm:w-64"
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
import { isCompatibleConfig, ROW_UNPARSED } from '../utils/rows.js'

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

// One message per reason, because the remedies differ — see ADR-0004. The flow
// message in particular must not read as a CDN problem.
const EXCLUDED_KEYS = {
  transport: 'rows.transportError',
  security: 'rows.securityError',
  flow: 'rows.flowError',
}

const reasonByIndex = computed(() => new Map(props.invalidRows.map(r => [r.index, r.reason])))

function reasonFor(i) {
  return reasonByIndex.value.get(i) || null
}

function errorKey(reason) {
  return ERROR_KEYS[reason] || ERROR_KEYS.format
}

function excludedKey(cfg) {
  if (isUnparsed(cfg)) return 'rows.unparsedError'
  return EXCLUDED_KEYS[cfg.incompatibleReason] || EXCLUDED_KEYS.transport
}

function isUnparsed(cfg) {
  return cfg.status === ROW_UNPARSED
}

function isExcluded(cfg) {
  return !isCompatibleConfig(cfg)
}

// Reset restores the derived value by dropping the override, so it is offered
// only when both exist — there is nothing to fall back to otherwise.
function canReset(cfg) {
  return !isExcluded(cfg) && cfg.hasOverride && !!cfg.derivedRoutingSubdomain
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
  if (isUnparsed(cfg)) return cfg.raw
  return cfg.remark || cfg.address || cfg.type
}
</script>

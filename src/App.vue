<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <header class="bg-white dark:bg-gray-800 shadow">
      <div class="max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">{{ $t('app.title') }}</h1>
          <p class="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">{{ $t('app.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-4">
          <ThemeSwitcher />
          <LangSwitcher />
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
      <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <InputPanel
          @update:rawConfigs="rawConfigs = $event"
          @update:cdnList="cdnList = $event"
        />
      </section>

      <section v-if="effectiveRows.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <ConfigRows
          :configs="effectiveRows"
          :missingRows="missingRows"
          @edit="setRoutingSubdomain"
          @apply-all="applyRoutingSubdomain"
        />
      </section>

      <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <ConfigPanel
          :enableTls="enableTls"
          :enableNoTls="enableNoTls"
          :noTlsPorts="noTlsPorts"
          :tlsPorts="tlsPorts"
          :alpn="alpn"
          :fingerprint="fingerprint"
          :randomSni="randomSni"
          @update:enableTls="enableTls = $event"
          @update:enableNoTls="enableNoTls = $event"
          @update:noTlsPorts="noTlsPorts = $event"
          @update:tlsPorts="tlsPorts = $event"
          @update:alpn="alpn = $event"
          @update:fingerprint="fingerprint = $event"
          @update:randomSni="randomSni = $event"
        />
      </section>

      <div class="flex justify-center">
        <button
          @click="generate"
          :disabled="!canGenerate(effectiveRows, cdnLines, generationOptions) || generating"
          class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-8 py-3 rounded-lg transition w-full md:w-auto"
        >
          {{ generating ? $t('output.generating') : $t('common.generate') }}
        </button>
      </div>

      <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <OutputPanel
          :configs="outputConfigs"
          :generating="generating"
          :progressCurrent="progressCurrent"
          :progressTotal="progressTotal"
        />
      </section>
    </main>
    <Footer />
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import LangSwitcher from './components/LangSwitcher.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import InputPanel from './components/InputPanel.vue'
import ConfigPanel from './components/ConfigPanel.vue'
import OutputPanel from './components/OutputPanel.vue'
import ConfigRows from './components/ConfigRows.vue'
import Footer from './components/Footer.vue'
import { parseRows, splitLines, canGenerate, generateLinks } from './utils/generation.js'
import { configFingerprint, resolveRoutingSubdomain, findMissingRoutingSubdomain, isProcessedConfig } from './utils/rows.js'

const rawConfigs = ref('')
const cdnList = ref('')
const enableTls = ref(true)
const enableNoTls = ref(true)
const noTlsPorts = ref([80])
const tlsPorts = ref([443])
const alpn = ref([])
const fingerprint = ref([])
const randomSni = ref(false)
const outputConfigs = ref([])
const generating = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)

// Editable routing-subdomain overrides, keyed by config fingerprint (rows.js).
// Parse output is immutable facts; the field is user-owned state layered on top,
// so a raw-config re-parse never discards a typed entry.
const routingOverrides = reactive(new Map())

const parsedConfigs = computed(() => parseRows(rawConfigs.value))

const effectiveRows = computed(() => parsedConfigs.value.map(c => ({
  ...c,
  fingerprint: configFingerprint(c),
  routingSubdomain: resolveRoutingSubdomain(c, routingOverrides),
})))

const missingRows = computed(() => findMissingRoutingSubdomain(effectiveRows.value))

const hasMissing = computed(() => missingRows.value.length > 0)

function setRoutingSubdomain(fingerprint, value) {
  const v = (value || '').trim()
  if (v) routingOverrides.set(fingerprint, v)
  else routingOverrides.delete(fingerprint)
}

function applyRoutingSubdomain(value) {
  const v = (value || '').trim()
  if (!v) return
  for (const c of effectiveRows.value) {
    if (isProcessedConfig(c)) routingOverrides.set(configFingerprint(c), v)
  }
}

const cdnLines = computed(() => splitLines(cdnList.value))

const generationOptions = computed(() => ({
  enableTls: enableTls.value,
  enableNoTls: enableNoTls.value,
  noTlsPorts: noTlsPorts.value,
  tlsPorts: tlsPorts.value,
  alpn: alpn.value,
  fingerprint: fingerprint.value,
  randomSni: randomSni.value,
}))

async function generate() {
  if (effectiveRows.value.length === 0 || cdnLines.value.length === 0) return
  if (hasMissing.value) return

  generating.value = true
  outputConfigs.value = []

  progressTotal.value = effectiveRows.value.length
  progressCurrent.value = 0

  outputConfigs.value = await generateLinks(
    effectiveRows.value,
    cdnLines.value,
    generationOptions.value,
    (current) => { progressCurrent.value = current }
  )

  generating.value = false
}
</script>

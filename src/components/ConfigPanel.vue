<template>
  <div class="space-y-4">
    <div class="flex gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="local.enableTls" />
        <span class="font-medium">{{ $t('config.tlsMode') }}</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="local.enableNoTls" />
        <span class="font-medium">{{ $t('config.noTlsMode') }}</span>
      </label>
    </div>

    <div v-if="local.enableNoTls" class="space-y-1">
      <p class="text-sm font-medium">{{ $t('config.noTlsPorts') }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in allNoTlsPorts"
          :key="p"
          @click="toggleNoTlsPort(p)"
          :class="chipClass(selectedNoTlsPorts, p)"
        >
          {{ p }}
        </button>
      </div>
      <p v-if="local.enableNoTls && selectedNoTlsPorts.length === 0" class="text-red-500 text-xs">
        {{ $t('config.portRequired') }}
      </p>
    </div>

    <div v-if="local.enableTls" class="space-y-1">
      <p class="text-sm font-medium">{{ $t('config.tlsPorts') }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in allTlsPorts"
          :key="p"
          @click="toggleTlsPort(p)"
          :class="chipClass(selectedTlsPorts, p)"
        >
          {{ p }}
        </button>
      </div>
      <p v-if="local.enableTls && selectedTlsPorts.length === 0" class="text-red-500 text-xs">
        {{ $t('config.portRequired') }}
      </p>
    </div>

    <div v-if="local.enableTls" class="border-t pt-4 space-y-3">
      <p class="font-medium">{{ $t('config.tlsAdvanced') }}</p>

      <div class="space-y-1">
        <p class="text-sm">{{ $t('config.alpn') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="a in alpnOptions"
            :key="a"
            @click="toggleAlpn(a)"
            :class="chipClass(selectedAlpn, a)"
          >
            {{ a }}
          </button>
        </div>
        <p v-if="local.enableTls && selectedAlpn.length === 0" class="text-red-500 text-xs">
          {{ $t('config.alpnRequired') }}
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-sm">{{ $t('config.fingerprint') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="f in fingerprintOptions"
            :key="f"
            @click="toggleFingerprint(f)"
            :class="chipClass(selectedFingerprint, f)"
          >
            {{ f }}
          </button>
        </div>
        <p v-if="local.enableTls && selectedFingerprint.length === 0" class="text-red-500 text-xs">
          {{ $t('config.fingerprintRequired') }}
        </p>
      </div>

      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="local.randomSni" />
        <div>
          <span class="font-medium">{{ $t('config.randomSni') }}</span>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ $t('config.randomSniHint') }}</p>
        </div>
      </label>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, watch } from 'vue'

const allNoTlsPorts = [80, 8080, 8880, 2052, 2082, 2086, 2095]
const allTlsPorts = [443, 2053, 2083, 2087, 2096, 8443]
const alpnOptions = ['h3', 'h2', 'http/1.1', 'h3,h2', 'h2,http/1.1', 'h3,h2,http/1.1']
const fingerprintOptions = ['chrome', 'firefox', 'safari', 'edge', 'android', 'random', 'randomized']

const props = defineProps({
  enableTls: { type: Boolean, default: true },
  enableNoTls: { type: Boolean, default: true },
  noTlsPorts: { type: Array, default: () => [80] },
  tlsPorts: { type: Array, default: () => [443] },
  alpn: { type: Array, default: () => [] },
  fingerprint: { type: Array, default: () => [] },
  randomSni: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:enableTls', 'update:enableNoTls',
  'update:noTlsPorts', 'update:tlsPorts',
  'update:alpn', 'update:fingerprint', 'update:randomSni',
])

const local = reactive({
  enableTls: props.enableTls,
  enableNoTls: props.enableNoTls,
  randomSni: props.randomSni,
})

watch(() => local.enableTls, (v) => emit('update:enableTls', v))
watch(() => local.enableNoTls, (v) => emit('update:enableNoTls', v))
watch(() => local.randomSni, (v) => emit('update:randomSni', v))

const selectedNoTlsPorts = reactive([...props.noTlsPorts])
const selectedTlsPorts = reactive([...props.tlsPorts])
const selectedAlpn = reactive([...props.alpn])
const selectedFingerprint = reactive([...props.fingerprint])

function toggle(arr, val, emitKey) {
  const i = arr.indexOf(val)
  if (i >= 0) { arr.splice(i, 1) } else { arr.push(val) }
  emit(emitKey, [...arr])
}

function toggleNoTlsPort(p) { toggle(selectedNoTlsPorts, p, 'update:noTlsPorts') }
function toggleTlsPort(p) { toggle(selectedTlsPorts, p, 'update:tlsPorts') }
function toggleAlpn(a) { toggle(selectedAlpn, a, 'update:alpn') }
function toggleFingerprint(f) { toggle(selectedFingerprint, f, 'update:fingerprint') }

function chipClass(arr, val) {
  return [
    'px-3 py-1 rounded-full text-sm border transition',
    arr.includes(val)
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400',
  ].join(' ')
}
</script>

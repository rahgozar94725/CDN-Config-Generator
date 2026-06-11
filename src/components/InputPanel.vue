<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label class="block text-sm font-medium mb-1">{{ $t('input.rawConfigs.label') }}</label>
      <textarea
        v-model="rawConfigs"
        :placeholder="$t('input.rawConfigs.placeholder')"
        class="w-full h-48 border rounded p-3 font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-y"
      ></textarea>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">{{ $t('input.cdnList.label') }}</label>
      <textarea
        v-model="cdnList"
        :placeholder="$t('input.cdnList.placeholder')"
        class="w-full h-48 border rounded p-3 font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-y"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const rawConfigs = ref('')
const cdnList = ref('')

const emit = defineEmits(['update:rawConfigs', 'update:cdnList'])

watch(rawConfigs, (v) => emit('update:rawConfigs', v))
watch(cdnList, (v) => emit('update:cdnList', v))

defineExpose({ rawConfigs, cdnList })
</script>

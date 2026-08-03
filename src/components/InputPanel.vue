<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label class="block text-sm font-medium mb-1">{{ $t('input.rawConfigs.label') }}</label>
      <textarea
        :value="rawConfigs"
        @input="$emit('update:rawConfigs', $event.target.value)"
        :placeholder="$t('input.rawConfigs.placeholder')"
        class="w-full h-48 border rounded p-3 font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-y"
      ></textarea>
    </div>
    <div>
      <label class="block text-sm font-medium mb-1">{{ $t('input.cdnList.label') }}</label>
      <textarea
        :value="cdnList"
        @input="$emit('update:cdnList', $event.target.value)"
        :placeholder="$t('input.cdnList.placeholder')"
        class="w-full h-48 border rounded p-3 font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 resize-y"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
// Controlled by the owner: deleting a row rewrites the raw-configs text, so the
// value has to be pushed down as well as reported up. Local state here would
// leave the textarea showing a line the model no longer has.
defineProps({
  rawConfigs: { type: String, default: '' },
  cdnList: { type: String, default: '' },
})

defineEmits(['update:rawConfigs', 'update:cdnList'])
</script>

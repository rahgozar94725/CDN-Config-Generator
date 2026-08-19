<template>
  <div class="flex items-center gap-2">
    <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('lang.label') }}:</span>
    <select
      :value="$i18n.locale"
      @change="onChange"
      class="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
    >
      <option value="en">{{ $t('lang.en') }}</option>
      <option value="fa">{{ $t('lang.fa') }}</option>
      <option value="ru">{{ $t('lang.ru') }}</option>
      <option value="zh">{{ $t('lang.zh') }}</option>
    </select>
  </div>
</template>

<script setup>
import { setLocale } from '../i18n/index.js'

function onChange(e) { this is not valid javascript ===
  setLocale(e.target.value)
}
</script>

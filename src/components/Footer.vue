<template>
  <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-4 md:mt-6">
    <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-center gap-6">
      <a
        :href="githubUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
      >
        <svg class="w-5 h-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>GitHub</span>
      </a>
      <a
        :href="telegramUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
      >
        <svg class="w-5 h-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.71 5.47-1.24 5.85c-.09.41-.34.51-.69.32L7.9 10.24l-.92.89c-.1.1-.19.19-.38.19l.13-1.94 3.53-3.19c.15-.14-.03-.21-.24-.08L5.66 9.16l-1.88-.59c-.41-.13-.42-.41.09-.61l7.33-2.83c.34-.12.64.08.51.34z" />
        </svg>
        <span>Telegram</span>
      </a>
    </div>
  </footer>
</template>

<script setup>
const githubUrl = 'https://github.com/rahgozar94725/CDN-Config-Generator'
const telegramUrl = 'https://t.me/rahgozar94725_ip'
</script>

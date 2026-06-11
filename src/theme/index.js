const THEME_KEY = 'cdn-cfg-theme'

const themes = ['light', 'dark', 'system']

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system'
  } catch {
    return 'system'
  }
}

function saveTheme(t) {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch { }
}

function applyTheme(t) {
  const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

const current = loadTheme()
applyTheme(current)

export function setTheme(t) {
  if (!themes.includes(t)) return
  saveTheme(t)
  applyTheme(t)
}

export function getTheme() {
  return loadTheme()
}

export { themes }

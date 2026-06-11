import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import fa from './locales/fa.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'

const LOCALE_KEY = 'cdn-cfg-lang'

function loadLocale() {
  try {
    return localStorage.getItem(LOCALE_KEY) || 'en'
  } catch {
    return 'en'
  }
}

function saveLocale(locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch { /* noop */ }
}

const rtlLocales = ['fa']

const i18n = createI18n({
  locale: loadLocale(),
  fallbackLocale: 'en',
  messages: { en, fa, ru, zh },
})

function applyDirection(locale) {
  const dir = rtlLocales.includes(locale) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', locale)
}

function setLocale(locale) {
  i18n.global.locale = locale
  saveLocale(locale)
  applyDirection(locale)
}

applyDirection(i18n.global.locale)

export { setLocale, rtlLocales }
export default i18n

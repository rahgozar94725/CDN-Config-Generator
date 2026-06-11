import { createApp } from 'vue'
import i18n from './i18n/index.js'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(i18n)
app.mount('#app')

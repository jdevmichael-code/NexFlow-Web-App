import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@fontsource-variable/space-grotesk' // heading font, bundled so it works without internet
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

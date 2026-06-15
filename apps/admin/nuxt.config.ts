// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  extends: ['../../layers/workflow-editor'],
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devServer: {
    host: '0.0.0.0',
    port: 3001
  }
})

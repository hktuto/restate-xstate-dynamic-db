// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  extends: ['../../layers/workflow-editor'],
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  vite: {
    optimizeDeps: {
      include: ['@vue-flow/core', '@vue-flow/background', 'xstate', '@xstate/vue']
    }
  },
  nitro: {
    experimental: {
      tasks: true
    }
  }
})

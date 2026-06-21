// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  extends: ['../../layers/shared-api', '../../layers/workflow-editor', '../../layers/data-table'],
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  ssr:false,
  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL ?? 'http://localhost:3002',
    },
  },
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

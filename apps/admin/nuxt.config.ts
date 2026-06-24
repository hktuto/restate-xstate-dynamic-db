// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  extends: ['../../layers/shared-api', '../../layers/workflow-editor', '../../layers/data-table'],
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  ssr: false,
  components: [
    { path: '~/components', pathPrefix: false },
  ],
  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL ?? 'http://localhost:3002',
    },
  },
  css: ['~/assets/css/main.css'],
})

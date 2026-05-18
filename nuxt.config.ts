import Lara from "@primevue/themes/lara";

export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      socketIoPath: "/socket.io",
      socketIoTransports: "polling,websocket",
      socketIoUrl: "",
    },
  },
  app: {
    head: {
      title: "Obscuritas Event Patcher",
      meta: [
        {
          name: "description",
          content: "Socket.IO and gNMI based Obscuritas Event Patcher portal for Arista switches.",
        },
      ],
    },
  },

  modules: ["@primevue/nuxt-module"],
  css: [
    "@/assets/styles/tailwind.css",
    "primeicons/primeicons.css",
  ],
  primevue: {
    options: {
      theme: {
        preset: Lara,
        options: {
          darkModeSelector: "system",
          cssLayer: {
            name: "primevue",
            order: "tailwind-base, primevue, tailwind-utilities",
          },
        },
      },
    },
  },
  postcss: {
    plugins: {
      "postcss-import": {},
      tailwindcss: {},
      autoprefixer: {},
    },
  },
});

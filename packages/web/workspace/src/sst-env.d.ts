/// <reference types="vite/client" />
  interface ImportMetaEnv {
    readonly VITE_AUTH_URL: string
  readonly VITE_API_URL: string
  readonly VITE_IOT_HOST: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
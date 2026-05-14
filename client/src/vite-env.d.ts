/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** From `client/package.json` at build time. */
  readonly VITE_APP_VERSION: string
  /** Vercel production deploy SHA when set (`VERCEL_GIT_COMMIT_SHA`). */
  readonly VITE_APP_COMMIT: string
}

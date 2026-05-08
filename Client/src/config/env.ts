// src/config/env.ts
const isLocal = import.meta.env.VITE_ENV === 'local'

export const WS_URL = isLocal
  ? import.meta.env.VITE_WS_URL_LOCAL
  : import.meta.env.VITE_WS_URL_PROD

export const API_URL = isLocal
  ? import.meta.env.VITE_API_URL_LOCAL
  : import.meta.env.VITE_API_URL_PROD
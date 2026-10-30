import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { browserSecretNames } from './src/lib/config.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const unsafe = browserSecretNames(env)
  if (unsafe.length) throw new Error(`Remove server-only browser variables: ${unsafe.join(', ')}. Values have been omitted.`)
  return { plugins: [react()] }
})

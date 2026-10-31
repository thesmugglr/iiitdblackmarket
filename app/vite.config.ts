import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { browserSecretNames } from './src/lib/config.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_ENV_DIR lets the deploy script build from an isolated, generated env file instead of local dev files.
  const envDir = process.env.VITE_ENV_DIR ? resolve(process.env.VITE_ENV_DIR) : process.cwd()
  const env = loadEnv(mode, envDir, 'VITE_')
  const unsafe = browserSecretNames(env)
  if (unsafe.length) throw new Error(`Remove server-only browser variables: ${unsafe.join(', ')}. Values have been omitted.`)
  // Project pages (https://user.github.io/repo/) need a sub-path; everything else serves from the root.
  const base = (env.VITE_BASE || '/').replace(/\/*$/, '/')
  return { base, envDir, plugins: [react()] }
})

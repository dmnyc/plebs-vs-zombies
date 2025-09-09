import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { execSync } from 'child_process'

// Get git commit hash
let gitCommit = 'dev'
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
} catch (error) {
  console.warn('Could not get git commit hash, using "dev"')
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitCommit)
  }
})
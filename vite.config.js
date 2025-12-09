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
  plugins: [
    vue(),
    // Custom plugin to handle clean URLs for standalone HTML pages
    {
      name: 'html-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Rewrite /resurrector to /resurrector.html
          if (req.url === '/resurrector') {
            req.url = '/resurrector.html'
          }
          // Rewrite /leaderboard to /leaderboard.html
          else if (req.url === '/leaderboard') {
            req.url = '/leaderboard.html'
          }
          // Rewrite /competition to /competition.html
          else if (req.url === '/competition') {
            req.url = '/competition.html'
          }
          next()
        })
      }
    }
  ],
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
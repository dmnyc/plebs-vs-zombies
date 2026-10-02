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
          // Deep links like /zombiecheck?npub=… carry a query string, so
          // match on the pathname alone and carry the query over — matching
          // how Vercel's rewrites (which ignore the query) behave in prod.
          const [pathname, query = ''] = (req.url || '').split('?');
          const cleanPages = {
            '/resurrector': '/resurrector.html',
            '/leaderboard': '/leaderboard.html',
            '/competition': '/competition.html',
            '/zombiecheck': '/zombiecheck.html',
          };
          if (cleanPages[pathname]) {
            req.url = cleanPages[pathname] + (query ? `?${query}` : '');
          }
          next();
        })
      }
    }
  ],
  resolve: {
    alias: {
      // `import.meta.dirname` rather than `__dirname`: Vite 8's native config
      // loader can't evaluate CJS globals, and it becomes the default loader in
      // a future major.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitCommit)
  }
})
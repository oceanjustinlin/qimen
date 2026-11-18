import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function baziPanelMiddleware() {
  return {
    name: 'bazi-panel-dev',
    configureServer(server) {
      server.middlewares.use('/api/bazi-panel', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405); res.end('Method Not Allowed'); return
        }
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString())
          const profile = body.profileData
          if (!profile?.bazi_detail?.matrix?.pillars?.length) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: '缺少 bazi_detail.matrix' })); return
          }
          const { computePanelData } = require('./lib/baziQuestionCore.js')
          const result = computePanelData(profile, {
            category: body.category,
            subcategory: body.subcategory,
            analysis_mode: body.analysis_mode
          })
          if (!result) {
            res.writeHead(422, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: '该模式不支持 panel 计算' })); return
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[bazi-panel middleware]', e)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    }
  }
}

// lib/i18n/ 下是前后端共用的 CommonJS 文件（Worker 与 node --test 直接用）。
// 浏览器端把它们包成 ESM：`import x from '../../lib/i18n/foo.js'` 拿到 module.exports。
// 只支持不 require 其他模块的纯数据/纯函数文件。
const SHARED_CJS_DIR = new URL('./lib/i18n/', import.meta.url).pathname.replace(/\\/g, '/')

function sharedCjsInterop() {
  return {
    name: 'shared-cjs-interop',
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/')
      if (!file.startsWith(SHARED_CJS_DIR) || !/^[^/]+\.js$/.test(file.slice(SHARED_CJS_DIR.length))) return null
      if (/\brequire\(/.test(code)) {
        this.error(`${file} 被浏览器端引用，不能再 require 其他模块`)
      }
      return {
        code: `const module = { exports: {} }; const exports = module.exports;\n${code}\nexport default module.exports;\n`,
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), baziPanelMiddleware(), sharedCjsInterop()],
  server: {
    proxy: {
      '/api': {
        // 临时指向 preview worker（含 v2 LLM prompt）；测试 v2 期间使用，验收后改回 qimen.oceanjustinlin.workers.dev
        // 本地联调 worker：API_PROXY_TARGET=http://localhost:8787
        target: process.env.API_PROXY_TARGET || 'https://qimen-preview.oceanjustinlin.workers.dev',
        changeOrigin: true,
      }
    }
  }
})

import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import { ROOT } from './config.js'
import { errorMiddleware } from './http.js'
import { menuRouter } from './routes/menu.js'
import { tablesRouter } from './routes/tables.js'
import { ordersRouter } from './routes/orders.js'
import { kitchenRouter } from './routes/kitchen.js'
import { inventoryRouter } from './routes/inventory.js'
import { statsRouter } from './routes/stats.js'

const clientDir = path.join(ROOT, 'client', 'dist')
const clientIndex = path.join(clientDir, 'index.html')

/** True after `npm run build` — then the API also serves the web app. */
export const hasClientBuild = fs.existsSync(clientIndex)

const DEV_CLIENT_URL = 'http://localhost:5173'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'resto-managment', time: new Date().toISOString() })
  })

  app.use('/api/menu', menuRouter)
  app.use('/api/tables', tablesRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/kitchen', kitchenRouter)
  app.use('/api/inventory', inventoryRouter)
  app.use('/api/stats', statsRouter)

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Unknown endpoint' })
  })

  if (hasClientBuild) {
    // Production / preview: serve the built single-page app.
    app.use(express.static(clientDir, { index: false }))
    app.get('*', (_req, res) => {
      res.sendFile(clientIndex)
    })
  } else {
    // Dev: the UI lives in Vite on :5173, so explain that instead of "Cannot GET /".
    app.get('/', (_req, res) => {
      res.type('html').send(landingPage())
    })
    app.get('/favicon.ico', (_req, res) => {
      res.status(204).end()
    })
  }

  app.use(errorMiddleware)
  return app
}

function landingPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mise — API</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #f6f2ea; color: #1c1917;
      }
      main {
        width: min(520px, 90vw); background: #fffdf8;
        border: 1px solid #e3dacb; border-radius: 16px; padding: 28px;
        box-shadow: 0 10px 30px -14px rgba(28,25,23,.35);
      }
      .mark {
        width: 38px; height: 38px; border-radius: 10px; background: #b3400f;
        color: #fff; display: grid; place-items: center;
        font-family: Georgia, serif; font-size: 20px; font-weight: 700; margin-bottom: 14px;
      }
      h1 { font-family: Georgia, serif; font-size: 24px; margin: 0 0 6px; }
      p { margin: 0 0 16px; color: #57534e; font-size: 14px; line-height: 1.6; }
      a.btn {
        display: inline-block; padding: 9px 16px; border-radius: 9px;
        background: #b3400f; color: #fff; text-decoration: none;
        font-size: 14px; font-weight: 600; margin-right: 8px;
      }
      a.btn--ghost { background: transparent; color: #1c1917; border: 1px solid #d3c7b4; }
      code { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; background: #f6f2ea; padding: 2px 6px; border-radius: 4px; }
      ul { padding-left: 18px; margin: 16px 0 0; color: #57534e; font-size: 13px; line-height: 1.9; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">M</div>
      <h1>Mise API is running</h1>
      <p>
        This port serves the JSON API. The web app is not built yet, so open the Vite dev
        server instead.
      </p>
      <p>
        <a class="btn" href="${DEV_CLIENT_URL}">Open the app on :5173</a>
        <a class="btn btn--ghost" href="/api/health">API health</a>
      </p>
      <ul>
        <li>UI: <code>${DEV_CLIENT_URL}</code> (run <code>npm run dev</code>)</li>
        <li>API: <code>/api/*</code></li>
        <li>Single-port build: <code>npm run build</code> then reload this page</li>
      </ul>
    </main>
  </body>
</html>`
}

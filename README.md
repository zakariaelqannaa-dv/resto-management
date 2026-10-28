# Mise — Restaurant Manager



[![Release](https://img.shields.io/github/v/release/zakariaelqannaa-dv/resto-management?style=for-the-badge&logo=github&label=release)](https://github.com/zakariaelqannaa-dv/resto-management/releases/latest)

[![Downloads](https://img.shields.io/github/downloads/zakariaelqannaa-dv/resto-management/total?style=for-the-badge&logo=github)](https://github.com/zakariaelqannaa-dv/resto-management/releases)

[![Build](https://img.shields.io/github/actions/workflow/status/zakariaelqannaa-dv/resto-management/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=build)](https://github.com/zakariaelqannaa-dv/resto-management/actions/workflows/ci.yml)

[![License: MIT](https://img.shields.io/github/license/zakariaelqannaa-dv/resto-management?style=for-the-badge&color=22c55e)](LICENSE)



[![Windows](https://img.shields.io/badge/Windows-10%2F11%20x64-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#-download-for-windows)

[![Electron](https://img.shields.io/badge/Electron-33-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)

[![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PGlite%20embedded-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://pglite.dev/)

[![Offline](https://img.shields.io/badge/Offline-100%25-16a34a?style=for-the-badge&logo=cloudflare&logoColor=white)](#-download-for-windows)

[![Made by zakariaelqannaa-dv](https://img.shields.io/badge/made%20by-zakariaelqannaa--dv-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://github.com/zakariaelqannaa-dv)



Restaurant back-of-house app: menu, floor tables, orders and an **editable kitchen ticket board**

where every ticket carries a service date and a day-scoped code number.



React + Express + PostgreSQL. Runs out of the box on an embedded Postgres (PGlite) — **no database

install needed** — and switches to a real Postgres by setting `DATABASE_URL`.



---



## 📥 Download for Windows



No Node.js, no PostgreSQL, no internet connection required. Pick one:



| Download | Size | Best for |

| --- | --- | --- |

| [**⬇ Mise Setup 0.1.0 (.exe)**](https://github.com/zakariaelqannaa-dv/resto-management/releases/latest/download/Mise-Setup-0.1.0.exe) | ~77 MB | **Recommended.** Installs for the current Windows user (no admin), adds Start Menu + desktop shortcuts and an uninstaller. Fast launches. |

| [**⬇ Mise Portable 0.1.0 (.exe)**](https://github.com/zakariaelqannaa-dv/resto-management/releases/latest/download/Mise-0.1.0.exe) | ~77 MB | Nothing to install — one single file. But it unpacks its payload to `%TEMP%` on **every** launch, so a cold start can take ~80 s on machines with aggressive antivirus. |



All releases: [github.com/zakariaelqannaa-dv/resto-management/releases](https://github.com/zakariaelqannaa-dv/resto-management/releases)



**Requirements:** Windows 10 or 11, 64-bit.



### Install in 30 seconds



Click the **Mise Setup** button above (it downloads `Mise-Setup-0.1.0.exe`).
2. Run the file. Windows SmartScreen may warn *"unknown publisher"* because the build is not

   code-signed — choose **More info → Run anyway**.

3. Follow the installer, then launch **Mise** from the Start Menu or the desktop shortcut.

   The first launch creates and seeds the database automatically.

4. Done. The app is fully offline from then on.



### Where your data lives



| Run mode | Database folder |

| --- | --- |

| Installed / portable `.exe` | `%APPDATA%\Mise\data` |

| `npm run dev`, `npm start` | `server/.data` (or `DATA_DIR`) |



Both desktop modes share the same `%APPDATA%\Mise\data` folder, so upgrading or reinstalling keeps

your data, and uninstalling does not delete it. The first launch seeds demo menu items, tables and

staff. To start over, close Mise, delete `%APPDATA%\Mise\data`, and open it again.



> **Only one copy can run at a time.** A single-instance lock prevents two windows from fighting

> over the same database.



---



## Quick start (from source)



```bash

npm install

npm run db:migrate     # create tables

npm run db:seed        # demo menu, tables, staff

npm run dev            # API :4000 + web :5173 in parallel

```



Open http://localhost:5173



> On Windows, run the two dev servers in separate terminals if the combined

> `npm run dev` script detaches oddly: `npm run dev:server` and `npm run dev:client`.



### One port (built app)



```bash

npm start          # builds client + server, then serves everything on :4000

```



After a build the API also serves the web app, so **http://localhost:4000** works on its own.

Until then, `:4000` shows a short landing page pointing at the Vite dev server instead of

`Cannot GET /`.



## Build the Windows app yourself



```bash

npm run desktop           # build, then open the desktop window

npm run package:win       # build installer + portable exe into release/

npm run package:portable  # build only the portable exe

```



Artifacts land in `release/`:



| File | Use it when |

| --- | --- |

| `Mise-Setup-0.1.0.exe` | **Recommended.** Regular installer (no admin needed). One-time install, Start Menu + desktop shortcuts, normal fast launches, uninstaller. |

| `Mise-0.1.0.exe` | Portable single file, nothing installed. Unpacks to `%TEMP%` on *every* launch. |



How it works: Electron starts the same Express API on a random `127.0.0.1` port, then shows the

built web app in a window. The database is embedded Postgres (PGlite) stored on disk, so the app

is fully offline.



## Positions



| Area | What it does |

| --- | --- |

| **Dashboard** | Today's open tickets, open orders, covers, paid revenue |

| **Kitchen board** | Four-column ticket board (queued → preparing → ready → served) per station |

| **Orders** | Open/edit orders, add items, fire to kitchen, settle or cancel |

| **Menu** | Categories and items, price, station, sold-out toggle |

| **Tables** | Floor map grouped by zone, click to cycle status |

| **Settings** | Kitchen code prefix and next-code preview |



## Kitchen tickets: date + code



Every ticket stores:



`business_date` — the service day the ticket belongs to
`seq` — sequence **within that day**
`ticket_code` — `PREFIX-YYMMDD-NNN`, e.g. `K-261026-007`


All three are editable from the board:



**Code** — click the code on the ticket card and type a new one.
**Date / station / status / priority / notes** — open the ticket's edit dialog.
**Items** — tick done, remove, or add a line directly on the card.


Moving a ticket to another service date re-issues its sequence automatically, so two tickets can

never share a code. Type your own code in the same dialog to override the generated one.



Sequence numbers are reserved atomically in `code_sequences` with

`INSERT … ON CONFLICT … DO UPDATE … RETURNING`, which is safe under concurrent requests and works

on both PGlite and Postgres.



## Data model



```

menu_categories 1─* menu_items

dining_tables   1─* orders 1─* order_items

orders          1─* kitchen_tickets 1─* kitchen_ticket_items

code_sequences  (scope, business_date) → last_seq

staff, inventory_items, settings

```



Order items snapshot name and price, so menu edits never rewrite history.



## API



Base URL `http://localhost:4000/api`.



| Method | Path | Purpose |

| --- | --- | --- |

| GET | `/health` | liveness |

| GET/POST | `/menu/categories` | list / create |

| PATCH/DELETE | `/menu/categories/:id` | update / delete |

| GET/POST | `/menu/items` | list (filter `categoryId`, `station`) / create |

| PATCH/DELETE | `/menu/items/:id` | update / delete |

| GET/POST | `/tables` | list / create |

| PATCH/DELETE | `/tables/:id` | update / delete |

| GET/POST | `/orders` | list (filter `date`, `status`, `open`) / create with items |

| GET/PATCH/DELETE | `/orders/:id` | read / update (`status: paid\|cancelled`) / delete |

| POST | `/orders/:id/items` | add item |

| PATCH/DELETE | `/orders/:id/items/:itemId` | update / remove pending item |

| POST | `/orders/:id/send-to-kitchen` | create one ticket per station |

| GET | `/kitchen/tickets` | filter `date`, `station`, `status`, `open` |

| POST | `/kitchen/tickets` | manual ticket with items |

| PATCH/DELETE | `/kitchen/tickets/:id` | edit any field incl. date + code / delete |

| POST | `/kitchen/tickets/:id/items` | add item |

| PATCH/DELETE | `/kitchen/tickets/:id/items/:itemId` | toggle done, edit, remove |

| GET | `/kitchen/next-code?date=` | preview next code |

| GET/PATCH | `/kitchen/settings` | prefix settings |

| GET | `/stats/today?date=` | dashboard aggregates |

| GET/POST | `/inventory` | stock list / create |

| PATCH/DELETE | `/inventory/:id` | update / delete |



## Configuration



Copy `.env.example` to `.env`:



```

DATABASE_URL=          # empty → embedded Postgres in server/.data

PORT=4000

DATA_DIR=              # optional: override the embedded database folder

```



With a real Postgres:



```

DATABASE_URL=postgres://user:password@localhost:5432/resto

npm run db:migrate && npm run db:seed

```



`npm run db:reset` only wipes the embedded database and refuses to run when `DATABASE_URL` is set.



## Layout



```

db/migrations          SQL schema, applied in filename order

desktop/main.cjs       Electron entry: starts the API, opens the window

electron-builder.yml   Windows packaging (portable + installer)

server/src

  routes               menu, tables, orders, kitchen, inventory, stats

  lib/tickets.ts       order → kitchen ticket fan-out per station

  lib/sequence.ts      day-scoped code allocation

  lib/seed.ts          first-run demo data (menu, tables, staff)

client/src

  pages/Kitchen.tsx    the ticket board

  components/ui.tsx    modal, toasts, badges, fields

```



## Not built yet



Auth and roles (manager / waiter / kitchen / cashier) — schema has `staff`, API is open
Payments and receipts
Stock deduction when items are fired
Printer / KDS device integration


## License



[MIT](LICENSE) © 2026 [Zakaria Elqannaa (zakariaelqannaa-dv)](https://github.com/zakariaelqannaa-dv)



If this project is useful to you, a ⭐ on the repo is appreciated.

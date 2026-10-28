Mise — Restaurant Management System
![Release](https://img.shields.io/github/v/release/zakariaelqannaa-dv/resto-management?style=flat-square&logo=github&label=release)
![Downloads](https://img.shields.io/github/downloads/zakariaelqannaa-dv/resto-management/total?style=flat-square&logo=github)
![Build](https://img.shields.io/github/actions/workflow/status/zakariaelqannaa-dv/resto-management/ci.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=build)
![License: MIT](https://img.shields.io/github/license/zakariaelqannaa-dv/resto-management?style=flat-square&color=22c55e)
![Windows](https://img.shields.io/badge/Windows-10%2F11%20x64-0078D6?style=flat-square&logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PGlite%20embedded-4169E1?style=flat-square&logo=postgresql&logoColor=white)
A desktop application designed for restaurant back-of-house operations. Manage menus, floor table layouts, customer orders, and interactive kitchen ticket boards in real time.
Every ticket includes a service date and a unique, day-scoped code prefix (e.g., `K-261026-007`). Built with React, Express, and PostgreSQL, running fully offline using embedded PGlite—no separate database installation required.
---
Download for Windows
Mise works completely offline without requiring Node.js or PostgreSQL installed on the target machine.
Distribution	File Size	Description
Mise Setup 0.1.0 (.exe)	~77 MB	Recommended. Installs per-user without requiring administrator privileges. Includes Start Menu shortcuts, desktop icons, and an uninstaller. Fast startup times.
Mise Portable 0.1.0 (.exe)	~77 MB	Standalone portable executable. Requires no installation, but extracts runtime dependencies to `%TEMP%` on launch (may result in slower startup times on systems with aggressive antivirus software).
System Requirements: Windows 10 or 11 (64-bit).
All Releases: GitHub Releases Page
---
Installation Instructions
Download Mise Setup (`Mise-Setup-0.1.0.exe`).
Open the file. If Windows SmartScreen displays an Unknown Publisher warning, select More info $\rightarrow$ Run anyway.
Complete the setup wizard and launch Mise from your desktop or Start Menu.
The application automatically initializes and seeds demo data on its initial run.
---
Data Storage & Persistence
Execution Mode	Database Location
Installed / Portable EXE	`%APPDATA%\Mise\data`
Development Mode (`npm run dev`)	`server/.data` (or customized via `DATA_DIR`)
> **Note:** Updating or reinstalling the desktop app preserves your existing data. To reset the environment to default settings, exit the application, delete the `%APPDATA%\Mise\data` folder, and restart. Only one instance of Mise can run at a time to prevent database lock conflicts.
---
Quick Start (Development)
Run the project locally from source:
```bash
# Install dependencies
npm install

# Run database migrations and seed initial data
npm run db:migrate
npm run db:seed

# Start development servers (API on port 4000, Vite Web on port 5173)
npm run dev
```
Navigate to `http://localhost:5173` in your browser.
> **Windows Note:** If `npm run dev` detaches unexpectedly, run the servers in separate terminals using `npm run dev:server` and `npm run dev:client`.
Production Build Server
```bash
npm start
```
Builds the client and server scripts, serving both web assets and the REST API simultaneously on `http://localhost:4000`.
---
Building Desktop Packages
Build the Electron binaries locally:
```bash
# Build web app and launch the Electron application locally
npm run desktop

# Package Windows installer (.exe) and portable executable in release/
npm run package:win

# Build only the portable executable
npm run package:portable
```
Generated artifacts are placed in the `/release` directory.
---
Application Features
```
┌─────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM MODULES                             │
├───────────────┬─────────────────────────────────────────────────────────┤
│ Dashboard     │ Live metrics: open tickets, orders, covers, and revenue │
│ Kitchen Board │ 4-stage pipeline (Queued → Preparing → Ready → Served) │
│ Order Desk    │ Create/edit orders, send to kitchen, process payments   │
│ Menu Manager  │ Categories, pricing, station routing, availability      │
│ Table Map     │ Visual floor layouts grouped by customizable zones     │
│ Settings      │ Ticket prefixes, next-code preview, server settings    │
└───────────────┴─────────────────────────────────────────────────────────┘
```
Kitchen Ticket Workflow
Every generated ticket contains three core metadata attributes:
`business_date`: The specific service day assigned to the ticket.
`seq`: Sequential counter scoped to that exact service day.
`ticket_code`: Auto-generated string formatted as `PREFIX-YYMMDD-NNN`.
Editable Ticket Properties
Ticket Code: Click directly on a ticket card's code to override it manually.
Metadata Adjustments: Update service date, station routing, status, priority level, or notes via the edit dialog.
Line Items: Add items, mark components completed, or remove entries straight from the card UI.
> Sequential code assignment uses atomic updates (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`), ensuring thread-safe generation across multi-terminal or concurrent setups.
---
Data Architecture
```
menu_categories (1) ───< (N) menu_items
dining_tables   (1) ───< (N) orders          (1) ───< (N) order_items
orders          (1) ───< (N) kitchen_tickets (1) ───< (N) kitchen_ticket_items

code_sequences  └─► (scope, business_date) ──► last_seq
system          └─► staff, inventory_items, settings
```
Order item records store snapshots of item names and prices at the moment of creation, protecting historical financial records from future menu price modifications.
---
API Reference
Base API Endpoint: `http://localhost:4000/api`
Category	Endpoint	Method	Action
System	`/health`	`GET`	Health check endpoint
Menu	`/menu/categories`	`GET` / `POST`	List all categories / create category
	`/menu/categories/:id`	`PATCH` / `DELETE`	Modify or remove category
	`/menu/items`	`GET` / `POST`	List items (supports `categoryId`, `station`) / create item
	`/menu/items/:id`	`PATCH` / `DELETE`	Modify or remove menu item
Tables	`/tables`	`GET` / `POST`	List table layouts / create table
	`/tables/:id`	`PATCH` / `DELETE`	Modify or remove table
Orders	`/orders`	`GET` / `POST`	List orders (filter by `date`, `status`) / create order
	`/orders/:id`	`GET`/`PATCH`/`DELETE`	Fetch order / update status / cancel order
	`/orders/:id/items`	`POST`	Append item to existing order
	`/orders/:id/items/:itemId`	`PATCH` / `DELETE`	Update or remove unpaid order line item
	`/orders/:id/send-to-kitchen`	`POST`	Fan-out order items to respective station tickets
Kitchen	`/kitchen/tickets`	`GET` / `POST`	Query active tickets / create manual ticket
	`/kitchen/tickets/:id`	`PATCH` / `DELETE`	Update ticket details, date, or code / delete
	`/kitchen/tickets/:id/items`	`POST`	Add line item to ticket
	`/kitchen/tickets/:id/items/:itemId`	`PATCH` / `DELETE`	Toggle completion status / remove ticket item
	`/kitchen/next-code`	`GET`	Preview upcoming code for given `?date=`
	`/kitchen/settings`	`GET` / `PATCH`	Manage ticket prefix and numbering rules
Analytics	`/stats/today`	`GET`	Fetch daily dashboard summary stats
Inventory	`/inventory`	`GET` / `POST`	List inventory items / record new stock
	`/inventory/:id`	`PATCH` / `DELETE`	Update or remove inventory record
---
Configuration
Create a `.env` file in the project root:
```env
PORT=4000
DATABASE_URL=          # Leave empty to use embedded PGlite in server/.data
DATA_DIR=              # Optional: override custom database directory
```
To connect to an external PostgreSQL instance:
```bash
DATABASE_URL=postgres://user:password@localhost:5432/resto
npm run db:migrate
npm run db:seed
```
> **Caution:** Running `npm run db:reset` strictly clears local embedded database files and is disabled when `DATABASE_URL` is set to prevent accidental production data loss.
---
Project Structure
```
├── db/
│   └── migrations/          # SQL database schema files
├── desktop/
│   └── main.cjs             # Electron entrypoint & lifecycle management
├── server/
│   └── src/
│       ├── routes/          # Express REST API endpoints
│       └── lib/
│           ├── tickets.ts   # Order fan-out logic per kitchen station
│           ├── sequence.ts  # Day-scoped ticket code generator
│           └── seed.ts      # Initial database population routines
├── client/
│   └── src/
│       ├── pages/           # Application views (Kitchen Board, Floor Plan, etc.)
│       └── components/      # Reusable UI elements (Modals, Badges, Tables)
└── electron-builder.yml     # Desktop app distribution configuration
```
---
Roadmap & Planned Features
[ ] Role-based Access Control (Manager, Waiter, Kitchen Staff, Cashier).
[ ] Native receipt printing and hardware integration (POS printers, cash drawers).
[ ] Dynamic inventory deduction upon kitchen ticket generation.
[ ] Payment gateway and split-bill processing options.
---
License
Distributed under the MIT License. See `LICENSE` for details.
Developed by Zakaria Elqannaa. If you find this project useful, consider giving it a star on GitHub!

# WAGNOVATE CEO DESK

**Lead Better. Measure Progress. Build Bigger.**
A private executive app for the CEO of WAGNOVATE Technologies: weekly CEO review, sales, customers, finance, projects, problems, lessons, strategic priorities, reports and reminders. Every number on screen is calculated from records in the database. Nothing is hardcoded.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Recharts · Framer Motion · Lucide · Prisma · PostgreSQL 16 · Argon2id auth · installable PWA.

---

## 1. Run it on your computer (Windows PowerShell)

You need: **Node.js 20+**, **pnpm**, **Docker Desktop** (for the database).

Every command below is run from the project folder:

```
D:\Projects_2026_codebase\WAGNOVATE_CEO_DESK
```

**Step 1. Install packages**
```powershell
pnpm install
```

**Step 2. Create your settings file** (only the first time)
```powershell
copy .env.example .env
pnpm secrets
```
`pnpm secrets` prints four values (`AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `SETUP_TOKEN`). Open `.env` in a text editor and paste them over the empty/placeholder lines. Keep `.env` private. It is never committed to git.

**Step 3. Start the database** (runs on port **5433**, so it does not clash with other Postgres containers)
```powershell
pnpm db:up
```

**Step 4. Create the tables and the starting records**
```powershell
pnpm db:deploy
pnpm db:seed
```
`db:seed` creates only the company/settings rows and the four starting products (WAG SMS, WAG POS, Internal Business Projects, Client Projects). No customers, no money, no users.

**Step 5. Start the app**
```powershell
pnpm dev
```
Open **http://localhost:3000**.

### First-time admin setup
1. Open http://localhost:3000. With no account yet it sends you to **/setup**.
2. Type the **setup token** (the `SETUP_TOKEN` line from your `.env`), your name, email and a strong password (10+ characters with upper-case, lower-case and a number).
3. You are signed in. `/setup` now refuses to work again; there is no public registration page.
4. Go to **Settings**: upload your **company logo**, set your **revenue targets** (so "Achievement vs Target" can work), choose your reminder time, and press **Enable notifications on this device**.

### Optional: try it with demo data
```powershell
pnpm db:demo
```
Adds **fictional** customers, invoices, payments, leads and so on so you can see every screen filled in. Remove it with `pnpm db:demo -- --wipe` (this deletes ALL business records, development only). Never run it on your real data.

### Forgot your password
Click "Forgot your password?" on the login page. A reset link is emailed if SMTP is set in `.env`; **otherwise the link is printed in the terminal running `pnpm dev`**. Emergency reset on the server: `pnpm admin:reset-password you@example.com`.

---

## 2. What is where

| Menu | What it does |
|---|---|
| Overview | Command-center dashboard: KPIs with year-over-year arrows, achievement vs target, revenue by product, delivery days, customer globe (click a marker to drill down), top customers, live alerts, collections chart, CEO action centre, current priority, next review |
| Weekly CEO Review | Guided 7-step review (drafts auto-save), summary, completion, history, PDF/print report |
| Engineering & Products | Achievements and projects (milestones, tasks, income/expenses, documents) |
| Sales & Contracts | Pipeline board (8 stages), opportunities, contract register with expiry badges and documents |
| Customers & Feedback | Customer profiles, feedback, satisfaction analytics |
| Finance | Overview by period, transactions (receipts, CSV/PDF), invoices (record payment) |
| Problems & Lessons | Problem tracker and searchable lessons library |
| Strategic Priorities | One primary priority per week, completion rate, tasks (list and calendar) |
| Reports & Analytics | 10 reports, period comparison, PDF/CSV export, print |
| Settings | Company + logo, profile, password, theme, reminders, notifications, targets, AI, export/backup |

Money rules built in: a payment cannot exceed its invoice balance; an invoice cannot be edited below what is already paid; deleted records are hidden from every total automatically (soft delete); net cash flow is never called profit; percentages are shown only when the previous period is non-zero.

---

## 3. Reminders and notifications

* The **server** sends reminders (a scheduler runs inside the app every 5 minutes, protected by a database lock so it never runs twice, and every reminder has a unique key so it can never be duplicated). It does not need a browser tab to be open.
* Weekly review reminder: default **Sunday 6:00 PM Africa/Accra** (change in Settings).
* Also: task deadlines/overdue, follow-ups, overdue invoices, critical problems, priority deadlines, contract expiry.
* **In-app** (bell and Notifications page) always works. **Browser notifications** need you to press the button in Settings and say yes; if you say no, in-app reminders still work.
* **Notifications when the app is closed (push)** need VAPID keys: run `pnpm vapid`, paste the two lines into `.env`, restart.
* Optional external cron instead of the built-in scheduler: `POST /api/cron/reminders` with header `x-cron-secret: <CRON_SECRET>`.

## 4. AI executive summary

Settings → **AI summary**: choose Anthropic or OpenAI (or a compatible base URL), paste a key. The key is encrypted in the database (AES-256-GCM, needs `ENCRYPTION_KEY`) and never sent back to the browser. With no key, or if the AI call fails, a built-in **rule-based writer** produces the summary from the same facts. Both only use recorded data and say "not recorded" where data is missing.

## 5. Backups

```powershell
pnpm db:backup                          # writes backups\ceo-desk-YYYY-MM-DD-HH-MM.sql
pnpm db:restore backups\<file>.sql      # asks you to type RESTORE first
```
Also copy the `storage\uploads` folder (logo, receipts, contracts). Keep copies off this computer. Settings → Data also downloads a full JSON export. Restoring from inside the web app is deliberately not offered.

## 6. Deploying to a server

The project is ready for **Render** (Frankfurt) at https://ceo.wagnovate.com. See **[DEPLOY.md](DEPLOY.md)** for the step-by-step guide and `render.yaml` for the Blueprint (web service + persistent disk + PostgreSQL + reminder cron job).

## 7. Security notes

Argon2id passwords · random server-side sessions (HTTP-only, SameSite cookies, 14 days) · 5 wrong passwords lock the account 15 minutes · rate limits on login/setup/reset · same-origin check on every change · every API route re-checks the session on the server · all input validated with zod · uploads checked by file content, stored outside `public/`, served only to signed-in users · AI key encrypted · security headers · no public registration. The database is designed for later staff accounts (`Role` on `User`) but only the owner account exists today; role-based permissions are **not** implemented yet.

## 8. Commands

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run / build / run production |
| `pnpm check` | Typecheck + tests |
| `pnpm db:up` · `db:deploy` · `db:seed` | Database container · migrations · starting records |
| `pnpm db:demo` | Optional fictional demo data |
| `pnpm db:backup` · `db:restore` | Backup / restore |
| `pnpm secrets` · `pnpm vapid` | Generate secrets / push keys |
| `pnpm admin:reset-password <email>` | Emergency password reset |

---

## 9. What was tested, and what was not (honest report)

**Automated: 23 unit tests pass** (`pnpm test`): percentage validity (zero/missing previous values), money rounding, Accra weeks and ranges, review schedule and "overdue" logic, globe geocoding, form/field validation, summary writer never inventing numbers, review completion rules, CSV escaping.

**Checked by hand against the running app (real PostgreSQL):** first-time setup and sign-in; login failure message; unauthenticated API/page access blocked (401/redirect); forged-origin request blocked (403); cron endpoint rejects missing/wrong secret; invoice auto-numbering; payment larger than balance rejected; invoice cannot be lowered below paid amount; invoice with payments cannot be deleted; deleting a payment restores the balance; customer with history cannot be deleted; transaction category/type mismatch rejected; date-range filtering; one-priority-per-week enforced; tasks overdue/complete; **review flow**: draft save, completion blocked until last priority assessed, complete, idempotent second completion, immutability after completion, frozen report, PDF generated (valid `%PDF`), reflections saved to lessons; reminders created once and **not duplicated** on repeat runs; uploads rejected for fake PNG, SVG, EXE and oversize files; no horizontal overflow at 375 px on every page (after fixing a real overflow bug found during testing); production `pnpm build` succeeds; backup script produces a dump.

**Not tested / limitations (be aware):**
* No Playwright/browser end-to-end suite; the checks above were manual and API-level.
* The browser notification permission prompt, **real push delivery**, and PWA installation were **not** exercised (they need HTTPS/VAPID keys and a real device). Code is in place; verify on your phone after deploying.
* **AI summaries were not run against a real provider** (no key). The rule-based path is tested; the API calls follow the providers' documented formats but are unverified.
* **Email** (password reset) was not sent through a real SMTP server; the console fallback is what ran.
* Visual QA was done at desktop and a 375 px phone width in dark mode. Light theme, tablet width, iPhone Safari and Android Chrome were **not** individually checked.
* **Offline**: the app shows an offline banner and a fallback page, and refuses to claim anything saved while offline. There is **no offline data entry queue**; that was a deliberate choice rather than a half-working one.
* The globe places customers using a built-in list of ~100 cities and countries. Locations it does not know are counted as "Not plotted" rather than guessed.
* The "Year-over-year" arrows show "n/a" when there is no prior-year data. Active-customer YoY is an approximation based on "customer since" dates.
* PDF reports are plain, branded and print-ready but not heavily designed. Recharts charts are not included inside the PDFs (their data tables are).
* Role-based staff permissions are designed for (schema) but not built.
* Restore is command-line only, by design.
* The PWA icon is a generic "W" mark. Your uploaded company logo is used inside the app and on PDFs, but replacing the installable-app icon files in `public/icons` needs a manual step.

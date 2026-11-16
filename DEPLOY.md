# Putting WAGNOVATE CEO DESK online (Render + https://ceo.wagnovate.com)

This guide takes you from "it runs on my computer" to "it is live at https://ceo.wagnovate.com". Go in order. Nothing here needs you to write code.

**What you will end up with** (all in Render's Frankfurt region):

| Piece | What it is | Approx. cost* |
|---|---|---|
| Web service `wagnovate-ceo-desk` | The app itself (Starter plan) | about US$7 / month |
| PostgreSQL `ceo-desk-db` | Your database (Basic plan, not the free one that expires) | about US$6 / month |
| Persistent disk (1 GB) | Where your logo, receipts and contract files live | about US$0.25 / month |
| Cron job `ceo-desk-reminders` | Wakes the app every 5 minutes to send reminders | about US$1 / month minimum |

\*Prices change. Check Render's pricing page before you press the button.

> **Words you will see.** *Repository* = your project stored on GitHub. *Blueprint* = a file (`render.yaml`) that tells Render what to build. *Environment variable* = a setting or secret typed into Render, not into the code. *DNS* = the internet's address book, managed where you bought `wagnovate.com`.

---

## 1. Before you start

You need:
* A **GitHub** account and **Git** installed on your computer.
* A **Render** account (https://render.com). Add a payment card.
* Access to the **DNS settings of wagnovate.com** (wherever you bought the domain: Namecheap, GoDaddy, Cloudflare and so on).
* A password manager (or a safe notebook) to store the secrets below.

Everything you type below is run in **PowerShell**, from this folder:

```
D:\Projects_2026_codebase\WAGNOVATE_CEO_DESK
```

---

## 2. Make your production secrets

Production must use **brand-new** secrets. Never reuse the ones from your computer.

```powershell
pnpm secrets
pnpm vapid
```

`pnpm secrets` prints four lines: `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `SETUP_TOKEN`.
`pnpm vapid` prints two lines: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (these let the server send notifications to your phone).

**Copy all six lines into your password manager now.** You will paste them into Render in step 5. Do not put them in a file inside the project, in an email, or in a chat.

> Keep `ENCRYPTION_KEY` and the VAPID pair forever. If you lose `ENCRYPTION_KEY` you only have to type your AI key again in Settings. If you replace the VAPID pair, every phone must tap "Enable notifications" again.

---

## 3. Put the code on a PRIVATE GitHub repository

**3.1 Create the empty repository**
1. Go to https://github.com/new
2. Repository name: `wagnovate-ceo-desk`
3. Choose **Private** (very important: this is your business software).
4. Do **not** tick "Add a README", ".gitignore" or a license. Click **Create repository**.

**3.2 Check that no secret is about to be uploaded** (it should print only `.env.example`, which has no real values):
```powershell
git ls-files | findstr /i "\.env"
```
If you see `.env` (without `.example`) in that list, **stop** and ask for help.

**3.3 Connect and push.** Replace `YOUR-GITHUB-NAME` with your GitHub username:
```powershell
git remote add origin https://github.com/YOUR-GITHUB-NAME/wagnovate-ceo-desk.git
git branch -M main
git push -u origin main
```
GitHub may open a browser window asking you to sign in. Afterwards, refresh the repository page: you should see your files, and a lock icon / "Private" label near the name.

---

## 4. Create the Blueprint on Render

1. In Render, click **New +** then **Blueprint**.
2. Click **Connect GitHub** and allow Render to see **only** the `wagnovate-ceo-desk` repository.
3. Pick the repository and the branch `main`. Render reads `render.yaml` and lists what it will create: one web service, one database, one cron job.
4. Render asks you to fill in the secret values (the ones marked `sync: false`). Go to step 5.

---

## 5. Enter the secret values

Paste each value from your password manager. **One value per box, no quotes, no spaces at the ends.**

| Name | What to enter |
|---|---|
| `AUTH_SECRET` | the `AUTH_SECRET` line from `pnpm secrets` (the part inside the quotes) |
| `SETUP_TOKEN` | the `SETUP_TOKEN` value |
| `CRON_SECRET` | the `CRON_SECRET` value (the cron job copies it automatically) |
| `ENCRYPTION_KEY` | the `ENCRYPTION_KEY` value (64 characters) |
| `VAPID_PUBLIC_KEY` | from `pnpm vapid` |
| `VAPID_PRIVATE_KEY` | from `pnpm vapid` |
| `AI_API_KEY` | optional. Leave a key here if you use Claude/OpenAI summaries, otherwise type the word `none`. You can also save an AI key later in Settings. |

Then click **Apply** / **Create**. Render builds the app (about 3 to 8 minutes). Watch the **Logs** tab of the web service.

**What the app checks when it starts.** If a secret is missing or too weak, the app refuses to start and the log says exactly which setting is wrong, for example `AUTH_SECRET: must be at least 32 characters`. Fix that value in **Environment** and Render redeploys. The log never shows the secret itself.

**If Render complains about the cron job's `CRON_SECRET`** (it copies it from the web service): open the cron job, then **Environment**, and add `CRON_SECRET` yourself with the same value.

---

## 6. Check that it is alive

In the Render dashboard open the web service. At the top you will see its temporary address, something like `https://wagnovate-ceo-desk-xxxx.onrender.com`. Open it with `/api/health` on the end:

```
https://wagnovate-ceo-desk-xxxx.onrender.com/api/health
```

You should see `{"ok":true}`. That means the app is running and can reach the database.

> **Important: do not sign in on the `onrender.com` address.** For your safety the app only accepts sign-ins and changes coming from `https://ceo.wagnovate.com` (this blocks forged requests from other websites). On the temporary address the login would be refused. Finish steps 7 and 8 first.

---

## 7. Add your domain in Render

1. Web service, then **Settings**, then **Custom Domains**, then **Add Custom Domain**.
2. Type `ceo.wagnovate.com` and save.
3. Render now shows what DNS record it expects. It will be the service's own address, for example `wagnovate-ceo-desk-xxxx.onrender.com`. **Copy exactly what Render shows.**

## 8. Add the DNS record

Log in to wherever `wagnovate.com`'s DNS is managed and add **one** record:

| Field | Value |
|---|---|
| **Type** | `CNAME` |
| **Name / Host** | `ceo` (some providers want the full `ceo.wagnovate.com`) |
| **Value / Target / Points to** | your service address from Render, e.g. `wagnovate-ceo-desk-xxxx.onrender.com` (no `https://`, no trailing slash) |
| **TTL** | Automatic, or 300 |

Notes:
* If a record for `ceo` already exists (an A, AAAA or CNAME), **delete it first**, because a name can only have one.
* If you use **Cloudflare**, set this record to **DNS only** (grey cloud), at least until the certificate is issued. If you later turn the orange proxy on, set SSL mode to **Full (strict)** and add the environment variable `TRUST_PROXY_HOPS` = `2` to the web service.
* Do not touch your other records (`@`, `www`, email `MX` records and so on).

## 9. Wait for the HTTPS certificate

Back in Render, on the custom domain, click **Verify**. Render checks the DNS record and then issues a free HTTPS certificate by itself.
* Usually this takes **a few minutes**, sometimes up to an hour. Rarely, DNS takes a day to spread across the internet.
* The status changes to **Verified** / **Certificate issued**.
* Then open https://ceo.wagnovate.com/api/health. When you see `{"ok":true}` with a padlock in the browser, you are live.

---

## 10. First-time setup (create your CEO account)

1. Open **https://ceo.wagnovate.com**. It sends you to the setup page.
2. Enter the **setup token** (`SETUP_TOKEN` from your password manager), your name, your email and a strong password (10 or more characters with upper-case, lower-case and a number).
3. You are signed in. The setup page now refuses to work again, and nobody can register.
4. Open **Settings** and:
   * upload your **company logo**
   * set your **revenue targets**
   * set the **weekly review time** (default Sunday 6:00 PM Accra)
   * press **Enable notifications on this device** and tap Allow
5. **Install it as an app.** On a computer, Chrome shows "Open in app / Install" at the right of the address bar. On Android, Chrome menu then **Install app**. On iPhone (Safari), Share then **Add to Home Screen**; open it from the Home Screen icon and enable notifications from there.
6. Check reminders work: Settings, **Notifications**, then **Send a test**. In Render, open the cron job: its **Runs / Logs** should show a new run every 5 minutes and no failures.

---

## 11. Your first backup (do this today)

You have three separate safety nets. Use all three.

**A. Database backups made by Render.** Render, then your database `ceo-desk-db`, then **Recovery** (the page name may differ slightly). Check that automatic backups are listed, and note how many days they are kept for your plan. Click the button to **create a manual export / backup** and **download** it. Store the file somewhere off the server (an encrypted USB drive or private cloud folder).

**B. A copy of your data you can read.** In the app: **Settings, Data & security, Download export**. This gives you a JSON file of every record. Passwords and keys are never in it. Keep it with the backup above.

**C. Your uploaded files.** Logo, receipts and contracts are on the 1 GB disk. Render keeps automatic **daily disk snapshots** (see the disk's **Snapshots** tab). They are also covered by exports only as file *names*, so rely on the snapshots, and download important contracts occasionally.

Make a habit: after every month-end, download A and B.

---

## 12. How to restore

> Practise this once on a test database before you ever need it for real.

**Restore the database to an earlier moment (most common)**
1. Render, database `ceo-desk-db`, **Recovery**. Choose **Restore** from a backup or point in time. Render creates a **new** database containing the older data (your current one is not overwritten).
2. Open the web service, **Environment**, and change `DATABASE_URL` so it points at the new database (use the **Internal Database URL** shown on the new database's page). Save. The service redeploys.
3. Open the app and check your data. When you are happy, you can delete the old database.

**Restore from a downloaded export file (`.sql`)**
1. On the database page, temporarily allow your computer's IP under **Access Control** (the database is private by default), and copy the **External Database URL**.
2. From a computer that has PostgreSQL tools (`psql`):
   ```
   psql "PASTE-EXTERNAL-URL-HERE" -f ceo-desk-backup.sql
   ```
3. Remove your IP from Access Control again.

**Restore files** (a lost logo or contract): web service's disk, **Snapshots**, then **Restore** the snapshot you want.

The JSON export from the app is a safety copy you can read and keep. It is **not** an in-app "restore" button on purpose: replacing live business records from a web page is too risky.

---

## 13. Everyday life after launch

* **Updating the app:** push new code to GitHub `main`. Render rebuilds and redeploys by itself. Database changes are applied automatically when the app starts, and they only ever *add* things; they never delete financial records.
* **Forgot your password:** use "Forgot your password?" if you later set up email (add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in Environment). Without email, open the web service's **Shell** tab in Render and run:
  ```
  pnpm admin:reset-password you@example.com
  ```
* **Rotating a secret:** change it in **Environment**; Render redeploys. Changing `AUTH_SECRET` signs everyone out. Changing `CRON_SECRET` means also changing it on the cron job if you added it manually.
* **Brief downtime on deploy:** a service with a disk restarts when you deploy (usually under a minute). That is normal.
* **One instance only:** a disk can only be attached to one copy of the app, which suits a single-owner tool.

---

## 14. If something goes wrong

| Symptom | Likely cause and fix |
|---|---|
| Deploy fails, log says `The app cannot start because of these settings` | A secret is missing or too short. The log names which one. Fix it in **Environment**. |
| `/api/health` shows an error or the deploy never turns green | Open **Logs**. If it mentions the database, check that `DATABASE_URL` still says it comes from `ceo-desk-db`. |
| Sign-in does nothing or says "blocked" | You are on the `onrender.com` address, or `APP_URL` is not exactly `https://ceo.wagnovate.com` (no trailing slash). Use the real domain. |
| Certificate stays "pending" | The CNAME is wrong or still spreading. Re-check step 8 (and that there is no conflicting record or orange Cloudflare cloud). Click **Verify** again later. |
| Reminders never arrive | Check the cron job's **Runs**. If they fail with `401`, the cron job's `CRON_SECRET` differs from the web service's. If they fail to connect, the domain is not live yet. |
| Notifications never reach the phone | Settings, **Notifications**: it must say push is configured. Then tap **Enable notifications on this device** on that phone. iPhone needs the Home Screen app. |
| Logo or uploads disappear after a deploy | The disk is not mounted. Check that `UPLOAD_DIR` is `/var/data/uploads` and the disk shows as attached. |

---

## 15. What is protected, in plain words

* Only the address `https://ceo.wagnovate.com` can make changes. Forged requests from other sites are rejected.
* Cookies are HTTPS-only, hidden from scripts, and expire after 14 days.
* Five wrong passwords lock the account for 15 minutes. Sign-in, setup and reset attempts are rate-limited per visitor.
* HTTPS is enforced by the browser for a year (HSTS). Pages cannot be put inside other sites, and the browser only runs the app's own scripts.
* Passwords are stored as Argon2id hashes. Login sessions are stored as keyed hashes. Your saved AI key is encrypted.
* Server logs never contain passwords, reset links, request bodies, cookies or keys.
* The demo-data script refuses to run in production, and the server never loads demo data.

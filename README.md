# Core Architect — Phase 1 (Foundation: Auth + Database)

This is Phase 1 of 4. It sets up:
- Supabase project schema (tables + row-level security)
- Email/password signup & login (session persists — no repeated password prompts)
- A protected `/dashboard` route (currently a stub — the real timer/roadmap
  engine arrives in Phase 2)

Full plan lives in `PROJECT_MASTER_BLUEPRINT_v2.0.md`.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Once it's created, open **SQL Editor** → New query.
3. Paste the entire contents of `supabase/schema.sql` and run it.
   This creates all tables, the auto-profile trigger, and RLS policies.
4. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Paste your Project URL and anon key into `.env.local`.

> By default, Supabase requires email confirmation before a session starts.
> For local testing you can turn this off under
> **Authentication → Providers → Email → Confirm email** (toggle off), or
> just click the confirmation link Supabase emails you.

## 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/login`. Create an account,
confirm the email if required, and you'll be redirected to `/dashboard`.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Phase 1: auth + schema"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## 5. Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Add the same two environment variables from `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) under
   **Project Settings → Environment Variables**.
3. Deploy. Vercel auto-detects Next.js — no extra config needed.

## What's next

- **Phase 2:** roadmap loader + live timer engine + Main Task / Sub-task
  rendering with linear auto-advance.
- **Phase 3:** liquid-fill visuals for the daily indicator, Main Task boxes,
  and the streak heatmap.
- **Phase 4:** weekly catch-up rule + final polish.

The `main_tasks` / `sub_tasks` tables already match the roadmap data shape
defined in the blueprint (§0), so when the roadmap file is ready, Phase 2
just needs a loader that writes rows into these tables — no schema changes.

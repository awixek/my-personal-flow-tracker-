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

## Phase 2 (this update): the timer engine

No new Supabase setup needed — Phase 1's tables already matched the shape
this needed. What's new in the code:

- **`lib/roadmap/roadmap.json`** — RealPathFlow, baked into the app.
- **`lib/roadmap/generate-today.ts`** — on each dashboard load, checks if
  today's `main_tasks`/`sub_tasks` rows already exist for the signed-in
  user; if not, expands the roadmap template for today's day-of-week +
  active phase and inserts them. Never overwrites a day that's already
  been generated.
- **`lib/roadmap/phase.ts`** — resolves which of the 4 phases is "active"
  from how many months have passed since `profiles.roadmap_start_date`
  (set automatically on your very first dashboard visit).
- **`lib/audio.ts`** — the sub-task completion beep, synthesized in the
  browser (no sound file to host).
- **`app/dashboard/dashboard-client.tsx`** — the live engine: Start/Pause,
  the persistent top timer bar, per-sub-task live clocks, linear
  auto-advance with the "take a break / let it continue" prompt, and the
  Main Task boxes sized by `time_share` and filling in as they complete.

### Known gaps, on purpose (call these out if you want them handled next)

- **Exam weeks** are not wired up yet — the `quiz-prep` sub-task (IITM
  Coursework) never activates automatically. It needs either a manual
  toggle in the UI or real term-exam dates to schedule against.
- **Phase boundaries** are estimated from elapsed months
  (`lib/roadmap/phase.ts`) since the roadmap only gave year ranges, not
  exact dates — Phase 3 and 4 nominally overlap in the brief ("Yr 3–4.5"
  vs "Yr 4–4.5"), so Phase 4 is currently treated as just the final 6
  months. Adjust the boundaries there if the real term calendar differs.
- **Data Science / ML's "Month 6" start** and its Phase-2-only Kaggle
  gating from the roadmap notes aren't enforced yet — it currently runs
  from day one. Say the word if you want that gate added.
- Multiple browser tabs/devices running a timer at once isn't guarded
  against — only one session should be open at a time in normal use.

## Phase 3 (this update): the streak heatmap

- **`app/profile/page.tsx`** — new route. Shows the header
  `Total progress from DD/MM/YYYY is X hours` and a GitHub-style
  contribution grid where **each box is a liquid-fill vessel**, not a
  color-density square — fill height = that day's completion % (time
  completed ÷ time planned that day).
- **`lib/roadmap/heatmap.ts`** — pure function that turns
  `roadmap_start_date` + today + a date->totals map into the week/day grid.
  No box renders before the roadmap's start date or after today. A date
  with no recorded activity (you never opened the app that day) defaults
  to an empty 0% box, not a missing one — matching the "gap days render
  empty" rule.
- Added a **Profile** link on the dashboard (next to Sign out) to reach it.
- The daily liquid indicator (top-right) and Main Task box fills were
  already live from Phase 2 — nothing changed there.

No new Supabase setup needed here either — the heatmap is computed from
the same `main_tasks`/`sub_tasks` rows that already exist.

## Bugfix (this update): timer not surviving a refresh

`handleStart` was writing the timer's start to Supabase but never checking
whether that write actually succeeded — if it silently failed, the UI kept
showing a running timer anyway (computed only in the browser), so a refresh
pulled fresh data from the database, found nothing saved, and the sub-task
appeared to reset to 00:00. Now: the insert's `userId` comes from a stable
prop instead of a fresh `getUser()` call each time, and if the write fails
you get an alert instead of a timer that quietly isn't being saved.

On the heatmap: it reads only `completed_seconds`, which is written when a
sub-task is **paused or completes** — not continuously while it's running.
That's expected, not a bug — a box on `/profile` fills in once you pause or
finish a sub-task, not while the clock is actively counting up.

## Roadmap restructure: qualifier prep + delayed IITM start

- **RealPathFlow's 4 Main Tasks** (IITM Coursework, DSA & Systems,
  Data Science/ML, Portfolio & Community) now carry
  `starts_on: "2026-09-27"` — they won't appear at all before then.
- **Japanese Learning** moved up from `2026-09-27` to `2026-09-07` — it
  now starts immediately, running alongside qualifier prep and then
  continuing straight through into the RealPathFlow era with no gap.
- **New: Qualifier Exam Prep**, a temporary 6th Main Task —
  `2026-09-07` through `2026-09-26` only (20 days), 2 hours/day, one
  subject per day: English gets the first 3 days, the remaining 17 days
  rotate Maths / Statistics / Computational Thinking round-robin (17
  doesn't split evenly into 3 — Maths and Statistics land on 6 days each,
  Computational Thinking on 5). It uses a new schedule type,
  **`date_map`** (a fixed calendar date -> sub-tasks lookup, alongside
  the existing `daily` and `weekly_pattern` types) — see
  `lib/roadmap/types.ts` / `generate-today.ts`. It has no explicit end
  date because the date map simply has no entries past 2026-09-26, so it
  stops appearing on its own.
- **New: `phase_reference_start`** (`"2026-09-27"`) at the top of
  `roadmap.json` — RealPathFlow's phase/month-elapsed math (which drives
  `ds_month6`, `phase_gte_2`, and weekly-contest gating) now anchors on
  this date instead of `profiles.roadmap_start_date`, since the IITM
  journey genuinely begins on the 27th regardless of when you first
  opened the dashboard.

**If you already opened the dashboard today (or any day from today
onward) before this update deployed**, today's tasks were generated
under the *old* schedule and won't automatically switch — Phase 2's
day-generation is intentionally idempotent (never regenerates a day that
already exists). Run `supabase/optional_reset_today.sql` (fill in your
user id first) to clear those rows so today regenerates under the new
plan. Skip it entirely if you haven't opened the dashboard today yet.

## What's next

Nothing planned — Phase 4 (below) closes out the original blueprint. Future
additions are whatever you want next.

## Phase 4: catch-up rule, exam week, DS/ML gating, and a real notification

**Run `supabase/phase4_migration.sql` in the Supabase SQL Editor first** —
this update needs two new columns (`profiles.exam_week`,
`catch_up_log.active_started_at`) and a uniqueness constraint that
`schema.sql` didn't have.

### Catch-up rule (§9)
- **`lib/roadmap/catchup.ts`** — on every dashboard load: locks any
  shortfall left over from a previous week, backfills a shortfall row for
  any past day this week that fell short of its own planned time, and
  returns the oldest unresolved one (FIFO).
- The catch-up panel only appears once **today's own tasks are already
  100% done** — it's extra time on top of today, not a replacement for it.
- Its own Start/Pause timer works like a sub-task's, and resumes correctly
  across a refresh (progress lives on the `catch_up_log` row itself).
- Once a week rolls over, whatever wasn't caught up is permanently locked
  — the panel simply won't offer it anymore.
- The streak heatmap (`/profile`) now folds resolved catch-up time back
  into the **original shortfall day's** box, so making up a missed day
  visibly fills in that day's box, not today's.

### Exam week toggle
- A checkbox on the dashboard flips `profiles.exam_week`. While on, newly
  generated days include the `quiz-prep` sub-task on IITM Coursework.
- Since day-generation is idempotent (each day is only ever generated
  once), toggling this only affects **days not yet generated** — turn it
  on before the exam week actually starts, not mid-week.

### Data Science/ML gating
- Weekday light-review now only appears from **month 6** onward
  (`active_only_if: "ds_month6"` in `roadmap.json`).
- Weekend Kaggle blocks now only appear once **Phase 2** is active
  (`active_only_if: "phase_gte_2"`).
- Both are enforced in `generate-today.ts`, not just noted in comments.

### Real notification (PWA)
- **`public/manifest.json` + `public/sw.js` + `lib/notifications.ts`** —
  the app is now installable ("Add to Home Screen"), and starting a timer
  requests notification permission and shows a persistent notification
  with a **Pause** action button. Tapping it pauses the timer even if the
  app isn't the focused tab.
- **Be realistic about this one:** there's no true background execution
  on the web, so this only works while the browser/PWA process is still
  alive in the background — reliable on **Android Chrome**, especially
  once installed to the home screen. **iOS Safari's support is much more
  limited** by Apple's own platform restrictions (notifications need iOS
  16.4+, the app installed to the home screen, and even then background
  behavior is far less reliable than Android). This is a real improvement
  over the in-app-only bar from Phase 2, not a guaranteed always-on native
  notification.

## Added: Japanese Learning track (5th parallel Main Task)

- New Main Task `japanese-learning` in `lib/roadmap/roadmap.json`, gated
  with `starts_on: "2026-09-27"` — it won't appear on the dashboard at all
  before that date, then appears automatically with no manual step needed.
- 2 linear sub-tasks: a 25-min study block (video/app lesson) then a 10-min
  review block (flashcards/notes) — 35 min/day total, inside the stated
  30-40 min budget.
- Runs independently of RealPathFlow's phase system — it's a flat daily
  block regardless of which IITM phase is active; content progression
  (scripts -> N5 -> N4 -> N3) is up to you and isn't tracked task-by-task.
- **New engine capability added to support this:** any Main Task can now
  carry a `starts_on` date in the roadmap file (see
  `lib/roadmap/types.ts` / `generate-today.ts`) — useful for adding future
  tracks without touching engine code again.

## Known gap raised separately (not part of any phase yet)

A **real OS-level notification** (status bar, works even with the app
closed, Start/Pause from the notification itself) is a different feature
from the in-app persistent timer bar built in Phase 2 — it needs a PWA +
service worker setup and behaves differently on Android vs iOS. Flagged
for a separate pass whenever you want to tackle it.

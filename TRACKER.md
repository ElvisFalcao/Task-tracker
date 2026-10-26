---
name: Task-tracker
category: Regency
client:
type:
stage: Live
tools: [Supabase, GitHub Pages]
started: 2026-10-21
updated: 2026-10-26
target:
live: https://elvisfalcao.github.io/Task-tracker/
repo: https://github.com/ElvisFalcao/Task-tracker
plan:
---

## Summary
A personal workload tracker for Elvis: tasks with priorities, due dates and reminders, time tracking, and invoices. Plain HTML/CSS/JS on GitHub Pages. Optional cloud sync (Supabase) keeps every device in step and lets Claude add tasks from any chat.

## Definition of Done
What does "100% ready to ship, sell or present" mean for this project?

### Build
- [ ] Core features working
- [x] Cloud sync built: tasks, time entries and settings; device link; offline-safe (tested against a simulated server, 33 checks)
- [ ] Cloud sync verified on the live site in Edge (work profile) against the real Supabase project
- [ ] A second device connected with the sync link
- [ ] Claude adds a task from a chat and it appears in the app

### Ship
- [x] Deployed or delivered
- [ ] Shown to the people it's for

## Next up
- In Edge (work profile), open the live app → Settings → Sync → **Turn on sync**. Then check rows arrived: `select kind, count(*) from public.items group by kind;` in Supabase project `task-tracker` (ref `zvddhovhrfsllagujifn`).
- Add a test task from a chat (SQL in README, "Adding tasks from outside the app") and confirm it appears within a minute.
- Connect the phone: Settings → Sync → **Copy link for another device**, open it on the phone.
- If the work network blocks `*.supabase.co`, sync shows "Couldn't reach the sync server"; tasks keep working locally.

## Log
- 2026-10-26 · Claude Code · Added optional cloud sync (Settings → Sync) backed by a new Supabase project `task-tracker`; documented how to add tasks from outside the app.
- 2026-10-21 · Room · Tracking started from the dashboard.

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
- [x] Cloud sync verified on the live site in Edge (work profile) against the real Supabase project (36 tasks, 16 time entries and settings arrived 2026-10-26)
- [ ] A second device connected with the sync link
- [ ] Claude adds a task from a chat and it appears in the app

### Ship
- [x] Deployed or delivered
- [ ] Shown to the people it's for

## Next up
- Confirm the test task `c-20261026-0814-1` ("Test from Claude: tick me off or delete me") reached Edge. When the app picks it up, it sends back a filled-in copy, so `select data ? 'createdAt' from public.items where id = 'c-20261026-0814-1';` returns true. Then tick the last Build item.
- Connect the phone: Settings → Sync → **Copy link for another device**, open it on the phone.
- Sync runs while the tab is visible (on open, on return, every minute). A hidden or sleeping tab catches up when it's next viewed.

## Log
- 2026-10-26 · Claude Code · Sync turned on in Edge and verified against Supabase; test task added from a chat.
- 2026-10-26 · Claude Code · Added optional cloud sync (Settings → Sync) backed by a new Supabase project `task-tracker`; documented how to add tasks from outside the app.
- 2026-10-21 · Room · Tracking started from the dashboard.

# Workload Tracker

A simple personal app for managing your workload: tasks, priorities, reminders, time tracking and invoices.
It is plain HTML, CSS and JavaScript, so there is nothing to install or build.

Live at **https://elvisfalcao.github.io/Task-tracker/** (the capital T matters).

## How to use it

Open `index.html` in your browser, or use the live link above. The left sidebar has four pages: **Tasks**, **Time log**, **Invoice** and **Settings**. On a phone, the sidebar is behind the menu button at the top left.

### Tasks
- **New task** opens a side panel. Each task has a **priority** (High / Medium / Low), and can also have a **due date and time**, a **reminder**, a **client or project**, an **estimate** and a **Billable** tick.
- Quick buttons set common dates in one click: **Today / Tomorrow / This Friday / Next Monday** for the due date, and **In 1 hour / Today 6 PM / Tomorrow 9 AM / 1 hour before due** for the reminder.
- If you close the panel before saving, your draft is kept and restored next time.
- Views:
  - **Today**: overdue tasks, tasks due today, and High-priority tasks with no date
  - **This week**: tasks due in the next 7 days
  - **All open**
  - **Done**
- Tasks are **sorted by what to do next**. The order combines how important a task is with how close its due date is, so overdue and soon-due work moves up the list. The first one is labelled **Up next**.
- **Search** (press `/` to jump to it) and **Filters** (priority, client, billable) narrow the list. Click a column heading to sort by it, and click **Use suggested order** to go back.
- Click a task to edit it, add it to your calendar, or delete it. Tick the box to mark it done. Every change has an **Undo** in the message that appears.

### Time tracking
- Press **▶** on a task to start its timer. The running timer shows in the sidebar (or the top bar on a phone) and in the browser tab. Only one timer runs at a time, and the timer keeps going if you close or reload the page.
- Each task shows the time you've tracked against its estimate, in orange when you go over it.
- **Time log** lists your time by day, with today's, this week's and not-yet-invoiced totals at the top. Click an entry to edit or delete it. **Add time** logs time you've already spent, either as a start and end time or as a number of minutes.
- The download button exports the time log as a CSV file for a spreadsheet.

### Reminders
- Under **Settings → Reminders**, choose **Turn on notifications**. You'll then get a browser notification and an in-app message at each task's reminder time, as long as the app is open (a pinned tab works well).
- When you open the app, it tells you how many tasks are due today or overdue.
- **Add to calendar** (open a task) downloads a `.ics` event with an alarm. Open the file to add the task to Google Calendar, Apple Calendar or Outlook, and you'll be reminded on your phone even when the app is closed.

### Invoices
1. In **Settings**, enter your name, address, hourly rate, currency, tax and payment details.
2. Tick **Billable** on the tasks you charge for, and give them a client.
3. Go to **Invoice** and choose the dates and client. The invoice preview updates as you change them.
4. **Print or save PDF** gives you a clean invoice. **Mark as invoiced** stops that time from being billed twice, and has an Undo.

### Your data
All data is saved in your browser's local storage, so it stays on your device. Use **Settings → Backup → Download backup** to save a JSON file. To restore it or move it to another browser, use **Settings → Danger zone → Restore from backup**, which replaces what's there after asking you first.

## Hosting it (optional)
To use it from any device, turn on **GitHub Pages**: go to repo **Settings → Pages**, choose "Deploy from a branch", then pick the branch and `/ (root)`.
Data is still stored per browser. Use backup and restore to move it between devices.

## Files
- `index.html`: page structure
- `styles.css`: styling (light and dark mode, phone to desktop, print layout for invoices)
- `app.js`: all the logic
- `fonts/`: IBM Plex Sans, bundled so the app looks the same everywhere and works offline (SIL Open Font License, see `fonts/OFL-IBM-Plex-Sans.txt`)

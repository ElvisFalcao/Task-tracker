# Workload Tracker

A simple personal app for managing your workload: tasks, priorities, reminders, time tracking and invoices.
It is plain HTML, CSS and JavaScript, so there is nothing to install or build.

## How to use it

Open `index.html` in your browser. To get it on your phone or any computer, see **Hosting it** below.

### Tasks
- Add a task with a **priority** (High / Medium / Low), an optional **due date and time**, a **reminder time**, a **client/project**, an **estimate** and a **billable** flag.
- Click anywhere in a date or time field to open the picker. You can also use the quick buttons: **Today / Tomorrow / This Friday / Next Monday** for the due date, and **In 1 hour / Today 6 PM / Tomorrow 9 AM / 1 hour before due** for reminders.
- Views:
  - **Today**: overdue tasks, tasks due today, and High-priority tasks with no date
  - **This week**: tasks due in the next 7 days
  - **All open**
  - **Done**
- Tasks are **sorted by priority automatically**. The order combines how important a task is with how close its due date is, so overdue and soon-due work moves up the list. The **Suggested next** banner shows the task to do first.

### Time tracking
- Press **▶ Start** on any task. The timer stays visible at the top and in the browser tab title. Only one timer runs at a time, and starting another task stops the current one.
- The timer keeps running if you close or reload the page.
- Each task shows the time you've tracked against its estimate. The estimate turns orange when you go over it.
- **Time log** shows today and this week's totals, plus unbilled hours and their value. You can also add time manually with a **From / To** time or a number of minutes.

### Reminders
- Under **Settings → Enable notifications**, you can allow browser notifications. A notification and an in-app pop-up appear at each task's "Remind me at" time while the app is open. A pinned tab works well for this.
- When you open the app, it tells you how many tasks are due today or overdue.
- **📅 Calendar** on a task downloads a `.ics` event with an alarm. Open it to add the task to Google Calendar, Apple Calendar or Outlook, and you'll get reminded on your phone even when the app is closed.

### Invoices
1. In **Settings**, enter your name, address, hourly rate, currency, tax and payment details.
2. Mark tasks as **Billable** and give them a client.
3. Go to **Invoice**, choose the client and date range, then click **Generate invoice**.
4. **Print / Save as PDF** gives you a clean invoice. **Mark this time as invoiced** stops that time from being billed twice.

### Your data
All data is saved in your browser's local storage, so it stays on your device. Use **Settings → Export backup** to save a JSON file. Use **Import** to restore it or move it to another browser.

## Hosting it (optional)
To use it from any device, turn on **GitHub Pages**: go to repo **Settings → Pages**, choose "Deploy from a branch", then pick the branch and `/ (root)`.
Data is still stored per browser. Use export/import to move it between devices.

## Files
- `index.html`: page layout
- `styles.css`: styling (light and dark mode, mobile friendly, print layout for invoices)
- `app.js`: all the logic

# HireMind Static Marketing Site (No npm, No APIs)

This is a pure static website for HireMind.

## What this version does
- Uses only HTML + CSS + vanilla JavaScript
- No npm, no framework, no build step
- No backend API calls
- Multi-page marketing site:
  - `index.html`
  - `how-it-works.html`
  - `features.html`
  - `waitlist.html`
  - `privacy.html`
  - `terms.html`

## Waitlist behavior (no API mode)
- Form fields: first name, email, role, notes
- Email validation in browser
- Duplicate prevention by email in local storage
- Captures `createdAt`, `sourcePage`, and UTM params
- Export button downloads local waitlist entries as JSON

Storage key: `hiremind_waitlist_entries`

## Run locally
No install needed.

Option 1:
- Open `index.html` directly in your browser.

Option 2 (recommended):
- Serve the folder with any static server (Python, VSCode Live Server, etc.)

Example with Python:
```bash
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080)

## Assets
- Screenshots are loaded from `public/screenshots/`
- Favicon: `public/favicon.svg`

## Important note
This no-API version stores waitlist entries only in each visitor's browser. It is good for prototype/demo mode, not real production lead capture.

For production launch capture later, connect a backend (Supabase/Firebase) and transactional email automation.

# Holladay Digest

Plain-language AI summaries of every Holladay, UT City Council and Planning Commission meeting. Live at [holladay.fyi](https://holladay.fyi).

It works with any city that publishes minutes on the [OneSuite](https://suiteonemedia.com) portal.

## How it works

```
Nightly (GitHub Actions)
  → check the city's OneSuite portal for new minutes
  → read the PDF or transcript and summarize it with Claude
  → commit the updated SQLite database to main (Vercel redeploys)
  → email the summary to subscribers via Resend
```

If nothing is new, nothing is summarized and nothing is spent.

On the site, pick a date or scroll through every meeting. Search all summaries with ⌘K, or sign up for email.

## Stack

- **Scraper:** Python, pdfplumber, BeautifulSoup, Anthropic API (Claude Opus 5.5)
- **Web:** Next.js 15, Tailwind CSS, better-sqlite3, Motion
- **Data:** SQLite (`meeting_summaries.db`, committed to the repo)
- **Email:** Resend
- **Hosting:** Vercel, with GitHub Actions running the scraper

## Run it

```bash
# Scraper
pip install anthropic pdfplumber requests beautifulsoup4
export ANTHROPIC_API_KEY=sk-ant-...
python scraper.py --recent            # last 90 days (omit for everything since 2020)
python scraper.py --resummarize 5     # redo the 5 newest summaries

# Web app (Node 22)
cd next-app && npm install && npm run dev   # http://localhost:3001
```

Re-running is safe because the database tracks what's already been processed.

## Use it for your city

```bash
python scraper.py --url https://yourcity.suiteonemedia.com
```

You can also set `ONESUITE_URL`. To find your city's URL, follow the "Meeting Minutes" link on the city website. Then make these changes:

- In `scraper.py`, change the city name in `SUMMARY_PROMPT`, the Resend `audience_id` and the `from` address.
- In `next-app`, set `RESEND_AUDIENCE_ID`.

## Deploy

1. **GitHub Actions:** add the repo secrets `ANTHROPIC_API_KEY`, `RESEND_API_KEY` and, optionally, `ONESUITE_URL`. The workflow `.github/workflows/scrape.yml` runs nightly. You can also run it from the Actions tab, with an optional "re-summarize N" input.
2. **Vercel:** import the repo, set the root directory to `next-app`, and add `RESEND_API_KEY` (and optionally `RESEND_AUDIENCE_ID`).

## Layout

```
scraper.py                 scrape, summarize, email
meeting_summaries.db       all summaries
.github/workflows/         nightly scrape
next-app/
  app/page.tsx             hero, date nav and meeting feed
  app/actions.ts           search
  app/api/subscribe/       email signup
  components/              MeetingBrowser, MeetingList, MeetingSummary, HalftoneHero, overlays
  lib/                     db queries, meeting types, date formatting
```

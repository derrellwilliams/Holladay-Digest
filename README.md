# OneSuite Digest

An open-source tool for browsing city meeting minutes with AI-generated summaries. Works with any city that uses the [OneSuite](https://suiteonemedia.com) government portal platform.

Built for Holladay, UT — adaptable to any OneSuite municipality in minutes.

![OneSuite Digest Screenshot](screenshot.png)

## Features

- Browse City Council and Planning Commission meeting minutes
- Filter by meeting type, year, and month
- Search across all summaries with highlighted matches
- AI-generated structured summaries with key topics, decisions, and votes
- Links to original PDF for each meeting
- Automatically updates nightly when new minutes are posted

## Stack

- **Scraper** — Python, pdfplumber, Anthropic Claude API
- **Automation** — GitHub Actions (nightly cron)
- **Web app** — Next.js 15, Tailwind CSS, better-sqlite3
- **Storage** — SQLite (`meeting_summaries.db`, committed to repo)
- **Hosting** — Vercel (auto-deploys on DB update)

## How it works

```
Nightly (midnight MT)
  → GitHub Actions checks the city website for new minutes PDFs
  → If new: downloads PDF, extracts text, summarizes with Claude
  → Commits updated database to main
  → Vercel detects the push and redeploys the site
```

No API calls are made if nothing is new — zero cost on empty runs.

---

## Using this for your city

If your city uses OneSuite, you can run this against their portal with one flag:

```bash
python3 scraper.py --url https://yourcity.suiteonemedia.com
```

Or set the environment variable and omit the flag:

```bash
export ONESUITE_URL="https://yourcity.suiteonemedia.com"
python3 scraper.py
```

To find your city's OneSuite URL, look for a link to "City Council Minutes" or "Meeting Minutes" on your city's website — it will redirect to a `suiteonemedia.com` subdomain.

> **Note:** Some cities only publish agendas, not minutes PDFs. The scraper handles this gracefully — it skips any meeting row that doesn't have a minutes link.

---

## Setup

### 1. Scraper (local / initial population)

Install dependencies:
```bash
pip3 install anthropic pdfplumber requests beautifulsoup4
```

Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Run the full historical scrape (2020 onwards):
```bash
python3 scraper.py --url https://yourcity.suiteonemedia.com
```

Or check only the last 90 days:
```bash
python3 scraper.py --url https://yourcity.suiteonemedia.com --recent
```

The scraper uses the database itself to track what's been processed — re-running is safe, no duplicates.

### 2. Web App (local)

```bash
cd next-app
npm install
npm run dev
```

Visit [http://localhost:3001](http://localhost:3001).

### 3. Automated nightly updates (GitHub Actions)

Add two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `ONESUITE_URL` | Your city's OneSuite URL (optional — defaults to Holladay) |

The workflow (`.github/workflows/scrape.yml`) runs automatically every night. Trigger it manually anytime from the **Actions** tab.

### 4. Hosting on Vercel

1. Import the repo into Vercel
2. Set **Root Directory** to `next-app`
3. Deploy — Vercel will auto-redeploy whenever the scraper commits a DB update

---

## Project Structure

```
/
├── scraper.py                    # Scrapes PDFs, summarizes with Claude, saves to SQLite
├── meeting_summaries.db          # SQLite database (committed to repo)
├── pdfs/                         # Downloaded PDFs (git-ignored, transient)
├── .github/workflows/scrape.yml  # Nightly automation
└── next-app/
    ├── app/
    │   ├── page.tsx                  # Dashboard
    │   └── meetings/[id]/page.tsx    # Meeting detail
    ├── components/
    │   ├── MeetingCard.tsx
    │   └── Sidebar.tsx
    └── lib/
        ├── db.ts                     # SQLite queries
        ├── meetingColors.ts          # Type labels
        └── utils.ts                  # Shared utilities
```

## Notes

- Tested against Holladay, UT (`holladayut.suiteonemedia.com`). Other OneSuite instances should work but are not guaranteed — the page structure may vary slightly.
- Node.js 20.x is required (pinned in `package.json`) for `better-sqlite3` compatibility on Vercel.

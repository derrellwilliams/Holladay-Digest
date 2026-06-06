#!/usr/bin/env python3
"""
OneSuite Meeting Minutes Scraper
Scrapes meeting minutes PDFs from any OneSuite-powered city portal,
extracts text, summarizes via Claude, and saves to SQLite.
"""

import argparse
import os
import re
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin

import anthropic
import pdfplumber
import requests
from bs4 import BeautifulSoup
from typing import Optional

# Load .env file if present
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

# ── Config ─────────────────────────────────────────────────────────────────────
DEFAULT_BASE_URL = "https://holladayut.suiteonemedia.com"
DB_FILE = Path("meeting_summaries.db")
PDF_DIR = Path("pdfs")
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


# ── Database setup ─────────────────────────────────────────────────────────────
def init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS meeting_summaries (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_type TEXT NOT NULL,
            meeting_date TEXT,
            pdf_url      TEXT UNIQUE NOT NULL,
            summary      TEXT NOT NULL,
            created_at   TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()


# ── Processed-PDF tracking ─────────────────────────────────────────────────────
def load_processed(conn: sqlite3.Connection) -> set:
    rows = conn.execute("SELECT pdf_url FROM meeting_summaries").fetchall()
    return {row[0] for row in rows}


# ── Scraping ───────────────────────────────────────────────────────────────────
def fetch_meetings_page(session: requests.Session, date_from: str, date_to: str, base_url: str) -> Optional[BeautifulSoup]:
    """
    Fetch the main page with a date-range filter.
    The site accepts dateFrom / dateTo as GET params (MM/DD/YYYY).
    """
    params = {"dateFrom": date_from, "dateTo": date_to}
    headers = {**HEADERS, "Referer": base_url}
    try:
        resp = session.get(base_url + "/", headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        print(f"  [WARN] Fetch failed: {e}")
        return None


def parse_meeting_rows(soup: BeautifulSoup, base_url: str) -> list[dict]:
    """
    Parse the eventTable rows.

    Expected row structure (confirmed from live page):
      <tr>
        <td><a href="/event/?id=NNN">Meeting Type Name</a></td>
        <td>Feb 05, 2026 | 06:00 PM</td>
        <td><a href="/event/GetAgendaFile/Agenda?aid=NNN"></a></td>
        <td><a href="/event/GetAgendaPacketFile/...?apid=NNN"></a></td>
        <td><a href="/event/GetMinutesFile/Minutes?mid=NNN"></a></td>
        ...
      </tr>
    """
    results = []

    # All rows in both eventTable and upcomingEventsTable
    for table in soup.find_all("table", class_=re.compile(r"eventTable|upcomingEventsTable", re.I)):
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if not cells:
                continue

            # First cell: event link → meeting type name
            event_link = cells[0].find("a", href=re.compile(r"/event/\?id=", re.I))
            if not event_link:
                continue
            import re as _re
            meeting_type = _re.sub(r'\(opens in(to)? a? ?new window\)', '', event_link.get_text(strip=True), flags=_re.I).strip()

            # Second cell: date/time string
            meeting_date = cells[1].get_text(strip=True) if len(cells) > 1 else None
            if meeting_date:
                # Normalize: "Feb 05, 2026 | 06:00 PM" → "Feb 05, 2026"
                meeting_date = meeting_date.split("|")[0].strip()

            # Find the minutes link — old format is a direct PDF, new format links to event page
            minutes_link = row.find("a", href=re.compile(r"/event/GetMinutesFile/", re.I))
            if not minutes_link and len(cells) >= 5:
                # New format: last column links to event page (/event/?id=NNN)
                minutes_link = cells[-1].find("a", href=re.compile(r"/event/\?id=", re.I))
            if not minutes_link:
                continue  # no minutes available for this meeting

            minutes_url = urljoin(base_url, minutes_link["href"])
            results.append({
                "url": minutes_url,
                "meeting_type": meeting_type,
                "meeting_date": meeting_date,
            })

    return results


def scrape_all_minutes(session: requests.Session, base_url: str, recent: bool = False) -> list[dict]:
    """
    Fetch meetings across multiple date windows.
    If recent=True, only checks the last 90 days.
    Returns a deduplicated list of minutes entries.
    """
    all_links: dict[str, dict] = {}
    today = datetime.now()

    if recent:
        date_from = (today - timedelta(days=90)).strftime("%m/%d/%Y")
        date_to = today.strftime("%m/%d/%Y")
        windows = [(date_from, date_to)]
    else:
        current_year = today.year
        windows = [(f"01/01/{y}", f"12/31/{y}") for y in range(2020, current_year + 1)]

    print(f"Fetching {len(windows)} date window(s)...")
    for date_from, date_to in windows:
        print(f"  Fetching {date_from} → {date_to}...", end=" ", flush=True)
        soup = fetch_meetings_page(session, date_from, date_to, base_url)
        if soup:
            rows = parse_meeting_rows(soup, base_url)
            new = 0
            for item in rows:
                if item["url"] not in all_links:
                    all_links[item["url"]] = item
                    new += 1
            print(f"{new} new minute links")
        else:
            print("fetch failed")
        time.sleep(0.3)

    print(f"\nTotal unique minutes PDFs found: {len(all_links)}")
    return list(all_links.values())


# ── PDF download & extraction ──────────────────────────────────────────────────
def download_pdf(session: requests.Session, url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    try:
        resp = session.get(url, headers=HEADERS, timeout=60, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except requests.RequestException as e:
        print(f"  [WARN] Download failed: {e}")
        return False


def extract_text(pdf_path: Path) -> str:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n\n".join(pages)
    except Exception as e:
        print(f"  [WARN] PDF extraction error: {e}")
        return ""


def fetch_transcript(session: requests.Session, url: str) -> str:
    """Fetch transcript text from an OneSuite event page (new minutes format)."""
    try:
        resp = session.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  [WARN] Fetch failed: {e}")
        return ""

    soup = BeautifulSoup(resp.text, "html.parser")

    # Try known transcript containers
    transcript = (
        soup.find("div", class_=re.compile(r"event.transcript", re.I))
        or soup.find("div", id=re.compile(r"transcript.content", re.I))
    )
    if transcript:
        text = transcript.get_text(separator="\n")
    else:
        # Fall back: grab everything after the "Transcript" heading
        heading = soup.find(lambda tag: tag.name in ("h2", "h3") and "Transcript" in tag.get_text())
        if heading:
            parts = [sib.get_text(separator="\n") for sib in heading.find_next_siblings()]
            text = "\n".join(parts)
        else:
            text = soup.get_text(separator="\n")

    # Strip timestamp-only lines (HH:MM:SS or H:MM:SS)
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    filtered = [l for l in lines if not re.match(r"^\d{1,2}:\d{2}:\d{2}$", l)]
    return "\n".join(filtered)


# ── Claude summarization ───────────────────────────────────────────────────────
SUMMARY_PROMPT = """\
You are analyzing official meeting minutes from a city government meeting.

Meeting Type: {meeting_type}
Meeting Date: {meeting_date}

Provide a structured summary with these sections:

1. **Meeting Overview** — Meeting type, date, location, quorum/attendees.
2. **Key Topics Discussed** — Bullet list of main subjects.
3. **Decisions Made** — Each formal decision or resolution adopted.
4. **Votes** — Each vote taken: motion, outcome, and individual votes if recorded.
5. **Action Items** — Tasks assigned or follow-up actions, with responsible parties.
6. **Other Notable Items** — Public comments, announcements, or anything significant.

Be concise but complete. Use dates and names exactly as written in the document.

--- MEETING MINUTES ---
{text}
"""


def summarize(client: anthropic.Anthropic, text: str, meeting_type: str, meeting_date: Optional[str]) -> str:
    prompt = SUMMARY_PROMPT.format(
        meeting_type=meeting_type,
        meeting_date=meeting_date or "unknown",
        text=text[:15000],  # stay within context limits
    )
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


# ── Markdown → HTML (email-safe inline styles) ────────────────────────────────
def _inline_md(text: str) -> str:
    """Convert inline markdown (bold, italic) to HTML."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    return text


def _render_table(table_lines: list[str]) -> str:
    rows = []
    for line in table_lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append(cells)

    if len(rows) < 2:
        return ""

    header_cells = rows[0]
    data_rows = rows[2:]  # rows[1] is the --- separator row

    th_style = "padding:8px 12px;text-align:left;font-size:13px;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;white-space:nowrap;"
    td_style = "padding:8px 12px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;vertical-align:top;"

    thead = "<tr>" + "".join(f'<th style="{th_style}">{_inline_md(c)}</th>' for c in header_cells) + "</tr>"
    tbody = "".join(
        "<tr>" + "".join(f'<td style="{td_style}">{_inline_md(c)}</td>' for c in row) + "</tr>"
        for row in data_rows
    )
    table_style = "width:100%;border-collapse:collapse;margin:16px 0;"
    return f'<table style="{table_style}"><thead>{thead}</thead><tbody>{tbody}</tbody></table>'


def markdown_to_html(text: str) -> str:
    """Convert Claude's markdown summary to email-safe HTML with inline styles."""
    lines = text.split("\n")
    parts = []
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Horizontal rule
        if re.match(r'^-{3,}$', stripped):
            parts.append('<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">')
            i += 1
            continue

        # H1 (# Title) — skip, we render meeting date as the heading
        if stripped.startswith("# ") and not stripped.startswith("## "):
            i += 1
            continue

        # H2 (## 1. Section)
        if stripped.startswith("## "):
            content = _inline_md(stripped[3:])
            parts.append(
                f'<h2 style="margin:28px 0 10px 0;font-size:13px;font-weight:700;'
                f'letter-spacing:0.08em;text-transform:uppercase;color:#475841;'
                f'font-family:\'Helvetica Neue\',Arial,sans-serif;">{content}</h2>'
            )
            i += 1
            continue

        # Table block — collect consecutive | lines
        if stripped.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            parts.append(_render_table(table_lines))
            continue

        # Bullet list — collect consecutive - items
        if stripped.startswith("- ") or stripped.startswith("* "):
            items = []
            while i < len(lines) and (lines[i].strip().startswith("- ") or lines[i].strip().startswith("* ")):
                item_text = _inline_md(lines[i].strip()[2:])
                items.append(
                    f'<li style="margin:0 0 6px 0;color:#374151;font-size:15px;line-height:1.6;">{item_text}</li>'
                )
                i += 1
            parts.append(
                '<ul style="margin:0 0 16px 0;padding-left:20px;">' + "".join(items) + "</ul>"
            )
            continue

        # Regular paragraph
        parts.append(
            f'<p style="margin:0 0 14px 0;color:#374151;font-size:15px;line-height:1.7;">'
            f'{_inline_md(stripped)}</p>'
        )
        i += 1

    return "\n".join(parts)


# ── Email digest ───────────────────────────────────────────────────────────────
def send_digest(new_meetings: list[dict], resend_api_key: str) -> None:
    """Send an email digest to all subscribers for each new meeting."""
    audience_id = "f0e9aae2-f00b-4af6-b995-34ad472d3429"
    headers = {"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"}

    # Fetch subscribers
    resp = requests.get(
        f"https://api.resend.com/audiences/{audience_id}/contacts",
        headers=headers,
        timeout=10,
    )
    if not resp.ok:
        print(f"  [WARN] Could not fetch subscribers: {resp.text}")
        return

    contacts = [c for c in resp.json().get("data", []) if not c.get("unsubscribed")]
    if not contacts:
        print("  No subscribers to email.")
        return

    emails = [c["email"] for c in contacts]
    print(f"  Sending digest to {len(emails)} subscriber(s)...")

    for meeting in new_meetings:
        meeting_type = meeting["meeting_type"]
        meeting_date = meeting["meeting_date"] or "Unknown date"
        summary = meeting["summary"]

        body_html = markdown_to_html(summary)

        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#E6E8E6;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#475841;padding:24px 32px;">
      <p style="margin:0;color:white;font-size:26px;font-family:Georgia,serif;letter-spacing:-0.01em;">Holladay Digest</p>
    </div>
    <div style="padding:32px 32px 24px;">
      <div style="margin-bottom:14px;">
        <span style="background:#EFEFEF;color:#3F403F;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;letter-spacing:0.02em;">{meeting_type}</span>
      </div>
      <h1 style="margin:0 0 28px 0;font-size:32px;color:#111827;font-family:Georgia,serif;line-height:1.2;">{meeting_date}</h1>
      {body_html}
    </div>
    <div style="padding:16px 32px 28px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you subscribed to Holladay Digest. <a href="https://resend.com/unsubscribe" style="color:#475841;text-decoration:none;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>"""

        payload = {
            "from": "hi@matthewdwilliams.com",
            "to": emails,
            "subject": f"New meeting minutes: {meeting_type} — {meeting_date}",
            "html": html,
        }

        send_resp = requests.post("https://api.resend.com/emails", headers=headers, json=payload, timeout=15)
        if send_resp.ok:
            print(f"  Sent: {meeting_type} | {meeting_date}")
        else:
            print(f"  [WARN] Email failed: {send_resp.text}")


# ── Main ───────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape meeting minutes from a OneSuite city portal.")
    parser.add_argument("--url", default=os.environ.get("ONESUITE_URL") or DEFAULT_BASE_URL, help="Base URL of the OneSuite portal (e.g. https://yourcity.suiteonemedia.com)")
    parser.add_argument("--recent", action="store_true", help="Only check the last 90 days")
    args = parser.parse_args()

    base_url = args.url.rstrip("/")
    print(f"=== OneSuite Meeting Minutes Scraper ===")
    print(f"Portal: {base_url}\n")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ERROR: ANTHROPIC_API_KEY environment variable not set.")

    PDF_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    init_db(conn)
    processed = load_processed(conn)
    claude = anthropic.Anthropic(api_key=api_key)
    session = requests.Session()

    print(f"Previously processed: {len(processed)} PDFs\n")

    all_links = scrape_all_minutes(session, base_url=base_url, recent=args.recent)

    new_links = [item for item in all_links if item["url"] not in processed]
    print(f"New PDFs to process: {len(new_links)}\n")

    if not new_links:
        print("Nothing new to process. Done!")
        conn.close()
        return

    succeeded = 0
    new_meetings_for_digest = []
    for i, item in enumerate(new_links, 1):
        url = item["url"]
        meeting_type = item["meeting_type"]
        meeting_date = item["meeting_date"]

        mid_match = re.search(r"mid=(\d+)", url)
        mid = mid_match.group(1) if mid_match else str(abs(hash(url)))
        safe_type = re.sub(r"[^\w]", "_", meeting_type)
        pdf_path = PDF_DIR / f"{safe_type}_{mid}.pdf"

        print(f"[{i}/{len(new_links)}] {meeting_type} | {meeting_date or 'date unknown'}")
        print(f"  mid={mid}  →  {url}")

        # Download PDF or fetch transcript page
        if "GetMinutesFile" in url:
            print("  Downloading...", end=" ", flush=True)
            if not download_pdf(session, url, pdf_path):
                processed.add(url)
                continue
            print("OK")

            print("  Extracting text...", end=" ", flush=True)
            text = extract_text(pdf_path)
            if not text.strip():
                print("no text extracted, skipping.")
                processed.add(url)
                continue
            print(f"{len(text):,} chars")
        else:
            print("  Fetching transcript...", end=" ", flush=True)
            text = fetch_transcript(session, url)
            if not text.strip():
                print("no transcript found, skipping.")
                processed.add(url)
                continue
            print(f"{len(text):,} chars")

        # Summarize
        print("  Summarizing with Claude...", end=" ", flush=True)
        try:
            summary = summarize(claude, text, meeting_type, meeting_date)
        except anthropic.APIError as e:
            print(f"API error: {e}")
            continue
        print("OK")

        # Save to DB
        conn.execute(
            """
            INSERT OR REPLACE INTO meeting_summaries
                (meeting_type, meeting_date, pdf_url, summary)
            VALUES (?, ?, ?, ?)
            """,
            (meeting_type, meeting_date, url, summary),
        )
        conn.commit()

        processed.add(url)
        new_meetings_for_digest.append({
            "meeting_type": meeting_type,
            "meeting_date": meeting_date,
            "summary": summary,
        })
        succeeded += 1

        print()
        time.sleep(0.5)  # polite pause between Claude calls

    print(f"\n=== Done. {succeeded}/{len(new_links)} PDFs processed successfully. ===")
    print(f"Database: {DB_FILE.resolve()}")
    conn.close()

    resend_key = os.environ.get("RESEND_API_KEY")
    if new_meetings_for_digest and resend_key:
        print("\nSending email digest...")
        send_digest(new_meetings_for_digest, resend_key)
    elif new_meetings_for_digest:
        print("\n[SKIP] RESEND_API_KEY not set, skipping email digest.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
OneSuite Meeting Minutes Scraper
Scrapes meeting minutes PDFs from any OneSuite-powered city portal,
extracts text, summarizes via Claude, and saves to SQLite.
"""

import argparse
import html
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

1. **In Brief** — Two plain-language sentences a resident can read in ten seconds: what happened and why it matters.
2. **Meeting Overview** — Meeting type, date, location, quorum/attendees.
3. **Key Topics Discussed** — Bullet list of main subjects.
4. **Decisions Made** — Each formal decision or resolution adopted.
5. **Votes** — Each vote taken: motion, outcome, and individual votes if recorded.
6. **Action Items** — Tasks assigned or follow-up actions, with responsible parties.
7. **Other Notable Items** — Public comments, announcements, or anything significant.

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


# ── Summary → email HTML (mirrors next-app/components/MeetingSummary.tsx) ─────
# Matches the site: Roboto Condensed / Roboto Mono / Roboto, with fallbacks for clients that block web fonts
EMAIL_DISPLAY = "'Roboto Condensed','Arial Narrow',Arial,sans-serif"
EMAIL_MONO = "'Roboto Mono',Menlo,Consolas,monospace"
EMAIL_SANS = "Roboto,'Helvetica Neue',Arial,sans-serif"
# Static capture of the site's halftone hero (next-app/public/email-halftone.jpg), served by the deployed site
EMAIL_HALFTONE_URL = "https://holladay-digest-five.vercel.app/email-halftone.jpg"

PINE = (0x0F, 0x1A, 0x0D)
PAPER = (0xEE, 0xF2, 0xEA)
LIME = (0x8F, 0xFF, 0x7A)


def _mix(fg: tuple, alpha: float, bg: tuple = PINE) -> str:
    """Solid hex for a translucent color over the card (email clients handle rgba unevenly)."""
    return "#" + "".join(f"{round(f * alpha + b * (1 - alpha)):02X}" for f, b in zip(fg, bg))


SECTIONS = [
    ("brief", r"^in brief$", "In Brief"),
    ("overview", r"^(meeting )?overview$", "Overview"),
    ("topics", r"^key topics( discussed)?$", "Topics"),
    ("decisions", r"^decisions( made)?$", "Decisions"),
    ("votes", r"^votes?( taken)?$", "Votes"),
    ("actions", r"^action items$", "Actions"),
    ("notes", r"^(other )?notable items$", "Notes"),
]
SECTION_TITLES = {key: title for key, _, title in SECTIONS}
BULLET = re.compile(r"^(\s*)(?:[-*•]|\d+\.)\s+(.*)$")
EMPTY_SECTION = re.compile(
    r"\b(no|none)\b[^.]*\b(recorded|taken|adopted|made|assigned|identified|noted|captured|occurred)\b"
    r"|\bnot (recorded|captured|documented)\b|\bdoes not (record|include|capture|contain)\b",
    re.I,
)
LOGISTICS = re.compile(r"\b(quorum|attend\w*|present|absent|presiding|time|location|called to order)\b", re.I)
HOUSEKEEPING = re.compile(r"transcript|off-topic|informal|summary note|note on", re.I)
RESPONSIBLE = re.compile(r"responsib|owner|party|assigned|who", re.I)


def _clean_title(text: str) -> str:
    return re.sub(r"^\d+\.\s*", "", text.replace("**", "")).rstrip(":").strip()


def _section_key(title: str) -> Optional[str]:
    return next((key for key, pattern, _ in SECTIONS if re.match(pattern, title, re.I)), None)


def _parse_item(text: str) -> dict:
    m = re.match(r"^\*\*(.+?)\*\*\s*[:—–-]?\s*(.*)$", text)
    if m and len(m.group(1)) < 120:
        return {"label": m.group(1).rstrip(":").strip(), "body": m.group(2), "children": []}
    return {"label": None, "body": text, "children": []}


def parse_summary(text: str, start_in_body: bool = False) -> list[dict]:
    """Split an AI summary into its sections; each section is a list of blocks."""
    sections: list[dict] = []
    current = {"key": "body", "blocks": []} if start_in_body else None
    if current:
        sections.append(current)
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        t = lines[i].strip()
        if not t or re.match(r"^(-{3,}|\*{3,})$", t):
            i += 1
            continue

        m = re.match(r"^#{1,6}\s+(.*)$", t) or re.match(r"^\*\*([^*]+)\*\*:?$", t)
        heading = m.group(1) if m else (t if re.match(r"^\d+\.\s+", t) and _section_key(_clean_title(t)) else None)
        if heading:
            title = _clean_title(heading)
            key = _section_key(title)
            if key:
                current = {"key": key, "blocks": []}
                sections.append(current)
            elif current:
                current["blocks"].append({"kind": "sub", "text": title})
            i += 1
            continue

        if t.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = lines[i].strip()
                if not re.match(r"^\|[\s:|-]+\|$", row):
                    rows.append([c.strip() for c in row.strip("|").split("|")])
                i += 1
            has_header = bool(rows) and all(c and not c.startswith("**") for c in rows[0])
            if current:
                current["blocks"].append({"kind": "table", "header": rows[0] if has_header else [], "rows": rows[1:] if has_header else rows})
            continue

        if t.startswith(">"):
            if current:
                current["blocks"].append({"kind": "note", "text": t.lstrip("> ").strip()})
            i += 1
            continue

        if BULLET.match(lines[i]):
            items: list[dict] = []
            while i < len(lines) and (bm := BULLET.match(lines[i])):
                item = _parse_item(bm.group(2).strip())
                if bm.group(1) and items:
                    items[-1]["children"].append(item)
                else:
                    items.append(item)
                i += 1
            if current:
                current["blocks"].append({"kind": "list", "items": items})
            continue

        if current:
            current["blocks"].append({"kind": "para", "text": t})
        i += 1

    # Older summaries without recognizable section headings render as one body
    return sections if sections or start_in_body else parse_summary(text, True)


def _flat_text(blocks: list[dict]) -> str:
    parts = []
    for b in blocks:
        if b["kind"] == "list":
            parts += [" ".join(p for p in (it["label"], it["body"]) if p) for it in b["items"]]
        elif b["kind"] != "table":
            parts.append(b["text"])
    return re.sub(r"\*+", "", " ".join(parts)).strip()


def _is_empty_section(section: dict) -> bool:
    simple = all(
        b["kind"] in ("para", "note") or (b["kind"] == "list" and len(b["items"]) <= 1 and not (b["items"] and b["items"][0]["children"]))
        for b in section["blocks"]
    )
    text = _flat_text(section["blocks"])
    return simple and len(text) < 500 and bool(EMPTY_SECTION.search(text))


def _inline(text: str) -> str:
    """Escape, then render **bold** and *italic*."""
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*([^*]+)\*\*", rf'<strong style="font-weight:500;color:{_mix(PAPER, 1)};">\1</strong>', text)
    return re.sub(r"\*([^*\s][^*]*)\*", r"<em>\1</em>", text)


def _p(text: str, color: str, size: int = 15, extra: str = "") -> str:
    return f'<p style="margin:0 0 14px 0;font-family:{EMAIL_SANS};font-size:{size}px;line-height:1.6;color:{color};{extra}">{text}</p>'


def _note(text: str) -> str:
    return _p(text, _mix(PAPER, 0.45), 13, "font-style:italic;")


def _mono_label(text: str, color: str) -> str:
    return f'<span style="font-family:{EMAIL_MONO};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:{color};">{html.escape(text)}</span>'


def _render_children(children: list[dict]) -> str:
    kids = "".join(
        f'<p style="margin:0 0 6px 0;font-family:{EMAIL_SANS};font-size:14px;line-height:1.6;color:{_mix(PAPER, 0.65)};">'
        + (f'<span style="font-weight:500;color:{_mix(PAPER, 0.85)};">{_inline(c["label"])}: </span>' if c["label"] else "")
        + f'{_inline(c["body"])}</p>'
        for c in children
    )
    return f'<div style="margin-top:8px;padding-left:14px;border-left:1px solid {_mix(LIME, 0.15)};">{kids}</div>'


def _render_item(item: dict, dim_housekeeping: bool) -> str:
    children = _render_children(item["children"]) if item["children"] else ""

    # Plain items get a small lime square with a hanging indent; labeled items are marked by their label
    if not item["label"]:
        return (
            '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;"><tr>'
            f'<td valign="top" width="18" style="width:18px;padding-top:9px;"><div style="width:6px;height:6px;font-size:0;line-height:0;background:{_mix(LIME, 0.7)};">&nbsp;</div></td>'
            f'<td valign="top"><p style="margin:0;font-family:{EMAIL_SANS};font-size:15px;line-height:1.6;color:{_mix(PAPER, 0.85)};">{_inline(item["body"])}</p>{children}</td>'
            "</tr></table>"
        )

    dim = dim_housekeeping and HOUSEKEEPING.search(item["label"])
    out = [f'<p style="margin:0;font-family:{EMAIL_DISPLAY};font-weight:700;font-size:{15 if dim else 17}px;line-height:1.3;color:{_mix(PAPER, 0.6 if dim else 1)};">{_inline(item["label"])}</p>']
    if item["body"]:
        out.append(f'<p style="margin:4px 0 0 0;font-family:{EMAIL_SANS};font-size:{14 if dim else 15}px;line-height:1.6;color:{_mix(PAPER, 0.5 if dim else 0.75)};">{_inline(item["body"])}</p>')
    return f'<div style="margin:0 0 16px 0;">{"".join(out)}{children}</div>'


def _render_table(block: dict, section_key: str) -> str:
    header, rows = block["header"], block["rows"]
    # Two columns (Field | Details, Member | Vote, Motion | …) read best as label/value pairs
    if section_key != "actions" and rows and all(len(r) == 2 for r in rows):
        trs = "".join(
            f'<tr><td valign="top" style="padding:3px 16px 3px 0;width:130px;">{_mono_label(r[0].replace("**", ""), _mix(LIME, 0.7))}</td>'
            f'<td valign="top" style="padding:2px 0;font-family:{EMAIL_SANS};font-size:15px;line-height:1.5;color:{_mix(PAPER, 0.85)};">{_inline(r[1])}</td></tr>'
            for r in rows
        )
        return f'<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;">{trs}</table>'

    # Wider tables (Action | Responsible | Notes) become a list: first column leads, the rest are tags
    responsible_col = next((j for j, h in enumerate(header) if RESPONSIBLE.search(h)), -1)
    items = []
    for r in rows:
        tags = []
        for col, cell in enumerate(r[1:], start=1):
            if not cell or cell in ("—", "-"):
                continue
            if col == responsible_col:
                tags.append(
                    f'<span style="display:inline-block;margin:6px 10px 0 0;padding:2px 8px;border:1px solid {_mix(LIME, 0.3)};border-radius:4px;'
                    f'font-family:{EMAIL_MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:{_mix(LIME, 0.9)};">{html.escape(cell.replace("**", ""))}</span>'
                )
            else:
                label = _mono_label(header[col], _mix(LIME, 0.6)) + "&nbsp;" if col < len(header) and header[col] else ""
                tags.append(f'<span style="display:inline-block;margin:6px 10px 0 0;font-family:{EMAIL_SANS};font-size:13px;color:{_mix(PAPER, 0.55)};">{label}{_inline(cell)}</span>')
        items.append(
            f'<div style="margin:0 0 16px 0;"><p style="margin:0;font-family:{EMAIL_SANS};font-size:15px;line-height:1.6;color:{_mix(PAPER, 1)};">{_inline(r[0])}</p>{"".join(tags)}</div>'
        )
    return "".join(items)


def _render_block(block: dict, section_key: str) -> str:
    kind = block["kind"]
    if kind == "list":
        return "".join(_render_item(it, section_key == "notes") for it in block["items"])
    if kind == "table":
        return _render_table(block, section_key)
    if kind == "note":
        return _note(_inline(block["text"]))
    if kind == "sub":
        return f'<p style="margin:8px 0 10px 0;font-family:{EMAIL_DISPLAY};font-weight:700;font-size:18px;line-height:1.3;color:{_mix(PAPER, 1)};">{_inline(block["text"])}</p>'
    # Fully italic lines are asides, e.g. "*(Individual votes not recorded)*"
    if re.match(r"^\*[^*].*\*$", block["text"]):
        return _note(html.escape(block["text"][1:-1], quote=False))
    return _p(_inline(block["text"]), _mix(PAPER, 0.85))


def render_summary_html(summary: str) -> str:
    """Email body for a meeting summary: In Brief, caveats, then each section."""
    sections = parse_summary(summary)
    out = []

    brief = next((s for s in sections if s["key"] == "brief"), None)
    if brief:
        out.append(f'<p style="margin:24px 0 0 0;font-family:{EMAIL_SANS};font-size:19px;line-height:1.55;color:{_mix(PAPER, 1)};">{_inline(_flat_text(brief["blocks"]))}</p>')

    # From the overview, keep only quoted caveats (e.g. incomplete minutes) — never quorum, attendance, time or location
    overview = next((s for s in sections if s["key"] == "overview"), None)
    for b in overview["blocks"] if overview else []:
        if b["kind"] == "note" and not LOGISTICS.search(b["text"]):
            out.append(f'<div style="margin-top:16px;">{_note(_inline(b["text"]))}</div>')

    rule = f"margin-top:32px;padding-top:18px;border-top:1px solid {_mix(LIME, 0.15)};"
    for s in sections:
        if s["key"] in ("brief", "overview"):
            continue
        label = _mono_label(SECTION_TITLES[s["key"]], _mix(LIME, 1)) if s["key"] in SECTION_TITLES else ""
        if _is_empty_section(s):
            first = re.split(r"(?<=\.)\s", _flat_text(s["blocks"]))[0]
            out.append(f'<div style="{rule}">{label}&nbsp;&nbsp;<span style="font-family:{EMAIL_SANS};font-size:14px;color:{_mix(PAPER, 0.45)};">{html.escape(first)}</span></div>')
            continue
        body = "".join(_render_block(b, s["key"]) for b in s["blocks"])
        out.append(f'<div style="{rule}">{label}<div style="margin-top:16px;">{body}</div></div>')

    return "\n".join(out)


def _canonical_type(meeting_type: str) -> str:
    t = meeting_type.lower()
    if "city council" in t:
        return "City Council"
    if "planning commission" in t:
        return "Planning Commission"
    return re.sub(r"\(opens in(to)? a? ?new window\)", "", meeting_type, flags=re.I).strip()


def _subtype(meeting_type: str) -> str:
    t = meeting_type.lower()
    if "audio only" in t:
        return ""
    if "rda" in t:
        return "RDA"
    if "work meeting" in t or "work mtg" in t:
        return "Work Meeting"
    if "legislative" in t:
        return "Legislative"
    return ""


def meeting_title(meeting_type: str) -> str:
    """'City Council Work Meeting(opens…)' → 'City Council Work Meeting'; matches the site's panel title."""
    base = re.sub(r"\s*-\s*audio only$", "", _canonical_type(meeting_type), flags=re.I)
    base = re.sub(r"\bMtg\b", "Meeting", base, flags=re.I)
    subtype = _subtype(meeting_type)
    sub = subtype if subtype and re.sub(r" meeting$", "", subtype, flags=re.I).lower() not in base.lower() else ""
    if sub in ("Work Meeting", "Legislative"):
        return f"{base} {re.sub(r' Meeting$', '', sub)} Meeting"
    title = base if re.search(r"\b(meeting|ceremony|hearing|retreat|session)$", base, re.I) else f"{base} Meeting"
    return f"{title} · {sub}" if sub else title


# ── Email digest ───────────────────────────────────────────────────────────────
def _long_date(date_str: Optional[str]) -> str:
    """'Feb 05, 2026' → 'February 5th, 2026' (matches the site's panel header)."""
    if not date_str:
        return "Unknown date"
    try:
        d = datetime.strptime(date_str, "%b %d, %Y")
    except ValueError:
        return date_str
    day = d.day
    suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{d.strftime('%B')} {day}{suffix}, {d.year}"


def build_digest_html(meeting: dict) -> str:
    """Dark green email matching the Holladay Digest site."""
    title = html.escape(meeting_title(meeting["meeting_type"]))
    body_html = render_summary_html(meeting["summary"])
    pdf_button = ""
    if meeting.get("pdf_url"):
        pdf_button = f"""
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0 0;">
            <tr><td style="border:1px solid #8FFF7A;border-radius:8px;">
              <a href="{meeting['pdf_url']}" style="display:inline-block;padding:12px 32px;font-family:{EMAIL_MONO};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8FFF7A;text-decoration:none;">View PDF</a>
            </td></tr>
          </table>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {{
    .hd {{ font-size: 11.6vw !important; }}
    .px {{ padding-left: 20px !important; padding-right: 20px !important; }}
    .frame {{ padding: 110px 12px 0 !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#16290F;text-wrap:pretty;" bgcolor="#16290F">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#16290F" style="background:#16290F;">
    <tr><td align="center" style="padding:32px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
        <tr><td class="px" style="padding:0 24px 28px;">
          <p class="hd" style="margin:0;font-family:{EMAIL_DISPLAY};font-weight:700;font-size:78px;line-height:0.85;letter-spacing:-0.01em;text-transform:uppercase;color:#8FFF7A;">Holladay Digest</p>
        </td></tr>
        <tr><td class="frame" background="{EMAIL_HALFTONE_URL}" bgcolor="#16290F" style="background-color:#16290F;background-image:url('{EMAIL_HALFTONE_URL}');background-repeat:no-repeat;background-position:center top;background-size:100% auto;padding:185px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td bgcolor="#0F1A0D" class="px" style="background:#0F1A0D;padding:36px 40px 40px;">
          <p style="margin:0;font-family:{EMAIL_MONO};font-size:13px;color:#EEF2EA;">{_long_date(meeting.get("meeting_date"))}</p>
          <h1 style="margin:4px 0 0 0;font-family:{EMAIL_DISPLAY};font-weight:400;font-size:32px;line-height:1.15;color:#EEF2EA;">{title}</h1>{pdf_button}
          {body_html}
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="px" style="padding:24px 24px 0;">
          <p style="margin:0;font-family:{EMAIL_MONO};font-size:11px;line-height:1.6;color:#8FFF7A;opacity:0.7;">You're receiving this because you subscribed to Holladay Digest. <a href="https://resend.com/unsubscribe" style="color:#8FFF7A;text-decoration:underline;">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


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
        html = build_digest_html(meeting)

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
            "pdf_url": url,
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

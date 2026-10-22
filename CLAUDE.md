# Holladay Hub — Claude Guidelines

Behavioral guidelines for this project. Based on Karpathy-inspired principles.

**Tradeoff:** These bias toward caution over speed. Use judgment on trivial tasks.

---

## 1. Think Before Coding

**Don't assume. Surface tradeoffs.**

- State assumptions explicitly before implementing. If uncertain, ask.
- If multiple approaches exist, name them — don't pick silently.
- If something is unclear, stop and ask rather than guess.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- No `Promise.resolve()` wrapping sync functions.
- No `useCallback` unless passed to a memoized child component.

## 3. Surgical Changes

**Touch only what you must.**

- Don't improve adjacent code, comments, or formatting.
- Don't refactor working code unless asked.
- Match existing style even if you'd do it differently.
- If you notice pre-existing dead code, **flag it — don't delete it** without an explicit ask.
- Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Name what "done" looks like before starting.**

For any non-trivial change, state success criteria first:
- "Mobile layout → verify: logo stays natural width, search fills row, filters hidden on mobile"
- "Font fix → verify: Instrument Serif loads on Vercel detail and card pages"

---

## Project-Specific Context

### Stack
- **Next.js 15** App Router — server components by default, `'use client'` only when needed
- **better-sqlite3** — synchronous, call directly in server components (no `Promise.resolve()` wrapping)
- **Tailwind CSS** with custom tokens: `forest`, `pine`, `lime`, `mint`, `soot`, `paper`
- **Fonts**: Roboto Mono (`font-mono`) via `next/font/google`; Zalando Sans (`font-sans`, 400/500/700/900) self-hosted from `app/fonts/` via `next/font/local` (not in next/font/google's list yet)
- **motion** for spring/exit/gesture animation; plain CSS transitions for everything else
- **@paper-design/shaders-react** `HalftoneDots` renders the hero photo (`public/holladay.jpg`)
- **Node 20.x** pinned in `package.json` `engines` field — required for better-sqlite3 on Vercel

### Architecture
- `lib/db.ts` — all SQLite queries, exports `getMeetings`, `getMeeting`, `getMeetingTypes`, `getMeetingYears`, `getMeetingMonths`
- `lib/meetingColors.ts` — `getCanonicalType`, `getSubtype`
- `lib/utils.ts` — `formatDotDate` (09·19·26, or 09/19/26 with `sep`)
- `app/page.tsx` — server component; hero · date nav (together half the width) · meeting feed (the other half). `?m=<id>` picks the meeting the feed opens at; defaults to the most recent
- `app/actions.ts` — `searchMeetings` server action used by the search overlay
- `app/meetings/[id]/page.tsx` — redirects to `/?m=<id>`
- `components/MeetingBrowser.tsx` — client, date nav + every meeting stacked in one feed (own scroll on desktop, page scroll on mobile). Tracks the meeting under the top of the feed (updates `?m=` via `replaceState`), clicking a date animates a 400ms scroll. Only the opening meeting is server-rendered; others render from their text within 1500px of the viewport, with a manual scroll anchor so meetings rendering above don't shift the reader
- `components/MeetingList.tsx` — date-only nav (`10/06/26`), lime when active, `moss` otherwise; horizontal strip on mobile
- `components/MeetingSummary.tsx` — rendered by `MeetingBrowser` (so it ships to the client), parses markdown-like AI summaries
- `components/HalftoneHero.tsx` — Roboto Mono menu (About · Search · Newsletter) in the 60px top margin, then the shader image with the "Holladay Digest" title (Zalando Sans Black, sized in container units, opens the About overlay). Desktop: 60px margin top, left and bottom; page bg `forest`, each meeting is a `pine` card (24px gap, cards land 24px from the top on a date click)
- `components/Overlays.tsx` — `OverlayProvider` owns search/newsletter/about overlay state, ⌘K and `/` open search
- `components/AboutOverlay.tsx` — "What is this?" explainer
- `components/Overlay.tsx` — shared full-screen dialog: clip-path grows from the trigger button, `inert` page, focus restore

### Deployment
- Vercel, root directory set to `next-app`
- Production URL: https://holladay.fyi (redirects to `www.holladay.fyi`)
- Database (`meeting_summaries.db`) is committed to the repo — no external DB
- Remote: `https://github.com/derrellwilliams/Holladay-Digest.git`

### Conventions
- Motion follows emilkowalski/skills: only transform/opacity/clip-path/filter, no ease-in, keyboard-opened overlays don't animate, `prefers-reduced-motion` falls back to fades
- Easing tokens live in `globals.css` (`--ease-out`, `--ease-in-out`, `--ease-drawer`); `.press` gives buttons the scale(0.97) press
- Mobile (< md): stacked hero → horizontal date strip (pinned to the top) → meetings
- No `Co-Authored-By: Claude` in commit messages

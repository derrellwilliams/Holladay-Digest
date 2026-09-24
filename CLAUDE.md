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
- **Fonts**: Roboto Condensed (`font-display`), Roboto Mono (`font-mono`), Roboto (`font-sans`) via `next/font/google`
- **motion** for spring/exit/gesture animation; plain CSS transitions for everything else
- **@paper-design/shaders-react** `HalftoneDots` renders the hero photo (`public/holladay.jpg`)
- **Node 20.x** pinned in `package.json` `engines` field — required for better-sqlite3 on Vercel

### Architecture
- `lib/db.ts` — all SQLite queries, exports `getMeetings`, `getMeeting`, `getMeetingTypes`, `getMeetingYears`, `getMeetingMonths`
- `lib/meetingColors.ts` — `getCanonicalType`, `getSubtype`
- `lib/utils.ts` — `formatDotDate` (9·19·26), `formatLongDate` (September 22nd, 2026)
- `app/page.tsx` — server component; reads `?m=<id>` and renders the list, hero, and `MeetingPanel`
- `app/actions.ts` — `searchMeetings` server action used by the search overlay
- `app/meetings/[id]/page.tsx` — redirects to `/?m=<id>`
- `components/MeetingPanel.tsx` — client, slide-in panel (AnimatePresence, swipe to dismiss on mobile)
- `components/MeetingSummary.tsx` — server, `renderSummary` parses markdown-like AI summaries
- `components/HalftoneHero.tsx` — shader image + Newsletter/Search buttons, owns overlay state, ⌘K and `/` open search
- `components/Overlay.tsx` — shared full-screen dialog: clip-path grows from the trigger button, `inert` page, focus restore

### Deployment
- Vercel, root directory set to `next-app`
- Production URL: https://holladay.fyi (redirects to `www.holladay.fyi`)
- Database (`meeting_summaries.db`) is committed to the repo — no external DB
- Remote: `https://github.com/derrellwilliams/Holladay-Digest.git`

### Conventions
- Motion follows emilkowalski/skills: only transform/opacity/clip-path/filter, no ease-in, keyboard-opened overlays don't animate, `prefers-reduced-motion` falls back to fades
- Easing tokens live in `globals.css` (`--ease-out`, `--ease-in-out`, `--ease-drawer`); `.press` gives buttons the scale(0.97) press
- Mobile (< md): stacked headline → hero → list; meeting panel is full screen
- No `Co-Authored-By: Claude` in commit messages

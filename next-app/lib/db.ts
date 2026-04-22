import Database from 'better-sqlite3';
import path from 'path';
import { getCanonicalType } from './meetingColors';

export interface Meeting {
  id: number;
  meeting_type: string;
  meeting_date: string | null;
  pdf_url: string;
  summary: string;
  created_at: string;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), '..', 'meeting_summaries.db');
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

export function getMeetings(type?: string, search?: string, year?: string, month?: string): Meeting[] {
  const database = getDb();

  let query = 'SELECT * FROM meeting_summaries WHERE 1=1';
  const params: (string | number)[] = [];

  if (type) {
    query += ' AND meeting_type LIKE ?';
    params.push(`%${type}%`);
  }

  if (year) {
    query += ' AND meeting_date LIKE ?';
    params.push(`%${year}`);
  }

  if (month) {
    query += ' AND meeting_date LIKE ?';
    params.push(`${month}%`);
  }

  query += ' ORDER BY id DESC';

  let rows = database.prepare(query).all(...params) as Meeting[];

  rows.sort((a, b) => {
    const da = a.meeting_date ? new Date(a.meeting_date).getTime() : 0;
    const db2 = b.meeting_date ? new Date(b.meeting_date).getTime() : 0;
    return db2 - da;
  });

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.summary.toLowerCase().includes(q) ||
        r.meeting_type.toLowerCase().includes(q) ||
        (r.meeting_date ?? '').includes(q)
    );
  }

  return rows;
}

export function getMeeting(id: number): Meeting | null {
  const database = getDb();
  const row = database.prepare('SELECT * FROM meeting_summaries WHERE id = ?').get(id) as Meeting | undefined;
  return row ?? null;
}

export function getMeetingTypes(): string[] {
  const database = getDb();
  const rows = database.prepare('SELECT DISTINCT meeting_type FROM meeting_summaries ORDER BY meeting_type').all() as { meeting_type: string }[];
  const seen = new Set<string>();
  for (const { meeting_type } of rows) {
    const canonical = getCanonicalType(meeting_type);
    if (canonical) seen.add(canonical);
  }
  return Array.from(seen).sort();
}

export function getMeetingYears(): string[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT DISTINCT substr(meeting_date, -4) as year FROM meeting_summaries WHERE meeting_date IS NOT NULL ORDER BY year DESC")
    .all() as { year: string }[];
  return rows.map((r) => r.year).filter(Boolean);
}

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getMeetingMonths(): string[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT DISTINCT substr(meeting_date, 1, 3) as month FROM meeting_summaries WHERE meeting_date IS NOT NULL")
    .all() as { month: string }[];
  return rows
    .map((r) => r.month)
    .filter(Boolean)
    .sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
}

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Student } from '../types';

/* ---------------- 電話號碼 ---------------- */

/** 只留數字；886 開頭轉回 0 開頭 */
export function normalizePhone(input: string): string {
  let d = (input ?? '').replace(/[^\d]/g, '');
  if (d.startsWith('886')) d = '0' + d.slice(3);
  return d;
}

export function isValidPhone(key: string): boolean {
  return /^0\d{8,9}$/.test(key);
}

export function maskPhone(key: string): string {
  if (key.length < 6) return key;
  return `${key.slice(0, 4)}***${key.slice(-3)}`;
}

/* ---------------- 讀寫 ---------------- */

const studentDoc = (region: string, phoneKey: string) =>
  doc(db, 'regions', region, 'students', phoneKey);

/** 學員以電話登入：先查索引取得區域，再取學員資料 */
export async function findStudentByPhone(phoneKey: string): Promise<Student | null> {
  const idx = await getDoc(doc(db, 'phones', phoneKey));
  if (!idx.exists()) return null;
  const region = (idx.data() as { region?: string }).region ?? '';
  if (!region) return null;
  const snap = await getDoc(studentDoc(region, phoneKey));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Student), phoneKey, region };
}

export async function listStudentsInRegion(region: string): Promise<Student[]> {
  const snap = await getDocs(collection(db, 'regions', region, 'students'));
  return snap.docs
    .map((d) => ({ ...(d.data() as Student), phoneKey: d.id, region }))
    .sort((a, b) => a.phoneKey.localeCompare(b.phoneKey));
}

export async function listRegions(): Promise<string[]> {
  const snap = await getDocs(collection(db, 'regions'));
  return snap.docs.map((d) => d.id).sort((a, b) => a.localeCompare(b));
}

export async function saveStudent(student: Student): Promise<void> {
  await setDoc(studentDoc(student.region, student.phoneKey), {
    ...student,
    updatedAt: Date.now(),
  });
  await setDoc(doc(db, 'phones', student.phoneKey), {
    region: student.region,
    name: student.name,
  });
}

export async function deleteStudent(region: string, phoneKey: string): Promise<void> {
  const progressSnap = await getDocs(collection(db, 'regions', region, 'students', phoneKey, 'progress'));
  if (!progressSnap.empty) {
    const batch = writeBatch(db);
    progressSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(studentDoc(region, phoneKey));
  await deleteDoc(doc(db, 'phones', phoneKey)).catch(() => undefined);
}

/* ---------------- 名單匯入 ---------------- */

export interface RosterRow {
  studentId: string;
  region: string;
  classroom: string;
  group: string;
  role: string;
  name: string;
  phone: string;
}

const HEADER_MAP: Record<string, keyof RosterRow> = {
  uid: 'studentId',
  id: 'studentId',
  編號: 'studentId',
  學員編號: 'studentId',
  區域: 'region',
  教室: 'classroom',
  組別: 'group',
  身份: 'role',
  身分: 'role',
  姓名: 'name',
  名字: 'name',
  電話: 'phone',
  手機: 'phone',
  手機號碼: 'phone',
};

const DEFAULT_ORDER: (keyof RosterRow)[] = ['studentId', 'region', 'classroom', 'group', 'role', 'name', 'phone'];

function splitLine(line: string, delim: string): string[] {
  if (delim !== ',') return line.split(delim).map((c) => c.trim());
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** 支援 Excel 貼上（Tab）與 CSV；有表頭會自動對欄位，否則照 uid、區域、教室、組別、身份、姓名、電話 */
export function parseRosterText(text: string): { rows: RosterRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ['沒有讀到任何資料'] };

  const delim = lines[0].includes('\t') ? '\t' : ',';
  const first = splitLine(lines[0], delim).map((c) => c.replace(/\s/g, '').toLowerCase());
  const hasHeader = first.some((c) => c in HEADER_MAP);

  let columns: (keyof RosterRow | null)[] = DEFAULT_ORDER.slice();
  let start = 0;
  if (hasHeader) {
    columns = first.map((c) => HEADER_MAP[c] ?? null);
    start = 1;
  }

  const rows: RosterRow[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const cells = splitLine(lines[i], delim);
    const row: RosterRow = { studentId: '', region: '', classroom: '', group: '', role: '', name: '', phone: '' };
    columns.forEach((key, idx) => {
      if (key) row[key] = (cells[idx] ?? '').trim();
    });

    if (!row.phone && !row.name) continue;
    if (!row.name) {
      errors.push(`第 ${i + 1} 列：沒有姓名`);
      continue;
    }
    if (!isValidPhone(normalizePhone(row.phone))) {
      errors.push(`第 ${i + 1} 列「${row.name}」：電話「${row.phone}」格式不對`);
      continue;
    }
    rows.push(row);
  }

  if (rows.length === 0 && errors.length === 0) errors.push('沒有可匯入的資料列');
  return { rows, errors };
}

export interface ImportResult {
  created: number;
  duplicates: string[];
  regionMismatch: string[];
}

/**
 * 匯入名單。region 由呼叫端決定（區域管理員固定為自己的區域，課程管理員可指定）。
 * 檔案裡的「區域」欄若與指定區域不符，會回報但不阻擋。
 */
export async function importRoster(region: string, rows: RosterRow[]): Promise<ImportResult> {
  const byPhone = new Map<string, RosterRow>();
  const duplicates: string[] = [];
  const regionMismatch: string[] = [];

  for (const row of rows) {
    const key = normalizePhone(row.phone);
    if (row.region && row.region.trim() !== region) {
      regionMismatch.push(`${row.name}（檔案寫 ${row.region}）`);
    }
    if (byPhone.has(key)) duplicates.push(`${row.name}（${key}）`);
    byPhone.set(key, row);
  }

  const entries = [...byPhone.entries()];
  let created = 0;
  for (let i = 0; i < entries.length; i += 200) {
    const batch = writeBatch(db);
    for (const [phoneKey, row] of entries.slice(i, i + 200)) {
      batch.set(studentDoc(region, phoneKey), {
        studentId: row.studentId,
        name: row.name,
        phone: row.phone,
        phoneKey,
        region,
        classroom: row.classroom,
        group: row.group,
        role: row.role,
        updatedAt: Date.now(),
      });
      batch.set(doc(db, 'phones', phoneKey), { region, name: row.name }, { merge: true });
      created += 1;
    }
    await batch.commit();
  }

  await setDoc(doc(db, 'regions', region), { name: region, updatedAt: Date.now() }, { merge: true });

  return { created, duplicates, regionMismatch };
}

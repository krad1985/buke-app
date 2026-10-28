import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Student } from '../types';

/* ---------------- 識別碼 ---------------- */

export function normalizeCode(input: string): string {
  return (input ?? '').trim().toUpperCase().replace(/\s/g, '');
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(code);
}

export function normalizePhone(input: string): string {
  let d = (input ?? '').replace(/[^\d]/g, '');
  if (d.startsWith('886')) d = '0' + d.slice(3);
  return d;
}

export function isValidPhone(key: string): boolean {
  return /^0\d{8,9}$/.test(key);
}

/** 學員輸入的代碼或手機 → 查詢用的鍵 */
export function toLookupKey(input: string): string {
  const t = (input ?? '').trim();
  if (!t) return '';
  return /[A-Za-z]/.test(t) ? normalizeCode(t) : normalizePhone(t);
}

/* ---------------- 讀寫 ---------------- */

const studentDoc = (region: string, studentId: string) =>
  doc(db, 'regions', region, 'students', studentId);

/**
 * 登入索引放在 phones 集合（學員代碼與手機都放這裡）。
 * 沿用既有集合名稱，避免為了新增集合而重貼規則。
 */
const indexDoc = (key: string) => doc(db, 'phones', key);

/** 用學員代碼或手機登入 */
export async function findStudentByLogin(input: string): Promise<Student | null> {
  const key = toLookupKey(input);
  if (!key) return null;
  const idx = await getDoc(indexDoc(key));
  if (!idx.exists()) return null;
  const data = idx.data() as { region?: string; studentId?: string };
  const region = data.region ?? '';
  const studentId = data.studentId ?? key;
  if (!region) return null;
  const snap = await getDoc(studentDoc(region, studentId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Student), studentId: snap.id, region };
}

export async function listStudentsInRegion(region: string): Promise<Student[]> {
  const snap = await getDocs(collection(db, 'regions', region, 'students'));
  return snap.docs
    .map((d) => ({ ...(d.data() as Student), studentId: d.id, region }))
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

export async function saveStudent(student: Student): Promise<void> {
  await setDoc(studentDoc(student.region, student.studentId), {
    ...student,
    updatedAt: Date.now(),
  });
  await writeIndexes(student);
}

async function writeIndexes(student: Student): Promise<void> {
  const base = { region: student.region, name: student.name, studentId: student.studentId };
  await setDoc(indexDoc(student.studentId), base, { merge: true });
  const phone = normalizePhone(student.phone ?? '');
  if (phone && isValidPhone(phone)) {
    await setDoc(indexDoc(phone), base, { merge: true });
  }
}

export async function deleteStudent(region: string, studentId: string): Promise<void> {
  const snap = await getDoc(studentDoc(region, studentId)).catch(() => null);
  const phone = normalizePhone((snap?.data() as Student | undefined)?.phone ?? '');

  const progressSnap = await getDocs(
    collection(db, 'regions', region, 'students', studentId, 'progress')
  );
  if (!progressSnap.empty) {
    const batch = writeBatch(db);
    progressSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(studentDoc(region, studentId));
  await deleteDoc(indexDoc(studentId)).catch(() => undefined);
  if (phone) await deleteDoc(indexDoc(phone)).catch(() => undefined);
}

/* ---------------- 名單解析 ---------------- */

export interface RosterRow {
  studentId: string;
  name: string;
  phone: string;
  classroom: string;
  group: string;
  role: string;
}

type ColumnKey = keyof RosterRow | 'groupLarge' | 'groupSmall';

interface XlsxApi {
  read: (
    data: ArrayBuffer,
    opts: { type: 'array' }
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (
      ws: unknown,
      opts: { header: 1; raw: false; defval: string }
    ) => unknown[][];
  };
}

const HEADER_MAP: Record<string, ColumnKey> = {
  學員代碼: 'studentId',
  學員編號: 'studentId',
  編號: 'studentId',
  uid: 'studentId',
  id: 'studentId',
  學員姓名: 'name',
  姓名: 'name',
  名字: 'name',
  手機: 'phone',
  手機號碼: 'phone',
  電話: 'phone',
  行動電話: 'phone',
  母班行政組織: 'classroom',
  教室: 'classroom',
  大組: 'groupLarge',
  小組: 'groupSmall',
  組別: 'groupSmall',
  身份別: 'role',
  身份: 'role',
  身分: 'role',
};

/** 從二維陣列（Excel 工作表）解析名單；自動找表頭列 */
export function parseRosterMatrix(matrix: string[][]): { rows: RosterRow[]; errors: string[] } {
  const errors: string[] = [];
  const clean = matrix.map((r) => (r ?? []).map((c) => String(c ?? '').trim()));

  const headerIndex = clean.findIndex((row) =>
    row.some((cell) => {
      const key = cell.replace(/\s/g, '');
      return key in HEADER_MAP || key.toLowerCase() in HEADER_MAP;
    })
  );
  if (headerIndex < 0) return { rows: [], errors: ['找不到表頭（需要「學員代碼」與「學員姓名」欄）'] };

  const header = clean[headerIndex].map((c) => c.replace(/\s/g, ''));
  const cols: (ColumnKey | null)[] = header.map(
    (c) => HEADER_MAP[c] ?? HEADER_MAP[c.toLowerCase()] ?? null
  );

  const rows: RosterRow[] = [];
  for (let i = headerIndex + 1; i < clean.length; i += 1) {
    const cells = clean[i];
    if (!cells.some(Boolean)) continue;

    const pick = (key: ColumnKey): string => {
      const idx = cols.indexOf(key);
      return idx >= 0 ? cells[idx] ?? '' : '';
    };

    const studentId = normalizeCode(pick('studentId'));
    const name = pick('name');
    if (!studentId && !name) continue;

    if (!studentId) {
      errors.push(`第 ${i + 1} 列「${name}」：沒有學員代碼`);
      continue;
    }
    if (!isValidCode(studentId)) {
      errors.push(`第 ${i + 1} 列：學員代碼「${pick('studentId')}」格式不對`);
      continue;
    }
    if (!name) {
      errors.push(`第 ${i + 1} 列（${studentId}）：沒有姓名`);
      continue;
    }

    const rawPhone = pick('phone');
    const phone = normalizePhone(rawPhone);
    if (rawPhone && !isValidPhone(phone)) {
      errors.push(`第 ${i + 1} 列（${name}）：手機「${rawPhone}」格式不對，已略過手機欄位`);
    }

    const big = pick('groupLarge');
    const small = pick('groupSmall');
    rows.push({
      studentId,
      name,
      phone: isValidPhone(phone) ? phone : '',
      classroom: pick('classroom'),
      group: big && small ? `${big}-${small}` : big || small,
      role: pick('role'),
    });
  }

  if (rows.length === 0 && errors.length === 0) errors.push('沒有可匯入的資料列');
  return { rows, errors };
}

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
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseRosterText(text: string): { rows: RosterRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: ['沒有資料'] };
  const delim = lines[0].includes('\t') ? '\t' : ',';
  return parseRosterMatrix(lines.map((l) => splitLine(l, delim)));
}

export async function parseRosterFile(file: File): Promise<{ rows: RosterRow[]; errors: string[] }> {
  if (/\.(csv|txt)$/i.test(file.name)) {
    return parseRosterText(await file.text());
  }
  const mod = (await import('xlsx')) as unknown as { default?: XlsxApi };
  const XLSX: XlsxApi = mod.default ?? (mod as unknown as XlsxApi);
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], errors: ['檔案裡沒有工作表'] };
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  return parseRosterMatrix(matrix as string[][]);
}

export interface ImportResult {
  created: number;
  duplicates: string[];
}

export async function importRoster(region: string, rows: RosterRow[]): Promise<ImportResult> {
  const byId = new Map<string, RosterRow>();
  const duplicates: string[] = [];
  for (const row of rows) {
    if (byId.has(row.studentId)) duplicates.push(`${row.name}（${row.studentId}）`);
    byId.set(row.studentId, row);
  }

  const entries = [...byId.entries()];
  let created = 0;
  for (let i = 0; i < entries.length; i += 200) {
    const batch = writeBatch(db);
    for (const [studentId, row] of entries.slice(i, i + 200)) {
      const index = { region, name: row.name, studentId };
      batch.set(studentDoc(region, studentId), {
        studentId,
        name: row.name,
        phone: row.phone || '',
        region,
        classroom: row.classroom,
        group: row.group,
        role: row.role,
        updatedAt: Date.now(),
      });
      batch.set(indexDoc(studentId), index, { merge: true });
      if (row.phone) batch.set(indexDoc(row.phone), index, { merge: true });
      created += 1;
    }
    await batch.commit();
  }

  await setDoc(doc(db, 'regions', region), { name: region, updatedAt: Date.now() }, { merge: true });
  return { created, duplicates };
}

import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
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
  const keys = phoneCandidates(input);
  const local = keys.find((k) => /^0\d{8,9}$/.test(k));
  return local ?? keys[0] ?? '';
}

export function isValidPhone(key: string): boolean {
  return /^0\d{8,9}$/.test(key) || /^\d{8,15}$/.test(key);
}

/**
 * 手機的查詢候選鍵：台灣號碼同時產生「0 開頭」與「886 開頭」兩種，
 * 國外號碼保留國碼數字。匯入時全部建索引，登入時逐一嘗試。
 */
export function phoneCandidates(input: string): string[] {
  const d = (input ?? '').replace(/[^\d]/g, '');
  if (!d) return [];
  const out = new Set<string>();
  if (d.startsWith('886') && d.length > 3) {
    out.add('0' + d.slice(3));
    out.add(d);
  } else if (d.startsWith('0')) {
    out.add(d);
    out.add('886' + d.slice(1));
  } else {
    out.add(d);
  }
  return [...out];
}

/** 學員輸入的代碼或手機 → 查詢用的鍵（手機可能有多種寫法） */
export function lookupKeys(input: string): string[] {
  const t = (input ?? '').trim();
  if (!t) return [];
  if (/[A-Za-z]/.test(t)) return [normalizeCode(t)];
  return phoneCandidates(t);
}

export function toLookupKey(input: string): string {
  return lookupKeys(input)[0] ?? '';
}

/* ---------------- 讀寫 ---------------- */

const studentDoc = (region: string, studentId: string) =>
  doc(db, 'regions', region, 'students', studentId);

/** 公開投影：學員端（未登入）只能讀這份，不含電話與其他原始欄位 */
const publicDoc = (region: string, studentId: string) =>
  doc(db, 'rosterPublic', region, 'students', studentId);

const classroomKeyOf = (region: string, classroom: string) => region + '/' + classroom;

const publicPayload = (s: {
  studentId: string;
  name: string;
  region: string;
  classroom: string;
  groupLarge: string;
  groupSmall: string;
  role: string;
}) => ({
  studentId: s.studentId,
  name: s.name,
  region: s.region,
  classroom: s.classroom,
  groupLarge: s.groupLarge,
  groupSmall: s.groupSmall,
  role: s.role,
});

/**
 * 登入索引放在 phones 集合（學員代碼與手機都放這裡）。
 * 沿用既有集合名稱，避免為了新增集合而重貼規則。
 */
const indexDoc = (key: string) => doc(db, 'phones', key);

/** 用學員代碼或手機登入（手機接受帶不帶國碼） */
export async function findStudentByLogin(input: string): Promise<Student | null> {
  const keys = lookupKeys(input);
  for (const key of keys) {
    if (!key) continue;
    const idx = await getDoc(indexDoc(key));
    if (!idx.exists()) continue;
    const data = idx.data() as { region?: string; studentId?: string };
    const region = data.region ?? '';
    const studentId = data.studentId ?? key;
    if (!region) continue;
    const snap = await getDoc(publicDoc(region, studentId));
    if (!snap.exists()) continue;
    return normalizeStudent({ ...(snap.data() as Student), studentId: snap.id, region });
  }
  return null;
}

function normalizeStudent(s: Student): Student {
  return {
    ...s,
    groupLarge: s.groupLarge ?? '',
    groupSmall: s.groupSmall ?? '',
    seriesIds: Array.isArray(s.seriesIds) ? s.seriesIds : [],
    extra: s.extra && typeof s.extra === 'object' ? s.extra : {},
  };
}

export async function listStudentsInRegion(region: string, classroom?: string): Promise<Student[]> {
  const base = collection(db, 'regions', region, 'students');
  const snap = await getDocs(
    classroom ? query(base, where('classroomKey', '==', classroomKeyOf(region, classroom))) : base
  );
  return snap.docs
    .map((d) => normalizeStudent({ ...(d.data() as Student), studentId: d.id, region }))
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

/** 學員端用：讀公開投影（不含電話） */
export async function listPublicStudentsInRegion(region: string): Promise<Student[]> {
  const snap = await getDocs(collection(db, 'rosterPublic', region, 'students'));
  return snap.docs
    .map((d) => normalizeStudent({ ...(d.data() as Student), studentId: d.id, region }))
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

export async function saveStudent(student: Student, previousPhone?: string): Promise<void> {
  await setDoc(studentDoc(student.region, student.studentId), {
    ...student,
    classroomKey: classroomKeyOf(student.region, student.classroom),
    updatedAt: Date.now(),
  });
  await setDoc(
    publicDoc(student.region, student.studentId),
    { ...publicPayload(student), seriesIds: student.seriesIds ?? [] },
    { merge: true }
  );
  await writeIndexes(student);

  const oldKeys = phoneCandidates(previousPhone ?? '');
  const newKeys = phoneCandidates(student.phone ?? '');
  for (const key of oldKeys) {
    if (key && !newKeys.includes(key)) await deleteDoc(indexDoc(key)).catch(() => undefined);
  }
}

async function writeIndexes(student: Student): Promise<void> {
  const base = { region: student.region, name: student.name, studentId: student.studentId };
  await setDoc(indexDoc(student.studentId), base, { merge: true });
  for (const key of phoneCandidates(student.phone ?? '')) {
    if (key && isValidPhone(key)) await setDoc(indexDoc(key), base, { merge: true });
  }
}

export async function deleteStudent(region: string, studentId: string): Promise<void> {
  const snap = await getDoc(studentDoc(region, studentId)).catch(() => null);
  const phones = phoneCandidates((snap?.data() as Student | undefined)?.phone ?? '');

  const progressSnap = await getDocs(
    collection(db, 'regions', region, 'students', studentId, 'progress')
  );
  if (!progressSnap.empty) {
    const batch = writeBatch(db);
    progressSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(studentDoc(region, studentId));
  await deleteDoc(publicDoc(region, studentId)).catch(() => undefined);
  await deleteDoc(indexDoc(studentId)).catch(() => undefined);
  for (const key of phones) await deleteDoc(indexDoc(key)).catch(() => undefined);
}

/** 批次刪除（同時清掉進度與登入索引） */
export async function deleteStudents(region: string, studentIds: string[]): Promise<void> {
  const chunk = 4;
  for (let i = 0; i < studentIds.length; i += chunk) {
    await Promise.all(studentIds.slice(i, i + chunk).map((id) => deleteStudent(region, id)));
  }
}

/* ---------------- 名單解析 ---------------- */

export interface RosterRow {
  studentId: string;
  name: string;
  phone: string;
  classroom: string;
  groupLarge: string;
  groupSmall: string;
  role: string;
  /** 未對應到標準欄位的其他欄位（原樣保留） */
  extra: Record<string, string>;
}

type ColumnKey = keyof RosterRow;

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
  聯絡電話: 'phone',
  連絡電話: 'phone',
  母班行政組織: 'classroom',
  教室: 'classroom',
  大組: 'groupLarge',
  小組: 'groupSmall',
  組別: 'groupSmall',
  身份別: 'role',
  身份: 'role',
  身分: 'role',
};

interface XlsxApi {
  read: (
    data: ArrayBuffer,
    opts: { type: 'array' }
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (ws: unknown, opts: { header: 1; raw: false; defval: string }) => unknown[][];
  };
}

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

    // 未對應到標準欄位的欄位，原樣保留（儲訓類別、初培重培…）
    const extra: Record<string, string> = {};
    header.forEach((title, idx) => {
      if (!title || cols[idx]) return;
      const value = (cells[idx] ?? '').trim();
      if (value) extra[title] = value;
    });

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
    // 表頭沒對到（或欄位空白）時，掃描整列找手機樣式
    const fallbackPhone =
      rawPhone ||
      cells.map((c) => c.trim()).find((c) => /^[\s'’"`]*0\d{8,9}$/.test(c)) ||
      '';
    const phone = normalizePhone(fallbackPhone);
    if (fallbackPhone && !isValidPhone(phone)) {
      errors.push(`第 ${i + 1} 列（${name}）：手機「${fallbackPhone}」格式不對，已略過手機欄位`);
    }

    rows.push({
      studentId,
      name,
      phone: isValidPhone(phone) ? phone : '',
      classroom: pick('classroom'),
      groupLarge: pick('groupLarge'),
      groupSmall: pick('groupSmall'),
      role: pick('role'),
      extra,
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

/** 補齊既有名單的公開投影與 classroomKey（一次性） */
export async function backfillRosters(): Promise<number> {
  const regionSnap = await getDocs(collection(db, 'regions'));
  let total = 0;
  for (const r of regionSnap.docs) {
    const students = await listStudentsInRegion(r.id);
    for (const s of students) {
      await setDoc(
        studentDoc(r.id, s.studentId),
        { classroomKey: classroomKeyOf(r.id, s.classroom) },
        { merge: true }
      );
      await setDoc(
        publicDoc(r.id, s.studentId),
        { ...publicPayload({ ...s, region: r.id }), seriesIds: s.seriesIds ?? [] },
        { merge: true }
      );
      total += 1;
    }
  }
  return total;
}

export interface ImportOptions {
  /** 指定系列（會被加入學員的 seriesIds，不覆蓋既有系列） */
  seriesId?: string;
  /** 教室窗口匯入時鎖定教室 */
  classroom?: string;
}

export async function importRoster(
  region: string,
  rows: RosterRow[],
  options: ImportOptions = {}
): Promise<ImportResult> {
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
      batch.set(
        studentDoc(region, studentId),
        {
          studentId,
          name: row.name,
          phone: row.phone || '',
          region,
          classroom: options.classroom || row.classroom,
          classroomKey: classroomKeyOf(region, options.classroom || row.classroom),
          groupLarge: row.groupLarge,
          groupSmall: row.groupSmall,
          role: row.role,
          extra: row.extra,
          updatedAt: Date.now(),
          ...(options.seriesId ? { seriesIds: arrayUnion(options.seriesId) } : {}),
        },
        { merge: true }
      );
      batch.set(indexDoc(studentId), index, { merge: true });
      for (const key of phoneCandidates(row.phone)) {
        if (key) batch.set(indexDoc(key), index, { merge: true });
      }
      batch.set(
        publicDoc(region, studentId),
        {
          ...publicPayload({
            studentId,
            name: row.name,
            region,
            classroom: options.classroom || row.classroom,
            groupLarge: row.groupLarge,
            groupSmall: row.groupSmall,
            role: row.role,
          }),
          ...(options.seriesId ? { seriesIds: arrayUnion(options.seriesId) } : {}),
        },
        { merge: true }
      );
      created += 1;
    }
    await batch.commit();
  }

  await setDoc(doc(db, 'regions', region), { name: region, updatedAt: Date.now() }, { merge: true });
  return { created, duplicates };
}

import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isRegionName } from './regions';
import type { AdminGrant, AdminProfile } from '../types';

/**
 * 管理員資料存在 admins/{帳號}。
 *
 * 一個帳號可以有多個「權限」（grants），登入後切換身分；
 * 文件只存 superAdmin 與 grants，role/region/classroom/seriesIds
 * 是讀取時依目前身分推導出來的，不寫回資料庫。
 */
const SESSION_KEY = 'buke.admin.session.v2';

const adminRef = (account: string) => doc(db, 'admins', account.trim().toLowerCase());

const rid = () => Math.random().toString(36).slice(2, 8);

export function applyActive(profile: AdminProfile, activeGrantId: string | null): AdminProfile {
  if (profile.superAdmin && (activeGrantId === '__super' || !profile.grants.length)) {
    return { ...profile, role: 'super', region: '', classroom: '', seriesIds: [] };
  }
  const grant =
    profile.grants.find((g) => g.id === activeGrantId) ?? profile.grants[0] ?? null;
  if (!grant) {
    return { ...profile, role: profile.superAdmin ? 'super' : 'classroom', region: '', classroom: '', seriesIds: [] };
  }
  return {
    ...profile,
    role: grant.role,
    region: grant.region,
    classroom: grant.classroom,
    seriesIds: grant.seriesIds,
  };
}

/** 舊資料（單一 role）轉成 grants */
export function normalizeProfile(raw: Record<string, unknown>, activeGrantId: string | null = null): AdminProfile {
  const legacyRole = raw.role as string | undefined;
  const superAdmin = raw.superAdmin === true || legacyRole === 'super' || legacyRole === 'course';

  let grants: AdminGrant[] = Array.isArray(raw.grants)
    ? (raw.grants as AdminGrant[]).map((g) => ({ ...g, id: g.id ?? rid() }))
    : [];

  if (grants.length === 0 && legacyRole && legacyRole !== 'super' && legacyRole !== 'course') {
    grants = [
      {
        id: rid(),
        role: legacyRole as AdminGrant['role'],
        region: (raw.region as string) ?? '',
        classroom: (raw.classroom as string) ?? '',
        seriesIds: Array.isArray(raw.seriesIds) ? (raw.seriesIds as string[]) : [],
      },
    ];
  }

  const base: AdminProfile = {
    account: (raw.account as string) ?? '',
    name: (raw.name as string) ?? '',
    pass: (raw.pass as string) ?? '',
    enabled: raw.enabled !== false,
    superAdmin,
    grants,
    role: 'super',
    region: '',
    classroom: '',
    seriesIds: [],
  };
  return applyActive(base, activeGrantId);
}

export function loadSessionState(): { profile: AdminProfile; activeGrantId: string | null } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { profile: Record<string, unknown>; activeGrantId: string | null };
    return { profile: normalizeProfile(saved.profile, saved.activeGrantId), activeGrantId: saved.activeGrantId };
  } catch {
    return null;
  }
}

export function loadSession(): AdminProfile | null {
  return loadSessionState()?.profile ?? null;
}

export function saveSession(profile: AdminProfile, activeGrantId: string | null): void {
  try {
    const { role, region, classroom, seriesIds, ...rest } = profile;
    void role;
    void region;
    void classroom;
    void seriesIds;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ profile: rest, activeGrantId }));
  } catch {
    /* 無痕模式 */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* 無痕模式 */
  }
}

/** 資料庫裡完全沒有管理員時，建立預設的 admin 帳號 */
export async function ensureDefaultAdmin(): Promise<void> {
  const snap = await getDocs(collection(db, 'admins'));
  if (!snap.empty) return;
  await setDoc(doc(db, 'admins', 'admin'), {
    account: 'admin',
    name: '系統管理員',
    role: 'super',
    superAdmin: true,
    grants: [],
    enabled: true,
    pass: 'admin',
    updatedAt: Date.now(),
  });
}

export async function loginAdmin(account: string, pass: string): Promise<AdminProfile> {
  const key = account.trim().toLowerCase();
  if (!key) throw new Error('請輸入帳號。');
  const snap = await getDoc(adminRef(key));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const raw = snap.data() as Record<string, unknown>;
  const profile = normalizeProfile({ ...raw, account: key }, null);
  if (profile.enabled === false) throw new Error('這個帳號已被停用，請聯繫總管理員。');
  if (profile.pass !== pass) throw new Error('密碼不正確。');
  saveSession(profile, profile.superAdmin ? '__super' : null);
  return profile;
}

export async function listAdmins(): Promise<AdminProfile[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs
    .map((d) => normalizeProfile({ ...(d.data() as Record<string, unknown>), account: d.id }))
    .sort((a, b) => a.account.localeCompare(b.account));
}

const ACCOUNT_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;

export interface NewAdminInput {
  account: string;
  name: string;
  pass: string;
  superAdmin: boolean;
  grants: Omit<AdminGrant, 'id'>[];
}

function validateGrant(grant: Omit<AdminGrant, 'id'>): void {
  if (grant.role === 'series' && grant.seriesIds.length === 0) {
    throw new Error('系列管理員至少要指定一個系列。');
  }
  if ((grant.role === 'region' || grant.role === 'classroom') && !isRegionName(grant.region)) {
    throw new Error('請指定一個有效區域。');
  }
  if (grant.role === 'classroom' && !grant.classroom.trim()) {
    throw new Error('教室窗口必須指定教室。');
  }
}

export async function createAdmin(input: NewAdminInput): Promise<void> {
  const account = input.account.trim().toLowerCase();
  if (!ACCOUNT_RE.test(account)) {
    throw new Error('帳號需為 3–20 個英數字（可用 . _ -），不能有中文或空白。');
  }
  if (!input.pass.trim()) throw new Error('請設定登入密碼。');
  if (!input.superAdmin && input.grants.length === 0) throw new Error('至少要給一個權限。');
  for (const g of input.grants) validateGrant(g);

  const snap = await getDoc(adminRef(account));
  if (snap.exists()) throw new Error('這個帳號已經有人使用。');

  await setDoc(adminRef(account), {
    account,
    name: input.name.trim() || account,
    superAdmin: input.superAdmin,
    grants: input.grants.map((g) => ({ ...g, id: rid() })),
    enabled: true,
    pass: input.pass,
    updatedAt: Date.now(),
  });
}

export async function addGrant(account: string, grant: Omit<AdminGrant, 'id'>): Promise<void> {
  validateGrant(grant);
  const snap = await getDoc(adminRef(account));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const profile = normalizeProfile({ ...(snap.data() as Record<string, unknown>), account });
  await updateDoc(adminRef(account), {
    grants: [...profile.grants, { ...grant, id: rid() }],
    updatedAt: Date.now(),
  });
}

export async function removeGrant(account: string, grantId: string): Promise<void> {
  const snap = await getDoc(adminRef(account));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const profile = normalizeProfile({ ...(snap.data() as Record<string, unknown>), account });
  const grants = profile.grants.filter((g) => g.id !== grantId);
  if (grants.length === 0 && !profile.superAdmin) {
    throw new Error('至少要保留一個權限；不用了就停用帳號。');
  }
  await updateDoc(adminRef(account), { grants, updatedAt: Date.now() });
}

export async function setAdminEnabled(account: string, enabled: boolean): Promise<void> {
  await updateDoc(adminRef(account), { enabled });
}

export async function resetAdminPassword(account: string, newPass: string): Promise<void> {
  if (!newPass.trim()) throw new Error('請輸入新密碼。');
  await updateDoc(adminRef(account), { pass: newPass, updatedAt: Date.now() });
}

export async function removeAdmin(account: string): Promise<void> {
  await deleteDoc(adminRef(account));
}

export async function changeMyPassword(
  account: string,
  oldPass: string,
  newPass: string
): Promise<AdminProfile> {
  const snap = await getDoc(adminRef(account));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const profile = normalizeProfile({ ...(snap.data() as Record<string, unknown>), account });
  if (profile.pass !== oldPass) throw new Error('目前密碼不正確。');
  if (!newPass.trim()) throw new Error('新密碼不可空白。');
  await updateDoc(adminRef(account), { pass: newPass, updatedAt: Date.now() });
  return { ...profile, pass: newPass };
}

export function roleLabel(p: AdminProfile): string {
  switch (p.role) {
    case 'super':
      return '總管理員';
    case 'series':
      return '系列管理員';
    case 'region':
      return `區域窗口（${p.region}）`;
    case 'classroom':
      return `教室窗口（${p.region}／${p.classroom}）`;
    default:
      return '';
  }
}

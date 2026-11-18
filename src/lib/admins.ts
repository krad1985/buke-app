import { deleteApp, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { isRegionName } from './regions';
import type { AdminGrant, AdminProfile, AdminRequest } from '../types';

/**
 * 管理員：Firebase Auth（email + password）+ admins/{uid} 存放角色與範圍。
 * 規則以 request.auth.uid 判斷管理權限，因此「改資料」在伺服器端就被擋住。
 */
const adminRef = (uid: string) => doc(db, 'admins', uid);

const rid = () => Math.random().toString(36).slice(2, 8);

export function applyActive(profile: AdminProfile, activeGrantId: string | null): AdminProfile {
  if (profile.superAdmin && (activeGrantId === '__super' || !profile.grants.length)) {
    return { ...profile, role: 'super', region: '', classroom: '', seriesIds: [] };
  }
  const grant =
    profile.grants.find((g) => g.id === activeGrantId) ?? profile.grants[0] ?? null;
  if (!grant) {
    return {
      ...profile,
      role: profile.superAdmin ? 'super' : 'classroom',
      region: '',
      classroom: '',
      seriesIds: [],
    };
  }
  return {
    ...profile,
    role: grant.role,
    region: grant.region,
    classroom: grant.classroom,
    seriesIds: grant.seriesIds,
  };
}

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

  const managedRegions = Array.isArray(raw.managedRegions)
    ? (raw.managedRegions as string[])
    : [...new Set(grants.map((g) => g.region).filter(Boolean))];

  const base: AdminProfile = {
    account: (raw.account as string) ?? '',
    email: (raw.email as string) ?? '',
    name: (raw.name as string) ?? '',
    enabled: raw.enabled !== false,
    pending: raw.pending === true,
    request: (raw.request as AdminRequest | undefined) ?? undefined,
    managedRegions,
    superAdmin,
    grants,
    role: 'super',
    region: '',
    classroom: '',
    seriesIds: [],
  };
  return applyActive(base, activeGrantId);
}

export async function loadProfile(uid: string): Promise<AdminProfile | null> {
  const snap = await getDoc(adminRef(uid));
  if (!snap.exists()) return null;
  return normalizeProfile({ ...(snap.data() as Record<string, unknown>), account: uid });
}

export function watchAuth(cb: (uid: string | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => cb(user?.uid ?? null));
}

export async function loginAdmin(email: string, pass: string): Promise<AdminProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const profile = await loadProfile(cred.user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error('這個帳號還沒有設定權限，請聯絡總管理員。');
  }
  if (profile.enabled === false) {
    await signOut(auth);
    throw new Error('這個帳號已被停用。');
  }
  return profile;
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
}

/** 第一次使用：建立最高權限帳號，並放下 bootstrap 標記 */
export async function bootstrapAdmin(email: string, pass: string, name: string): Promise<AdminProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const uid = cred.user.uid;
  await setDoc(adminRef(uid), {
    account: uid,
    email: email.trim(),
    name: name.trim() || '系統管理員',
    superAdmin: true,
    grants: [],
    managedRegions: [],
    enabled: true,
    createdAt: Date.now(),
  });
  await setDoc(doc(db, 'config', 'admin_root'), { createdAt: Date.now() }).catch(() => undefined);
  return normalizeProfile({
    account: uid,
    email: email.trim(),
    name: name.trim() || '系統管理員',
    superAdmin: true,
    grants: [],
    enabled: true,
  });
}

/** 用第二個 App 建立帳號，避免把目前登入者擠掉 */
async function createAuthAccount(email: string, pass: string): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `creator-${Math.random().toString(36).slice(2, 9)}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), pass);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondary).catch(() => undefined);
  }
}

export interface NewAdminInput {
  email: string;
  pass: string;
  name: string;
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new Error('請填有效的電子郵件。');
  }
  if (input.pass.length < 6) throw new Error('密碼至少 6 個字元。');
  if (!input.superAdmin && input.grants.length === 0) throw new Error('至少要給一個權限。');
  for (const g of input.grants) validateGrant(g);

  const uid = await createAuthAccount(input.email, input.pass);
  await setDoc(adminRef(uid), {
    account: uid,
    email: input.email.trim(),
    name: input.name.trim() || input.email.trim(),
    superAdmin: input.superAdmin,
    grants: input.grants.map((g) => ({ ...g, id: rid() })),
    managedRegions: [...new Set(input.grants.map((g) => g.region).filter(Boolean))],
    enabled: true,
    createdAt: Date.now(),
  });
}

/** 自助註冊：建立帳號並留下待核准的申請 */
export async function registerAdmin(
  email: string,
  pass: string,
  name: string,
  request: AdminRequest
): Promise<AdminProfile> {
  if (pass.length < 6) throw new Error('密碼至少 6 個字元。');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const uid = cred.user.uid;
  const docData = {
    account: uid,
    email: email.trim(),
    name: name.trim() || email.trim(),
    superAdmin: false,
    grants: [],
    managedRegions: [],
    enabled: false,
    pending: true,
    request,
    createdAt: Date.now(),
  };
  try {
    await setDoc(adminRef(uid), docData);
  } catch (err) {
    await signOut(auth).catch(() => undefined);
    throw err;
  }
  return normalizeProfile(docData);
}

/** 核准：把申請的範圍變成實際權限 */
export async function approveAdmin(account: string): Promise<void> {
  const snap = await getDoc(adminRef(account));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const profile = normalizeProfile({ ...(snap.data() as Record<string, unknown>), account });
  const req = profile.request;
  if (!req) throw new Error('這筆申請沒有填寫權限範圍。');

  const grant: AdminGrant = {
    id: rid(),
    role: req.role,
    region: req.role === 'series' ? '' : req.region,
    classroom: req.role === 'classroom' ? req.classroom : '',
    seriesIds: req.role === 'series' ? req.seriesIds : [],
  };
  validateGrant(grant);

  await updateDoc(adminRef(account), {
    grants: [grant],
    managedRegions: [grant.region].filter(Boolean),
    enabled: true,
    pending: false,
    approvedAt: Date.now(),
  });
}

export async function rejectAdmin(account: string): Promise<void> {
  await deleteDoc(adminRef(account));
}

export async function listPendingAdmins(): Promise<AdminProfile[]> {
  const all = await listAdmins();
  return all.filter((a) => a.pending === true);
}

export async function listAdmins(): Promise<AdminProfile[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs
    .map((d) => normalizeProfile({ ...(d.data() as Record<string, unknown>), account: d.id }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function addGrant(account: string, grant: Omit<AdminGrant, 'id'>): Promise<void> {
  validateGrant(grant);
  const snap = await getDoc(adminRef(account));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const profile = normalizeProfile({ ...(snap.data() as Record<string, unknown>), account });
  await updateDoc(adminRef(account), {
    grants: [...profile.grants, { ...grant, id: rid() }],
    managedRegions: [...new Set([...profile.grants, grant].map((g) => g.region).filter(Boolean))],
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
  await updateDoc(adminRef(account), {
    grants,
    managedRegions: [...new Set(grants.map((g) => g.region).filter(Boolean))],
    updatedAt: Date.now(),
  });
}

export async function setAdminEnabled(account: string, enabled: boolean): Promise<void> {
  await updateDoc(adminRef(account), { enabled });
}

/** 重設他人密碼：寄送 Firebase 的密碼重設信 */
export async function sendResetEmail(email: string): Promise<void> {
  if (!email) throw new Error('這個帳號沒有電子郵件。');
  await sendPasswordResetEmail(auth, email);
}

export async function removeAdmin(account: string): Promise<void> {
  await deleteDoc(adminRef(account));
}

/* ---------------- 追加權限申請 ---------------- */

export interface ExtraRequest extends Omit<AdminGrant, 'id'> {
  id: string;
  note: string;
  at: number;
}

export interface ExtraRequestDoc {
  uid: string;
  email: string;
  name: string;
  items: ExtraRequest[];
}

const reqRef = (uid: string) => doc(db, 'adminRequests', uid);

export async function submitExtraRequest(
  uid: string,
  email: string,
  name: string,
  req: Omit<AdminGrant, 'id'> & { note: string }
): Promise<void> {
  validateGrant(req);
  const snap = await getDoc(reqRef(uid)).catch(() => null);
  const existing = (snap?.data() as { items?: ExtraRequest[] } | undefined)?.items ?? [];
  const item: ExtraRequest = { ...req, id: rid(), at: Date.now() };
  await setDoc(reqRef(uid), { uid, email, name, items: [...existing, item] }, { merge: true });
}

export async function listExtraRequests(): Promise<ExtraRequestDoc[]> {
  const snap = await getDocs(collection(db, 'adminRequests'));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<ExtraRequestDoc, 'uid'>) }))
    .filter((d) => Array.isArray(d.items) && d.items.length > 0);
}

export async function approveExtraRequest(uid: string, itemId: string): Promise<void> {
  const snap = await getDoc(reqRef(uid));
  const items = (snap.data() as { items?: ExtraRequest[] } | undefined)?.items ?? [];
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new Error('找不到這筆申請。');
  await addGrant(uid, {
    role: item.role,
    region: item.region,
    classroom: item.classroom,
    seriesIds: item.seriesIds,
  });
  await setDoc(reqRef(uid), { items: items.filter((i) => i.id !== itemId) }, { merge: true });
}

export async function rejectExtraRequest(uid: string, itemId: string): Promise<void> {
  const snap = await getDoc(reqRef(uid));
  const items = (snap.data() as { items?: ExtraRequest[] } | undefined)?.items ?? [];
  await setDoc(reqRef(uid), { items: items.filter((i) => i.id !== itemId) }, { merge: true });
}

export async function changeMyPassword(oldPass: string, newPass: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('尚未登入。');
  if (newPass.length < 6) throw new Error('新密碼至少 6 個字元。');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPass));
  await updatePassword(user, newPass);
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

export function authMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '電子郵件或密碼不正確。';
    case 'auth/email-already-in-use':
      return '這個電子郵件已經有人使用。';
    case 'auth/weak-password':
      return '密碼至少 6 個字元。';
    case 'auth/invalid-email':
      return '電子郵件格式不正確。';
    case 'auth/too-many-requests':
      return '嘗試次數過多，請稍後再試。';
    case 'auth/operation-not-allowed':
      return '尚未啟用「電子郵件/密碼」登入方式，請先到 Firebase Console 開啟。';
    case 'auth/requires-recent-login':
      return '請重新登入後再改密碼。';
    default:
      return '操作失敗（' + code + '）。';
  }
}

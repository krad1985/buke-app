import { deleteApp, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  reauthenticateWithCredential,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { ADMIN_ACCOUNT, auth, db, firebaseConfig } from './firebase';
import { isRegionName } from './regions';
import type { AdminProfile, AdminRole } from '../types';

const emailOf = (account: string) => `${account}@buke.local`;

/** 帳號 → 實際登入信箱（帳號對照表公開可讀，內容不含密碼） */
export async function resolveLoginEmail(account: string): Promise<string> {
  const key = account.trim().toLowerCase();
  if (key === 'admin') return ADMIN_ACCOUNT;
  const snap = await getDoc(doc(db, 'accounts', key));
  if (!snap.exists()) throw new Error('NO_ACCOUNT');
  return (snap.data() as { authEmail: string }).authEmail;
}

export async function loginAdmin(account: string, password: string): Promise<void> {
  const email = await resolveLoginEmail(account);
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
  await signInAnonymously(auth).catch(() => undefined);
}

/** 讀取目前登入者的管理權限 */
export async function loadMyProfile(): Promise<AdminProfile> {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_SIGNED_IN');

  if (user.email === ADMIN_ACCOUNT) {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    if (snap.exists()) {
      return { uid: user.uid, ...(snap.data() as Omit<AdminProfile, 'uid'>) };
    }
    return {
      uid: user.uid,
      account: 'admin',
      name: '系統管理員',
      role: 'course',
      region: '',
      enabled: true,
      authEmail: ADMIN_ACCOUNT,
    };
  }

  const snap = await getDoc(doc(db, 'admins', user.uid));
  if (!snap.exists()) throw new Error('NO_PERMISSION');
  const data = snap.data() as Omit<AdminProfile, 'uid'>;
  if (data.enabled === false) throw new Error('DISABLED');
  return { uid: user.uid, ...data };
}

/** 第一次使用：建立根管理員（admin 帳號） */
export async function bootstrapRootAdmin(password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, ADMIN_ACCOUNT, password);
  await setDoc(doc(db, 'admins', cred.user.uid), {
    account: 'admin',
    name: '系統管理員',
    role: 'course',
    region: '',
    enabled: true,
    authEmail: ADMIN_ACCOUNT,
    createdAt: Date.now(),
  });
}

/** 用第二個 App 實例建立帳號，避免把目前登入的管理員擠掉 */
async function createAuthAccount(email: string, password: string): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `creator-${Math.random().toString(36).slice(2, 9)}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondary).catch(() => undefined);
  }
}

export interface NewAdminInput {
  account: string;
  name: string;
  role: AdminRole;
  region: string;
  password: string;
}

const ACCOUNT_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;

export async function createAdmin(input: NewAdminInput): Promise<void> {
  const account = input.account.trim().toLowerCase();
  if (!ACCOUNT_RE.test(account)) {
    throw new Error('帳號需為 3–20 個英數字（可用 . _ -），且不能有中文或空白。');
  }
  if (account === 'admin') throw new Error('「admin」是保留帳號。');
  if (input.password.length < 6) throw new Error('密碼至少 6 個字元。');
  if (input.role === 'region' && !isRegionName(input.region)) throw new Error('區域管理員必須指定一個有效區域。');

  const exists = await getDoc(doc(db, 'accounts', account));
  if (exists.exists()) throw new Error('這個帳號已經有人使用。');

  const email = emailOf(account);
  const uid = await createAuthAccount(email, input.password);

  await setDoc(doc(db, 'admins', uid), {
    account,
    name: input.name.trim() || account,
    role: input.role,
    region: input.role === 'region' ? input.region.trim() : '',
    enabled: true,
    authEmail: email,
    createdAt: Date.now(),
  });
  await setDoc(doc(db, 'accounts', account), {
    uid,
    authEmail: email,
    name: input.name.trim() || account,
    role: input.role,
    region: input.role === 'region' ? input.region.trim() : '',
  });
}

export async function listAdmins(): Promise<AdminProfile[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs
    .map((d) => ({ uid: d.id, ...(d.data() as Omit<AdminProfile, 'uid'>) }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.account.localeCompare(b.account));
}

export async function setAdminEnabled(uid: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, 'admins', uid), { enabled });
}

export async function removeAdmin(profile: AdminProfile): Promise<void> {
  await deleteDoc(doc(db, 'admins', profile.uid));
  await deleteDoc(doc(db, 'accounts', profile.account)).catch(() => undefined);
}

/**
 * 重設密碼：建立一個新的 Auth 帳號（同帳號名稱、新信箱與新密碼），
 * 再切換對照表。舊帳號留下的 Auth 紀錄沒有管理員文件就沒有權限。
 */
export async function resetAdminPassword(profile: AdminProfile, newPassword: string): Promise<void> {
  if (newPassword.length < 6) throw new Error('密碼至少 6 個字元。');
  const account = profile.account;
  const suffix = Date.now().toString(36);
  const email = `${account}.${suffix}@buke.local`;
  const uid = await createAuthAccount(email, newPassword);

  await setDoc(doc(db, 'admins', uid), {
    account,
    name: profile.name,
    role: profile.role,
    region: profile.region,
    enabled: profile.enabled !== false,
    authEmail: email,
    createdAt: Date.now(),
  });
  await setDoc(doc(db, 'accounts', account), {
    uid,
    authEmail: email,
    name: profile.name,
    role: profile.role,
    region: profile.region,
  });
  await deleteDoc(doc(db, 'admins', profile.uid)).catch(() => undefined);
}

export async function changeMyPassword(oldPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('尚未登入');
  if (newPassword.length < 6) throw new Error('新密碼至少 6 個字元。');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPassword));
  await updatePassword(user, newPassword);
}

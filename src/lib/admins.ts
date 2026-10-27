import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isRegionName } from './regions';
import type { AdminProfile, AdminRole } from '../types';

/**
 * 管理員資料存在 admins/{帳號}。
 *
 * 密碼是明文、且前端比對得到 —— 這是刻意的「防君子」設計：
 * 內部使用、方便優先。任何能開網站的人都能繞過前端畫面直接寫資料庫，
 * 因此這裡的分層只防「操作失誤」，不防「有心人」。
 */

const SESSION_KEY = 'buke.admin.session.v1';

const adminRef = (account: string) => doc(db, 'admins', account.trim().toLowerCase());

export function loadSession(): AdminProfile | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminProfile) : null;
  } catch {
    return null;
  }
}

export function saveSession(profile: AdminProfile): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
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

/** 第一次使用：建立預設的課程管理員 admin / admin */
export async function ensureDefaultAdmin(): Promise<void> {
  const ref = adminRef('admin');
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    account: 'admin',
    name: '系統管理員',
    role: 'course' as AdminRole,
    region: '',
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
  const data = snap.data() as AdminProfile;
  if (data.enabled === false) throw new Error('這個帳號已被停用，請聯繫課程管理員。');
  if (data.pass !== pass) throw new Error('密碼不正確。');
  const profile: AdminProfile = { ...data, account: key };
  saveSession(profile);
  return profile;
}

export async function listAdmins(): Promise<AdminProfile[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs
    .map((d) => ({ ...(d.data() as AdminProfile), account: d.id }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.account.localeCompare(b.account));
}

const ACCOUNT_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;

export interface NewAdminInput {
  account: string;
  name: string;
  role: AdminRole;
  region: string;
  pass: string;
}

export async function createAdmin(input: NewAdminInput): Promise<void> {
  const account = input.account.trim().toLowerCase();
  if (!ACCOUNT_RE.test(account)) {
    throw new Error('帳號需為 3–20 個英數字（可用 . _ -），不能有中文或空白。');
  }
  if (!input.pass.trim()) throw new Error('請設定登入密碼。');
  if (input.role === 'region' && !isRegionName(input.region)) {
    throw new Error('區域管理員必須指定一個有效區域。');
  }
  const snap = await getDoc(adminRef(account));
  if (snap.exists()) throw new Error('這個帳號已經有人使用。');

  await setDoc(adminRef(account), {
    account,
    name: input.name.trim() || account,
    role: input.role,
    region: input.role === 'region' ? input.region : '',
    enabled: true,
    pass: input.pass,
    updatedAt: Date.now(),
  });
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

/** 修改自己的密碼：先比對舊密碼 */
export async function changeMyPassword(
  account: string,
  oldPass: string,
  newPass: string
): Promise<AdminProfile> {
  const snap = await getDoc(adminRef(account));
  if (!snap.exists()) throw new Error('查不到這個帳號。');
  const data = snap.data() as AdminProfile;
  if (data.pass !== oldPass) throw new Error('目前密碼不正確。');
  if (!newPass.trim()) throw new Error('新密碼不可空白。');
  await updateDoc(adminRef(account), { pass: newPass, updatedAt: Date.now() });
  const updated: AdminProfile = { ...data, account, pass: newPass };
  saveSession(updated);
  return updated;
}

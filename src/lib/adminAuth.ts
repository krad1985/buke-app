import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * 全站共用一組管理密碼，存在 config/admin。
 * 前端比對、前端修改；資料庫不分辨誰是管理員。
 */
const SESSION_KEY = 'buke.admin.v1';
const adminRef = () => doc(db, 'config', 'admin');

export function isSignedIn(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function signOutAdmin(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* 無痕模式 */
  }
}

/** 第一次使用：建立預設密碼 */
export async function ensureAdminPass(): Promise<void> {
  const snap = await getDoc(adminRef());
  if (snap.exists()) return;
  await setDoc(adminRef(), { pass: 'admin', updatedAt: Date.now() });
}

export async function loginAdmin(pass: string): Promise<void> {
  const snap = await getDoc(adminRef());
  if (!snap.exists()) throw new Error('尚未設定管理密碼。');
  const stored = (snap.data() as { pass?: string }).pass ?? '';
  if (pass !== stored) throw new Error('密碼不正確。');
  sessionStorage.setItem(SESSION_KEY, '1');
}

export async function changeAdminPass(oldPass: string, newPass: string): Promise<void> {
  const snap = await getDoc(adminRef());
  if (!snap.exists()) throw new Error('尚未設定管理密碼。');
  if ((snap.data() as { pass?: string }).pass !== oldPass) throw new Error('目前密碼不正確。');
  if (!newPass.trim()) throw new Error('新密碼不可空白。');
  await setDoc(adminRef(), { pass: newPass, updatedAt: Date.now() }, { merge: true });
}

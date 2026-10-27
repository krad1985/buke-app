import { initializeApp } from 'firebase/app';
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
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Web App 設定。這些值出現在前端是正常的（apiKey 不是機密），
 * 資料安全靠 Firestore 安全規則。
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCCcc4f30Yxlvsw5pJqoGzmYQ549JPZ6Q0',
  authDomain: 'phased-makeup-system.firebaseapp.com',
  projectId: 'phased-makeup-system',
  storageBucket: 'phased-makeup-system.firebasestorage.app',
  messagingSenderId: '611594444624',
  appId: '1:611594444624:web:65cdd7b3e937a7224b5655',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * 管理員在畫面上只輸入密碼。底層用這組固定帳號 + Firebase 密碼驗證，
 * 目的是讓 Firestore 規則能辨識「這是管理員」，而不是只靠前端比對字串。
 */
export const ADMIN_ACCOUNT = 'admin@buke.local';

export async function adminSignIn(password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, ADMIN_ACCOUNT, password);
}

/** 第一次使用：建立管理密碼。已有帳號時 Firebase 會回 email-already-in-use */
export async function adminCreatePassword(password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, ADMIN_ACCOUNT, password);
}

export async function adminChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('尚未登入');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(ADMIN_ACCOUNT, oldPassword));
  await updatePassword(user, newPassword);
}

/** 登出管理員後回到匿名身分（學員端仍可運作） */
export async function adminSignOut(): Promise<void> {
  await signOut(auth);
  await signInAnonymously(auth).catch(() => undefined);
}

export function isAdminUser(email: string | null | undefined): boolean {
  return !!email && email === ADMIN_ACCOUNT;
}

export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return '密碼不正確。';
    case 'auth/email-already-in-use':
      return '這套系統已經設定過管理密碼，請直接登入；忘記密碼請到 Firebase Console 重設。';
    case 'auth/weak-password':
      return '密碼強度不足，請至少 6 個字元。';
    case 'auth/too-many-requests':
      return '嘗試次數過多，請稍後再試。';
    case 'auth/operation-not-allowed':
      return '尚未啟用「電子郵件/密碼」登入方式，請先到 Firebase Console 的 Authentication 開啟。';
    case 'auth/network-request-failed':
      return '網路連線失敗，請檢查連線後重試。';
    default:
      return '操作失敗（' + code + '）。';
  }
}

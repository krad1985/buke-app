import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase 設定。這些值出現在前端是正常的（apiKey 不是機密）。
 *
 * 管理端使用 Firebase Auth（電子郵件＋密碼）；學員端不使用登入。
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

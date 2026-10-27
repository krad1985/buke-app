import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Web App 設定。這些值出現在前端是正常的（apiKey 不是機密）。
 *
 * 注意：本系統不使用 Firebase Auth。管理權限由前端密碼畫面區分，
 * 資料庫規則為防君子模式，詳見 firestore.rules 的說明。
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
export const db = getFirestore(app);

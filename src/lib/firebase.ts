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

/**
 * App Check：填入 site key 後生效；留空則不啟用。
 * - provider 'v3'：傳統 reCAPTCHA v3（已列入淘汰，但既有金鑰仍可用）
 * - provider 'enterprise'：reCAPTCHA Enterprise（Google Cloud Fraud Defense），新建議用這個
 * 注意：Firebase Console 的 App Check 要先切到「強制執行」才會真的擋請求。
 */
export const APP_CHECK_SITE_KEY = '6LcR7ScuAAAAAFeuGqXsyOY5gnC9mPxybluF5BlA';
export const APP_CHECK_PROVIDER: 'v3' | 'enterprise' = 'v3';

export async function initAppCheck(): Promise<void> {
  if (!APP_CHECK_SITE_KEY) return;
  try {
    // 本機測試若需要 debug token：先 localStorage.setItem('buke.appcheck.debug', '<token>') 再重新整理
    if (import.meta.env.DEV) {
      const dbg = localStorage.getItem('buke.appcheck.debug');
      if (dbg) (self as unknown as Record<string, string>).FIREBASE_APPCHECK_DEBUG_TOKEN = dbg;
    }
    if (APP_CHECK_PROVIDER === 'enterprise') {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch {
    /* 初始化失敗不影響網站運作 */
  }
}

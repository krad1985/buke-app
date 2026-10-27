import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import AdminLogin from './AdminLogin';
import AdminTab from './AdminTab';
import CourseTab from './CourseTab';
import PasswordTab from './PasswordTab';
import RecordTab from './RecordTab';
import StudentTab from './StudentTab';
import { auth } from '../../lib/firebase';
import { loadMyProfile, logoutAdmin } from '../../lib/adminAuth';
import type { AdminProfile } from '../../types';

type TabId = 'courses' | 'students' | 'records' | 'admins' | 'password';

const TAB_LABELS: Record<TabId, string> = {
  courses: '課程管理',
  students: '學員名單',
  records: '補課記錄',
  admins: '管理員',
  password: '我的密碼',
};

export default function AdminApp() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('courses');

  const refreshProfile = useCallback(async () => {
    setChecking(true);
    try {
      const p = await loadMyProfile();
      setProfile(p);
      setAuthError(null);
      setTab(p.role === 'course' ? 'courses' : 'students');
    } catch (e) {
      setProfile(null);
      const msg = (e as Error).message;
      if (msg === 'DISABLED') setAuthError('這個管理員帳號已被停用，請聯繫課程管理員。');
      else if (msg === 'NO_PERMISSION') setAuthError('這個帳號沒有管理權限。');
      else if (msg !== 'NOT_SIGNED_IN') setAuthError(msg);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || user.isAnonymous) {
        setProfile(null);
        setChecking(false);
        return;
      }
      void refreshProfile();
    });
    return unsub;
  }, [refreshProfile]);

  const tabs = useMemo<TabId[]>(
    () =>
      profile
        ? profile.role === 'course'
          ? ['courses', 'students', 'records', 'admins', 'password']
          : ['students', 'records', 'password']
        : [],
    [profile]
  );

  if (checking) return <p className="hint">檢查登入狀態…</p>;

  if (!profile) {
    return (
      <>
        {authError && <p className="form-error" style={{ textAlign: 'center' }}>{authError}</p>}
        <AdminLogin onSignedIn={() => void refreshProfile()} />
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
          管理員帳號由課程管理員建立，不需要自己註冊。
        </p>
      </>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <nav className="tabs">
          {tabs.map((id) => (
            <button
              key={id}
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </nav>
        <div className="row-gap">
          <span className="hint">
            {profile.name}・{profile.role === 'course' ? '課程管理員' : `區域管理員（${profile.region}）`}
          </span>
          <button className="btn tiny ghost" onClick={() => void logoutAdmin()}>
            登出
          </button>
        </div>
      </div>

      {tab === 'courses' && profile.role === 'course' && <CourseTab />}
      {tab === 'students' && <StudentTab profile={profile} />}
      {tab === 'records' && <RecordTab profile={profile} />}
      {tab === 'admins' && profile.role === 'course' && <AdminTab profile={profile} />}
      {tab === 'password' && <PasswordTab profile={profile} />}
    </div>
  );
}

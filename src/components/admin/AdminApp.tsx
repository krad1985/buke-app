import { useEffect, useMemo, useState } from 'react';
import AdminLogin from './AdminLogin';
import AdminTab from './AdminTab';
import CourseTab from './CourseTab';
import PasswordTab from './PasswordTab';
import RecordTab from './RecordTab';
import StudentTab from './StudentTab';
import { clearSession, ensureDefaultAdmin, loadSession } from '../../lib/admins';
import { withTimeout } from '../../lib/async';
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
  const [profile, setProfile] = useState<AdminProfile | null>(() => loadSession());
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>('courses');

  useEffect(() => {
    // 第一次使用時自動建立 admin / admin；加逾時避免規則未發布時卡在載入中
    withTimeout(ensureDefaultAdmin(), 8000)
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  const handleSignedIn = (p: AdminProfile) => {
    setProfile(p);
    setTab(p.role === 'course' ? 'courses' : 'students');
  };

  const handleLogout = () => {
    clearSession();
    setProfile(null);
  };

  const tabs = useMemo<TabId[]>(
    () =>
      profile
        ? profile.role === 'course'
          ? ['courses', 'students', 'records', 'admins', 'password']
          : ['students', 'records', 'password']
        : [],
    [profile]
  );

  if (checking) return <p className="hint">載入中…</p>;

  if (!profile) {
    return <AdminLogin onSignedIn={handleSignedIn} />;
  }

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <nav className="tabs">
          {tabs.map((id) => (
            <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {TAB_LABELS[id]}
            </button>
          ))}
        </nav>
        <div className="row-gap">
          <span className="hint">
            {profile.name}・{profile.role === 'course' ? '課程管理員' : `區域管理員（${profile.region}）`}
          </span>
          <button className="btn tiny ghost" onClick={handleLogout}>
            登出
          </button>
        </div>
      </div>

      {tab === 'courses' && profile.role === 'course' && <CourseTab />}
      {tab === 'students' && <StudentTab profile={profile} />}
      {tab === 'records' && <RecordTab profile={profile} />}
      {tab === 'admins' && profile.role === 'course' && <AdminTab profile={profile} />}
      {tab === 'password' && <PasswordTab profile={profile} onChanged={handleSignedIn} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import AdminLogin from './AdminLogin';
import CourseTab from './CourseTab';
import PasswordTab from './PasswordTab';
import RecordTab from './RecordTab';
import StudentTab from './StudentTab';
import { ensureAdminPass, isSignedIn, signOutAdmin } from '../../lib/adminAuth';

type TabId = 'courses' | 'students' | 'records' | 'password';

const TAB_LABELS: Record<TabId, string> = {
  courses: '課程管理',
  students: '學員名單',
  records: '補課記錄',
  password: '管理密碼',
};

const TABS: TabId[] = ['courses', 'students', 'records', 'password'];

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => isSignedIn());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabId>('courses');

  useEffect(() => {
    ensureAdminPass()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <p className="hint">載入中…</p>;

  if (!authed) {
    return <AdminLogin onSignedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <nav className="tabs">
          {TABS.map((id) => (
            <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {TAB_LABELS[id]}
            </button>
          ))}
        </nav>
        <button
          className="btn tiny ghost"
          onClick={() => {
            signOutAdmin();
            setAuthed(false);
          }}
        >
          登出
        </button>
      </div>

      {tab === 'courses' && <CourseTab />}
      {tab === 'students' && <StudentTab />}
      {tab === 'records' && <RecordTab />}
      {tab === 'password' && <PasswordTab />}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLogin from './AdminLogin';
import AdminTab from './AdminTab';
import CourseTab from './CourseTab';
import PasswordTab from './PasswordTab';
import RecordTab from './RecordTab';
import SeriesTab from './SeriesTab';
import SettingsTab from './SettingsTab';
import StudentTab from './StudentTab';
import { clearSession, ensureDefaultAdmin, loadSession } from '../../lib/admins';
import { withTimeout } from '../../lib/async';
import { listSeries } from '../../lib/series';
import type { AdminProfile, Series } from '../../types';

type TabId = 'series' | 'courses' | 'students' | 'records' | 'admins' | 'settings' | 'password';

const TAB_LABELS: Record<TabId, string> = {
  series: '系列',
  courses: '課程管理',
  students: '學員名單',
  records: '學習記錄',
  admins: '管理員',
  settings: '設定',
  password: '我的密碼',
};

const TABS_BY_ROLE: Record<AdminProfile['role'], TabId[]> = {
  super: ['series', 'courses', 'students', 'records', 'admins', 'settings', 'password'],
  series: ['courses', 'password'],
  region: ['students', 'records', 'admins', 'password'],
  classroom: ['students', 'records', 'password'],
};

export default function AdminApp() {
  const [profile, setProfile] = useState<AdminProfile | null>(() => loadSession());
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>('courses');
  const [series, setSeries] = useState<Series[]>([]);

  useEffect(() => {
    withTimeout(ensureDefaultAdmin(), 8000)
      .catch(() => undefined)
      .finally(() => setChecking(false));
    listSeries()
      .then(setSeries)
      .catch(() => undefined);
  }, []);

  const reloadSeries = useCallback(() => {
    listSeries()
      .then(setSeries)
      .catch(() => undefined);
  }, []);

  const handleSignedIn = (p: AdminProfile) => {
    setProfile(p);
    setTab(TABS_BY_ROLE[p.role][0]);
  };

  const handleLogout = () => {
    clearSession();
    setProfile(null);
  };

  const tabs = useMemo<TabId[]>(() => (profile ? TABS_BY_ROLE[profile.role] : []), [profile]);

  const mySeries = useMemo(
    () => (profile?.role === 'series' ? series.filter((s) => profile.seriesIds.includes(s.seriesId)) : series),
    [series, profile]
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
            {profile.name}・{roleLabel(profile)}
          </span>
          <button className="btn tiny ghost" onClick={handleLogout}>
            登出
          </button>
        </div>
      </div>

      {tab === 'series' && profile.role === 'super' && (
        <SeriesTab series={series} onChanged={reloadSeries} />
      )}
      {tab === 'courses' && (profile.role === 'super' || profile.role === 'series') && (
        <CourseTab profile={profile} series={mySeries} allSeries={series} />
      )}
      {tab === 'students' && (
        <StudentTab profile={profile} series={mySeries} />
      )}
      {tab === 'records' && <RecordTab profile={profile} series={mySeries} />}
      {tab === 'admins' && (profile.role === 'super' || profile.role === 'region') && (
        <AdminTab profile={profile} series={series} />
      )}
      {tab === 'settings' && profile.role === 'super' && <SettingsTab />}
      {tab === 'password' && <PasswordTab profile={profile} onChanged={handleSignedIn} />}
    </div>
  );
}

function roleLabel(p: AdminProfile): string {
  switch (p.role) {
    case 'super':
      return '總管理員';
    case 'series':
      return '系列管理員';
    case 'region':
      return `區域窗口（${p.region}）`;
    case 'classroom':
      return `教室窗口（${p.region}／${p.classroom}）`;
    default:
      return '';
  }
}

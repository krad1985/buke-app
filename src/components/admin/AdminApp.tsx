import { useEffect, useMemo, useState } from 'react';
import AdminLogin from './AdminLogin';
import AdminTab from './AdminTab';
import CourseTab from './CourseTab';
import PasswordTab from './PasswordTab';
import RecordTab from './RecordTab';
import SeriesTab from './SeriesTab';
import SettingsTab from './SettingsTab';
import StudentTab from './StudentTab';
import { applyActive, loadProfile, logoutAdmin, roleLabel, watchAuth } from '../../lib/admins';
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
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>('courses');
  const [series, setSeries] = useState<Series[]>([]);
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchAuth(async (uid) => {
      if (!uid) {
        setProfile(null);
        setChecking(false);
        return;
      }
      try {
        const p = await loadProfile(uid);
        if (!p || p.enabled === false) {
          await logoutAdmin();
          setProfile(null);
        } else {
          setProfile(p);
          setActiveGrantId(p.superAdmin && !p.grants.length ? '__super' : p.grants[0]?.id ?? null);
          setTab(TABS_BY_ROLE[p.role][0]);
        }
      } catch {
        setProfile(null);
      } finally {
        setChecking(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!profile) return;
    listSeries()
      .then(setSeries)
      .catch(() => undefined);
  }, [profile]);

  const reloadSeries = () => {
    listSeries()
      .then(setSeries)
      .catch(() => undefined);
  };

  const switchGrant = (id: string) => {
    if (!profile) return;
    const next = applyActive(profile, id);
    setProfile(next);
    setActiveGrantId(id);
    setTab(TABS_BY_ROLE[next.role][0]);
  };

  const handleSignedIn = (p: AdminProfile) => {
    setProfile(p);
    setActiveGrantId(p.superAdmin && !p.grants.length ? '__super' : p.grants[0]?.id ?? null);
    setTab(TABS_BY_ROLE[p.role][0]);
    reloadSeries();
  };

  const tabs = useMemo<TabId[]>(() => (profile ? TABS_BY_ROLE[profile.role] : []), [profile]);

  const mySeries = useMemo(
    () => (profile?.role === 'series' ? series.filter((s) => profile.seriesIds.includes(s.seriesId)) : series),
    [series, profile]
  );

  const options = useMemo(() => {
    if (!profile) return [];
    const list = profile.grants.map((g) => ({ id: g.id, label: grantLabel(g) }));
    return profile.superAdmin ? [{ id: '__super', label: '總管理員' }, ...list] : list;
  }, [profile]);

  if (checking) return <p className="hint">載入中…</p>;

  if (profile?.pending) {
    return (
      <div className="panel login-panel">
        <h1>等待核准</h1>
        <p className="hint">
          已收到你的申請（{profile.email}）。管理員核准後就能進入後台；核准前請稍候。
        </p>
        {profile.request && (
          <p className="hint">
            申請內容：{requestLabel(profile.request)}
            {profile.request.note ? `｜${profile.request.note}` : ''}
          </p>
        )}
        <p style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => void logoutAdmin()}>
            登出
          </button>
        </p>
      </div>
    );
  }

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
          <span className="hint">{profile.email || profile.name}</span>
          {options.length > 1 ? (
            <select
              className="select switcher"
              value={activeGrantId ?? options[0]?.id ?? ''}
              onChange={(e) => switchGrant(e.target.value)}
              aria-label="切換身分"
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  以「{o.label}」身分
                </option>
              ))}
            </select>
          ) : (
            <span className="hint">・{roleLabel(profile)}</span>
          )}
          <button
            className="btn tiny ghost"
            onClick={() => {
              void logoutAdmin();
            }}
          >
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
      {tab === 'students' && <StudentTab profile={profile} series={mySeries} />}
      {tab === 'records' && <RecordTab profile={profile} series={mySeries} />}
      {tab === 'admins' && (profile.role === 'super' || profile.role === 'region') && (
        <AdminTab profile={profile} series={series} />
      )}
      {tab === 'settings' && profile.role === 'super' && <SettingsTab />}
      {tab === 'password' && <PasswordTab profile={profile} onChanged={handleSignedIn} />}
    </div>
  );
}

function grantLabel(g: AdminProfile['grants'][number]): string {
  if (g.role === 'series') return `系列管理員（${g.seriesIds.length} 個系列）`;
  if (g.role === 'region') return `區域窗口（${g.region}）`;
  return `教室窗口（${g.region}／${g.classroom}）`;
}

function requestLabel(r: NonNullable<AdminProfile['request']>): string {
  if (r.role === 'series') return '系列管理員';
  if (r.role === 'region') return `區域窗口（${r.region}）`;
  return `教室窗口（${r.region}／${r.classroom}）`;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import AdminApp from './components/admin/AdminApp';
import CourseList from './components/CourseList';
import LessonView from './components/LessonView';
import PhoneGate from './components/PhoneGate';
import { auth } from './lib/firebase';
import { withTimeout } from './lib/async';
import { listAllCourses } from './lib/coursesRepo';
import { emptyProgress, loadAllLocal, saveLocal } from './lib/progress';
import { loadAllProgress, saveProgressFor } from './lib/progressRepo';
import type { Course, CourseProgress, Student } from './types';

type Route = { view: 'list' } | { view: 'course'; id: string } | { view: 'admin' };

const BINDING_KEY = 'buke.student.v1';

function loadBinding(): Student | null {
  try {
    const raw = localStorage.getItem(BINDING_KEY);
    return raw ? (JSON.parse(raw) as Student) : null;
  } catch {
    return null;
  }
}

function parseRoute(): Route {
  const h = window.location.hash;
  if (/^#\/admin/.test(h)) return { view: 'admin' };
  const m = h.match(/^#\/c\/(.+)$/);
  if (m) return { view: 'course', id: decodeURIComponent(m[1]) };
  return { view: 'list' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [student, setStudent] = useState<Student | null>(() => loadBinding());
  const [guest, setGuest] = useState(false);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* 一律匿名登入（管理員另行登入，會取代這個 session） */
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) signInAnonymously(auth).catch(() => undefined);
    });
  }, []);

  const reloadCourses = useCallback(() => {
    setLoadError(null);
    withTimeout(listAllCourses())
      .then(setCourses)
      .catch((e: unknown) => {
        setCourses([]);
        setLoadError(
          '無法讀取課程資料：' +
            (e instanceof Error ? e.message : String(e)) +
            '（請確認 Firestore 規則已部署、網路正常）'
        );
      });
  }, []);

  useEffect(() => {
    reloadCourses();
  }, [reloadCourses]);

  useEffect(() => {
    if (!student) {
      setProgress(loadAllLocal());
      return;
    }
    withTimeout(loadAllProgress(student.region, student.phoneKey), 12000)
      .then(setProgress)
      .catch(() => setProgress(loadAllLocal()));
  }, [student]);

  const published = useMemo(() => (courses ?? []).filter((c) => c.isPublished), [courses]);

  const activeCourse = useMemo(
    () =>
      route.view === 'course' ? (courses ?? []).find((c) => c.courseId === route.id) ?? null : null,
    [route, courses]
  );

  const handleSaveProgress = useCallback(
    (p: CourseProgress) => {
      setProgress((prev) => ({ ...prev, [p.courseId]: p }));
      if (student) void saveProgressFor(student.region, student.phoneKey, p).catch(() => undefined);
      else saveLocal(p);
    },
    [student]
  );

  const handleBound = (s: Student) => {
    setStudent(s);
    setGuest(false);
    try {
      localStorage.setItem(BINDING_KEY, JSON.stringify(s));
    } catch {
      /* 無痕模式 */
    }
  };

  const handleSwitchStudent = () => {
    localStorage.removeItem(BINDING_KEY);
    setStudent(null);
    setProgress({});
    setGuest(false);
  };

  const open = (courseId: string) => {
    window.location.hash = `#/c/${encodeURIComponent(courseId)}`;
  };

  const close = () => {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setRoute({ view: 'list' });
  };

  const needGate = route.view !== 'admin' && !student && !guest;

  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={close}>
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <span className="brand-title">補課系統</span>
            <span className="brand-sub">影片分段學習</span>
          </span>
        </button>

        {route.view === 'admin' ? (
          <span className="anon-badge admin">管理後台</span>
        ) : student ? (
          <span className="who">
            <span className="who-name">
              {student.name}
              <span className="who-region">{student.region}</span>
            </span>
            <button className="link-btn" onClick={handleSwitchStudent}>
              換人
            </button>
          </span>
        ) : (
          <span className="anon-badge">未登入・進度不記錄</span>
        )}
      </header>

      <main className="app-main">
        {route.view === 'admin' ? (
          <AdminApp />
        ) : needGate ? (
          <PhoneGate onBound={handleBound} onSkip={() => setGuest(true)} />
        ) : courses === null ? (
          <p className="hint">正在載入課程…</p>
        ) : route.view === 'course' ? (
          activeCourse ? (
            <LessonView
              key={activeCourse.courseId}
              course={activeCourse}
              initialProgress={progress[activeCourse.courseId] ?? emptyProgress(activeCourse.courseId)}
              onSaveProgress={handleSaveProgress}
              onExit={close}
            />
          ) : (
            <div className="panel">
              <p>找不到這門課程，可能已被刪除或連結有誤。</p>
              <p style={{ marginTop: 10 }}>
                <button className="btn small" onClick={close}>
                  回課程列表
                </button>
              </p>
            </div>
          )
        ) : (
          <>
            {!student && (
              <div className="notice warn" style={{ marginBottom: 16 }}>
                目前是「先看看課程」模式，進度不會寫入補課記錄。
                <button className="link-btn" onClick={handleSwitchStudent}>
                  輸入手機號碼
                </button>
              </div>
            )}
            {loadError && (
              <div className="notice warn" style={{ marginBottom: 16 }}>
                <p>{loadError}</p>
                <p style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={reloadCourses}>
                    重新載入
                  </button>
                </p>
              </div>
            )}
            <CourseList courses={published} progress={progress} onSelect={open} />
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>進度以手機號碼記錄。</span>
        <span className="dot">·</span>
        <a href="#/admin">管理後台</a>
      </footer>
    </div>
  );
}

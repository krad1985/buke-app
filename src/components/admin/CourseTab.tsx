import { useCallback, useEffect, useMemo, useState } from 'react';
import CourseEditor from './CourseEditor';
import { withTimeout } from '../../lib/async';
import { downloadText } from '../../lib/csv';
import { deleteCourse, emptyCourse, listAllCourses, newCourseId, saveCourse } from '../../lib/coursesRepo';
import type { AdminProfile, Course, Series } from '../../types';

interface Props {
  profile: AdminProfile;
  series: Series[];
  allSeries: Series[];
}

export default function CourseTab({ profile, series }: Props) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const isSuper = profile.role === 'super';

  const reload = useCallback(() => {
    setError(null);
    withTimeout(listAllCourses())
      .then(setCourses)
      .catch((e: unknown) => {
        setCourses([]);
        setError('讀取課程失敗：' + (e as Error).message);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(() => {
    const list = courses ?? [];
    const scoped = isSuper ? list : list.filter((c) => series.some((s) => s.seriesId === c.seriesId));
    return filter ? scoped.filter((c) => c.seriesId === filter) : scoped;
  }, [courses, isSuper, series, filter]);

  const seriesName = (id: string) => series.find((s) => s.seriesId === id)?.name ?? '未分類';

  const handleSeed = async () => {
    if (!window.confirm('把兩門示範課程寫入資料庫？')) return;
    setBusy(true);
    try {
      const { mockCourses } = await import('../../data/mockCourses');
      for (const c of mockCourses) await saveCourse({ ...c, isPublished: false });
      reload();
    } catch (e) {
      setError('載入示範課程失敗：' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    if (!visible.length) return;
    downloadText(
      `課程備份_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(visible, null, 2)
    );
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Course[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('檔案內容不是課程陣列');
      if (!window.confirm(`匯入 ${parsed.length} 門課程？（同 ID 會被覆蓋）`)) return;
      setBusy(true);
      for (const c of parsed) {
        if (!c || typeof c.courseId !== 'string') throw new Error('有課程缺少 courseId');
        await saveCourse(c);
      }
      reload();
    } catch (e) {
      setError('匯入失敗：' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (course: Course) => {
    if (!window.confirm(`確定刪除「${course.title}」？`)) return;
    setBusy(true);
    try {
      await deleteCourse(course.courseId);
      reload();
    } catch (e) {
      setError('刪除失敗：' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <CourseEditor
        key={editing.courseId}
        course={editing}
        series={series}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const newCourse = () => {
    const c = emptyCourse(newCourseId());
    c.seriesId = filter || series[0]?.seriesId || '';
    setEditing(c);
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>課程與題庫</h2>
        <div className="row-gap">
          {isSuper && (
            <select className="select" style={{ width: 140 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">全部系列</option>
              {series.map((s) => (
                <option key={s.seriesId} value={s.seriesId}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn small" onClick={handleExport} disabled={busy || visible.length === 0}>
            匯出備份
          </button>
          <label className="btn small">
            匯入備份
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void handleImport(e.target.files?.[0])}
            />
          </label>
          {isSuper && (
            <button className="btn" onClick={handleSeed} disabled={busy}>
              載入示範課程
            </button>
          )}
          <button className="btn primary" onClick={newCourse} disabled={busy}>
            ＋ 新增課程
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {courses === null ? (
        <p className="hint">載入中…</p>
      ) : visible.length === 0 ? (
        <div className="panel empty-state">
          <p>還沒有課程。</p>
        </div>
      ) : (
        <div className="panel">
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>課程名稱</th>
                  <th>系列</th>
                  <th>段落</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.courseId}>
                    <td>
                      <strong>{c.title}</strong>
                      <div className="hint mono">{c.youtubeVideoId || '未設定影片'}</div>
                    </td>
                    <td>{seriesName(c.seriesId)}</td>
                    <td>{c.segments.length}</td>
                    <td>
                      <span className={`state-dot ${c.isPublished ? 'done' : 'idle'}`}>
                        {c.isPublished ? '已上架' : '未上架'}
                      </span>
                    </td>
                    <td className="ta-right">
                      <button className="btn tiny" onClick={() => setEditing(c)}>
                        編輯
                      </button>
                      <button className="btn tiny ghost danger" onClick={() => handleRemove(c)}>
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import CourseEditor from './CourseEditor';
import { withTimeout } from '../../lib/async';
import { deleteCourse, emptyCourse, listAllCourses, newCourseId, saveCourse } from '../../lib/coursesRepo';
import type { Course } from '../../types';

export default function CourseTab() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    setError(null);
    withTimeout(listAllCourses())
      .then(setCourses)
      .catch((e: unknown) => {
        setCourses([]);
        setError('讀取課程失敗：' + (e instanceof Error ? e.message : String(e)));
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSeed = async () => {
    if (!window.confirm('把兩門示範課程寫入資料庫？（同 ID 會被覆蓋）')) return;
    setBusy(true);
    try {
      const { mockCourses } = await import('../../data/mockCourses');
      for (const c of mockCourses) {
        const payload = { ...c, isPublished: false };
        delete payload.isMock;
        await saveCourse(payload);
      }
      reload();
    } catch (e) {
      setError('載入示範課程失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (course: Course) => {
    if (!window.confirm(`確定刪除「${course.title}」？此動作無法復原。`)) return;
    setBusy(true);
    try {
      await deleteCourse(course.courseId);
      reload();
    } catch (e) {
      setError('刪除失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <CourseEditor
        key={editing.courseId}
        course={editing}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <div>
          <h2>課程與題庫</h2>
          <p className="hint">學員端只看得到「已上架」的課程。</p>
        </div>
        <div className="row-gap">
          <button className="btn" onClick={handleSeed} disabled={busy}>
            載入示範課程
          </button>
          <button className="btn primary" onClick={() => setEditing(emptyCourse(newCourseId()))} disabled={busy}>
            ＋ 新增課程
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {courses === null ? (
        <p className="hint">載入中…</p>
      ) : courses.length === 0 ? (
        <div className="panel empty-state">
          <p>還沒有課程。可以「新增課程」從空白開始，或「載入示範課程」先看格式。</p>
        </div>
      ) : (
        <div className="panel">
          <table className="admin-table">
            <thead>
              <tr>
                <th>課程名稱</th>
                <th>段落</th>
                <th>狀態</th>
                <th>排序</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.courseId}>
                  <td>
                    <strong>{c.title}</strong>
                    <div className="hint mono">{c.youtubeVideoId || '未設定影片'}</div>
                  </td>
                  <td>{c.segments.length}</td>
                  <td>
                    <span className={`state-dot ${c.isPublished ? 'done' : 'idle'}`}>
                      {c.isPublished ? '已上架' : '未上架'}
                    </span>
                  </td>
                  <td>{c.sortOrder}</td>
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
      )}
    </div>
  );
}

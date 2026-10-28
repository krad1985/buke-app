import { fmtDuration } from '../lib/format';
import type { Course, CourseProgress } from '../types';

interface Props {
  courses: Course[];
  progress: Record<string, CourseProgress>;
  onSelect: (courseId: string) => void;
}

export default function CourseList({ courses, progress, onSelect }: Props) {
  if (courses.length === 0) {
    return (
      <div className="panel empty-state">
        <h1>目前沒有上架的課程</h1>
        <p className="hint" style={{ marginTop: 8 }}>
          請由管理員在後台建立課程並上架。
        </p>
        <p style={{ marginTop: 14 }}>
          <a className="btn primary small" href="#/admin">
            前往管理後台
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="course-list">
      <div className="list-head">
        <h1>課程</h1>
      </div>

      <div className="cards">
        {courses.map((course) => {
          const p = progress[course.courseId];
          const total = course.segments.length;
          const done = p?.passed.length ?? 0;
          const watched = p?.watchedSec ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const state = done >= total && total > 0 ? '已完成' : done > 0 ? '進行中' : '未開始';
          const stateKey = done >= total && total > 0 ? 'done' : done > 0 ? 'doing' : 'idle';

          return (
            <button key={course.courseId} className="card" onClick={() => onSelect(course.courseId)}>
              <div className="card-top">
                <span className={`state-dot ${stateKey}`}>{state}</span>
                {course.teacher && <span className="chip subtle">{course.teacher}</span>}
              </div>
              <h2>{course.title}</h2>
              <p className="card-desc">{course.description || '　'}</p>
              <div className="card-meta">
                <span>{total} 段</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="card-progress">
                {done} / {total} 段通過
                {watched > 0 && <>・已學習 {fmtDuration(watched)}</>}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

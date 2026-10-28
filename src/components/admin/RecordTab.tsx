import { useCallback, useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../../lib/csv';
import { segmentSeconds } from '../../lib/format';
import { listAllCourses } from '../../lib/coursesRepo';
import { listStudentsInRegion } from '../../lib/roster';
import { loadRegionRecords, type StudentRecord } from '../../lib/progressRepo';
import { getPrefRegion, setPrefRegion } from '../../lib/adminPrefs';
import { REGIONS } from '../../lib/regions';
import type { Course } from '../../types';

const fmtDate = (ts?: number) => (ts ? new Date(ts).toLocaleString('zh-TW', { hour12: false }) : '');

interface Row {
  studentId: string;
  classroom: string;
  group: string;
  role: string;
  name: string;
  cells: Record<string, string>;
  doneCount: number;
  minutes: number;
  lastUpdated: number;
}

export default function RecordTab() {
  const [region, setRegion] = useState(getPrefRegion());
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<StudentRecord[] | null>(null);
  const [onlyRecorded, setOnlyRecorded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAllCourses()
      .then((all) => setCourses(all.filter((c) => c.isPublished)))
      .catch(() => setError('讀取課程失敗'));
  }, []);

  const load = useCallback(async () => {
    if (!region) return;
    setBusy(true);
    setError(null);
    try {
      const students = await listStudentsInRegion(region);
      const rows = await loadRegionRecords(region, students);
      setRecords(rows);
    } catch (e) {
      setError('讀取記錄失敗：' + (e instanceof Error ? e.message : String(e)));
      setRecords([]);
    } finally {
      setBusy(false);
    }
  }, [region]);

  useEffect(() => {
    setRecords(null);
  }, [region]);

  const rows = useMemo<Row[]>(() => {
    if (!records) return [];
    const list: Row[] = records.map((rec) => {
      const cells: Record<string, string> = {};
      let doneCount = 0;
      let lastUpdated = 0;
      let totalSec = 0;
      for (const course of courses) {
        const p = rec.progress[course.courseId];
        const total = course.segments.length;
        const passed = p?.passed.length ?? 0;
        if (!p || passed === 0) {
          cells[course.courseId] = '';
        } else if (total > 0 && passed >= total) {
          cells[course.courseId] = '✓';
          doneCount += 1;
        } else {
          cells[course.courseId] = `${passed}/${total}`;
        }
        if (p) {
          totalSec += p.watchedSec ?? segmentSeconds(course.segments, p.passed);
        }
        if (p?.updatedAt && p.updatedAt > lastUpdated) lastUpdated = p.updatedAt;
      }
      return {
        studentId: rec.student.studentId,
        classroom: rec.student.classroom,
        group: rec.student.group,
        role: rec.student.role,
        name: rec.student.name,
        cells,
        doneCount,
        minutes: Math.round(totalSec / 60),
        lastUpdated,
      };
    });

    const filtered = onlyRecorded ? list.filter((r) => r.doneCount > 0 || Object.values(r.cells).some(Boolean)) : list;
    return filtered.sort((a, b) => a.studentId.localeCompare(b.studentId) || a.name.localeCompare(b.name));
  }, [records, courses, onlyRecorded]);

  const handleExport = () => {
    const header = ['區域', '學員代碼', '母班', '組別', '身份', '姓名', ...courses.map((c) => c.title), '完課數', '已補時數(分)', '最後更新'];
    const body = rows.map((r) => [
      region,
      r.studentId,
      r.classroom,
      r.group,
      r.role,
      r.name,
      ...courses.map((c) => r.cells[c.courseId] ?? ''),
      r.doneCount,
      r.minutes,
      fmtDate(r.lastUpdated),
    ]);
    downloadCsv(`補課總表_${region}_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>補課記錄</h2>
        <div className="row-gap">
          <label className="field inline">
            <span>區域</span>
            <select
              className="select"
              style={{ width: 120 }}
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setPrefRegion(e.target.value);
              }}
            >
              <option value="">請選擇</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={load} disabled={busy || !region}>
            {busy ? '讀取中…' : '讀取'}
          </button>
        </div>
      </div>

      {!region ? (
        <div className="panel empty-state">
          <p>請先選擇區域。</p>
        </div>
      ) : (
        <div className="panel">
          <div className="section-head">
            <div className="row-gap">
              <span className="hint">
                課程 {courses.length} 門・學員 {records?.length ?? 0} 人
              </span>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={onlyRecorded}
                  onChange={(e) => setOnlyRecorded(e.target.checked)}
                />
                <span>只列有紀錄的學員</span>
              </label>
            </div>
            <button className="btn" onClick={handleExport} disabled={rows.length === 0}>
              匯出 CSV
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}

          {records === null ? (
            <p className="hint">尚未讀取。</p>
          ) : rows.length === 0 ? (
            <p className="hint">沒有資料。</p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="admin-table compact">
                  <thead>
                    <tr>
                      <th>學員代碼</th>
                      <th>姓名</th>
                      <th>母班</th>
                      <th>組別</th>
                      <th>身份</th>
                      {courses.map((c) => (
                        <th key={c.courseId} className="course-col" title={c.title}>
                          {c.title}
                        </th>
                      ))}
                      <th>完課數</th>
                      <th>時數(分)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 300).map((r) => (
                      <tr key={r.studentId}>
                        <td className="mono">{r.studentId}</td>
                        <td>
                          <strong>{r.name}</strong>
                        </td>
                        <td>{r.classroom}</td>
                        <td>{r.group}</td>
                        <td>{r.role}</td>
                        {courses.map((c) => (
                          <td key={c.courseId} className="mark-cell">
                            {r.cells[c.courseId] || ''}
                          </td>
                        ))}
                        <td className="mono">{r.doneCount}</td>
                        <td className="mono">{r.minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 300 && <p className="hint">畫面只顯示前 300 筆，匯出 CSV 會包含全部。</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

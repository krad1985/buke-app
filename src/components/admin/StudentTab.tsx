import { useCallback, useEffect, useState } from 'react';
import { downloadCsv } from '../../lib/csv';
import {
  deleteStudent,
  importRoster,
  listStudentsInRegion,
  parseRosterFile,
  parseRosterText,
} from '../../lib/roster';
import { getPrefRegion, setPrefRegion } from '../../lib/adminPrefs';
import { REGIONS } from '../../lib/regions';
import type { Student } from '../../types';
import type { RosterRow } from '../../lib/roster';

const TEMPLATE_HEADER = ['學員代碼', '學員姓名', '母班行政組織', '大組', '小組', '身份別'];

export default function StudentTab() {
  const [region, setRegion] = useState(getPrefRegion());
  const [students, setStudents] = useState<Student[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<{ rows: RosterRow[]; errors: string[] } | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!region) {
      setStudents([]);
      return;
    }
    setStudents(null);
    listStudentsInRegion(region)
      .then(setStudents)
      .catch((e: unknown) => {
        setStudents([]);
        setError('讀取名單失敗：' + (e instanceof Error ? e.message : String(e)));
      });
  }, [region]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    setError(null);
    try {
      setParsed(await parseRosterFile(file));
    } catch (e) {
      setParsed(null);
      setError('讀取檔案失敗：' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleText = (value: string) => {
    setText(value);
    setFileName('');
    setParsed(value.trim() ? parseRosterText(value) : null);
  };

  const handleTemplate = () => {
    downloadCsv(`學員名單範本_${region || '空白'}.csv`, [TEMPLATE_HEADER]);
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0 || !region) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await importRoster(region, parsed.rows);
      const parts = [`已匯入 ${result.created} 筆到「${region}」`];
      if (result.duplicates.length) parts.push(`檔案內重複代碼：${result.duplicates.join('、')}`);
      setMessage(parts.join('｜'));
      setParsed(null);
      setText('');
      setFileName('');
      reload();
    } catch (e) {
      setError('匯入失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (s: Student) => {
    if (!window.confirm(`刪除「${s.name}」的名單與補課進度？`)) return;
    try {
      await deleteStudent(s.region, s.studentId);
      reload();
    } catch (e) {
      setError('刪除失敗：' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const filtered = (students ?? []).filter((s) => {
    const q = search.trim();
    if (!q) return true;
    return (
      s.name.includes(q) ||
      s.studentId.includes(q) ||
      s.classroom.includes(q) ||
      s.group.includes(q)
    );
  });

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>學員名單</h2>
        <label className="field inline">
          <span>區域</span>
          <select
            className="select"
            style={{ width: 130 }}
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
      </div>

      {!region ? (
        <div className="panel empty-state">
          <p>請先選擇區域。</p>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="section-head">
              <h3>匯入名單</h3>
              <div className="row-gap">
                <button className="btn small" onClick={handleTemplate}>
                  下載範本
                </button>
                <label className="btn small primary-ghost">
                  選擇檔案
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    hidden
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <p className="hint">
              可直接上傳系統匯出的「學員名單查詢結果」xlsx；或貼上表格。
            </p>

            <div
              className={`dropzone ${fileName ? 'has-file' : ''}`}
              onClick={() => document.getElementById('roster-file')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                id="roster-file"
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                hidden
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              {fileName ? <strong>{fileName}</strong> : <span>把檔案拖進來，或點這裡選擇</span>}
            </div>

            <details className="paste-box">
              <summary>或用貼上</summary>
              <textarea
                className="input mono"
                rows={5}
                value={text}
                onChange={(e) => handleText(e.target.value)}
                placeholder={'學員代碼\t學員姓名\t母班行政組織\t大組\t小組\t身份別'}
              />
            </details>

            <div className="row-gap" style={{ marginTop: 12 }}>
              <button
                className="btn primary"
                onClick={handleImport}
                disabled={busy || !parsed || parsed.rows.length === 0}
              >
                {busy ? '匯入中…' : `匯入到「${region}」`}
              </button>
              {parsed && (
                <span className="hint">
                  {parsed.rows.length} 筆可匯入
                  {parsed.errors.length ? `，${parsed.errors.length} 筆有問題` : ''}
                </span>
              )}
            </div>

            {parsed && parsed.errors.length > 0 && (
              <ul className="error-list">
                {parsed.errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {parsed.errors.length > 8 && <li>…另有 {parsed.errors.length - 8} 筆</li>}
              </ul>
            )}
            {message && <p className="form-ok">{message}</p>}
            {error && <p className="form-error">{error}</p>}
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="section-head">
              <h3>
                {region}（{students?.length ?? 0} 人）
              </h3>
              <input
                className="input"
                style={{ width: 200 }}
                placeholder="搜尋代碼 / 姓名 / 教室"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {students === null ? (
              <p className="hint">載入中…</p>
            ) : filtered.length === 0 ? (
              <p className="hint">沒有資料。</p>
            ) : (
              <div className="table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>學員代碼</th>
                      <th>姓名</th>
                      <th>母班</th>
                      <th>組別</th>
                      <th>身份</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.studentId}>
                        <td className="mono">{s.studentId}</td>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>{s.classroom}</td>
                        <td>{s.group}</td>
                        <td>{s.role}</td>
                        <td className="ta-right">
                          <button className="btn tiny ghost danger" onClick={() => handleDelete(s)}>
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
        </>
      )}
    </div>
  );
}

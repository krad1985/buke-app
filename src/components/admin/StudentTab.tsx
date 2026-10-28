import { useCallback, useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../../lib/csv';
import {
  deleteStudent,
  deleteStudents,
  importRoster,
  listStudentsInRegion,
  parseRosterFile,
  parseRosterText,
  saveStudent,
} from '../../lib/roster';
import { getPrefRegion, setPrefRegion } from '../../lib/adminPrefs';
import { REGIONS } from '../../lib/regions';
import type { AdminProfile, Student } from '../../types';
import type { RosterRow } from '../../lib/roster';

const TEMPLATE_HEADER = ['學員代碼', '學員姓名', '母班行政組織', '大組', '小組', '身份別', '手機'];

export default function StudentTab({ profile }: { profile: AdminProfile }) {
  const [region, setRegion] = useState(profile.role === 'region' ? profile.region : getPrefRegion());
  const [students, setStudents] = useState<Student[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<{ rows: RosterRow[]; errors: string[] } | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Student | null>(null);
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
      .then((list) => {
        setStudents(list);
        setSelected([]);
      })
      .catch((e: unknown) => {
        setStudents([]);
        setError('讀取名單失敗：' + (e instanceof Error ? e.message : String(e)));
      });
  }, [region]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetParsed = () => {
    setParsed(null);
    setText('');
    setFileName('');
  };

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
      resetParsed();
      reload();
    } catch (e) {
      setError('匯入失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim();
    return (students ?? []).filter((s) => {
      if (!q) return true;
      return (
        s.name.includes(q) ||
        s.studentId.includes(q) ||
        (s.phone ?? '').includes(q) ||
        s.classroom.includes(q) ||
        s.group.includes(q)
      );
    });
  }, [students, search]);

  const allChecked = filtered.length > 0 && filtered.every((s) => selected.includes(s.studentId));

  const toggleAll = () => {
    setSelected(allChecked ? [] : filtered.map((s) => s.studentId));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBatchDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`刪除選取的 ${selected.length} 位學員（含學習進度）？`)) return;
    setBusy(true);
    try {
      await deleteStudents(region, selected);
      reload();
    } catch (e) {
      setError('刪除失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const original = students?.find((s) => s.studentId === editing.studentId);
      await saveStudent(editing, original?.phone);
      setEditing(null);
      reload();
    } catch (e) {
      setError('儲存失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>學員名單</h2>
        {profile.role === 'region' ? (
          <span className="hint">{region}</span>
        ) : (
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
        )}
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
                <label className="btn small">
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
                placeholder={'學員代碼\t學員姓名\t母班行政組織\t大組\t小組\t身份別\t手機'}
              />
            </details>

            {parsed && parsed.rows.length > 0 && (
              <div className="preview">
                <p className="hint">前 3 筆預覽</p>
                <div className="table-scroll">
                  <table className="admin-table compact">
                    <thead>
                      <tr>
                        <th>學員代碼</th>
                        <th>姓名</th>
                        <th>手機</th>
                        <th>母班</th>
                        <th>組別</th>
                        <th>身份</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 3).map((r) => (
                        <tr key={r.studentId}>
                          <td className="mono">{r.studentId}</td>
                          <td>{r.name}</td>
                          <td className="mono">{r.phone || '—'}</td>
                          <td>{r.classroom}</td>
                          <td>{r.group}</td>
                          <td>{r.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

          {editing && (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="section-head">
                <h3>
                  編輯 {editing.name}
                  <span className="hint mono"> {editing.studentId}</span>
                </h3>
                <div className="row-gap">
                  <button className="btn" onClick={() => setEditing(null)}>
                    取消
                  </button>
                  <button className="btn primary" onClick={handleSaveEdit} disabled={busy}>
                    儲存
                  </button>
                </div>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>姓名</span>
                  <input
                    className="input"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>手機</span>
                  <input
                    className="input mono"
                    value={editing.phone ?? ''}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    placeholder="0912345678"
                  />
                </label>
                <label className="field">
                  <span>母班</span>
                  <input
                    className="input"
                    value={editing.classroom}
                    onChange={(e) => setEditing({ ...editing, classroom: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>組別</span>
                  <input
                    className="input"
                    value={editing.group}
                    onChange={(e) => setEditing({ ...editing, group: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>身份</span>
                  <input
                    className="input"
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="section-head">
              <h3>
                {region}（{students?.length ?? 0} 人）
              </h3>
              <div className="row-gap">
                {selected.length > 0 && (
                  <button className="btn small danger" onClick={handleBatchDelete} disabled={busy}>
                    刪除選取（{selected.length}）
                  </button>
                )}
                <input
                  className="input"
                  style={{ width: 200 }}
                  placeholder="搜尋代碼 / 姓名 / 手機"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
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
                      <th className="check-col">
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="全選" />
                      </th>
                      <th>學員代碼</th>
                      <th>姓名</th>
                      <th>手機</th>
                      <th>母班</th>
                      <th>組別</th>
                      <th>身份</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.studentId}>
                        <td className="check-col">
                          <input
                            type="checkbox"
                            checked={selected.includes(s.studentId)}
                            onChange={() => toggleOne(s.studentId)}
                            aria-label={`選取 ${s.name}`}
                          />
                        </td>
                        <td className="mono">{s.studentId}</td>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td className="mono">{s.phone || ''}</td>
                        <td>{s.classroom}</td>
                        <td>{s.group}</td>
                        <td>{s.role}</td>
                        <td className="ta-right">
                          <button className="btn tiny" onClick={() => setEditing({ ...s })}>
                            編輯
                          </button>
                          <button
                            className="btn tiny ghost danger"
                            onClick={async () => {
                              if (!window.confirm(`刪除「${s.name}」的名單與學習進度？`)) return;
                              try {
                                await deleteStudent(s.region, s.studentId);
                                reload();
                              } catch (e) {
                                setError('刪除失敗：' + (e instanceof Error ? e.message : String(e)));
                              }
                            }}
                          >
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../../lib/csv';
import {
  deleteStudent,
  importRoster,
  listStudentsInRegion,
  maskPhone,
  parseRosterText,
} from '../../lib/roster';
import { getPrefRegion, setPrefRegion } from '../../lib/adminPrefs';
import { REGIONS } from '../../lib/regions';
import type { AdminProfile, Student } from '../../types';

interface Props {
  profile: AdminProfile;
}

const TEMPLATE_HEADER = ['uid', '區域', '教室', '組別', '身份', '姓名', '電話'];

export default function StudentTab({ profile }: Props) {
  const fixedRegion = profile.role === 'region' ? profile.region : '';
  const [region, setRegion] = useState(fixedRegion || getPrefRegion());
  const [students, setStudents] = useState<Student[] | null>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseRosterText(text) : null), [text]);

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
    setText(await file.text());
  };

  const handleTemplate = () => {
    downloadCsv(`學員名單範本_${region || '空白'}.csv`, [
      TEMPLATE_HEADER,
      ['', region, '', '', '', '', ''],
    ]);
  };

  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0 || !region) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await importRoster(region, parsed.rows);
      const parts = [`已匯入 ${result.created} 筆到「${region}」`];
      if (result.duplicates.length) parts.push(`檔案內重複電話：${result.duplicates.join('、')}`);
      if (result.regionMismatch.length)
        parts.push(`區域欄與指定區域不同（仍以「${region}」匯入）：${result.regionMismatch.join('、')}`);
      setMessage(parts.join('｜'));
      setText('');
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
      await deleteStudent(s.region, s.phoneKey);
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
      s.phoneKey.includes(q) ||
      s.classroom.includes(q) ||
      s.group.includes(q) ||
      s.studentId.includes(q)
    );
  });

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <div>
          <h2>學員名單</h2>
          <p className="hint">
            {profile.role === 'region' ? `你只能管理「${fixedRegion}」的名單。` : '選擇區域後即可匯入該區名單。'}
          </p>
        </div>
        {profile.role === 'course' && (
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
          <p>請先選擇要管理的區域。</p>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="section-head">
              <h3>匯入名單</h3>
              <div className="row-gap">
                <button className="btn small" onClick={handleTemplate}>
                  下載空白範本
                </button>
                <label className="btn small">
                  選擇檔案
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv"
                    hidden
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            <p className="hint">
              範本欄位：uid、區域、教室、組別、身份、姓名、電話。可直接用 Excel 填好後複製整塊貼到下方，
              或另存 CSV 後用「選擇檔案」。區域欄可留空，一律以本頁選擇的「{region}」為準。
            </p>
            <textarea
              className="input mono"
              rows={7}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'uid\t區域\t教室\t組別\t身份\t姓名\t電話'}
            />
            <div className="row-gap" style={{ marginTop: 10 }}>
              <button
                className="btn primary"
                onClick={handleImport}
                disabled={busy || !parsed || parsed.rows.length === 0}
              >
                {busy ? '匯入中…' : `匯入到「${region}」`}
              </button>
              {parsed && (
                <span className="hint">
                  讀到 {parsed.rows.length} 筆可匯入
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
                「{region}」名單（{students?.length ?? 0} 人）
              </h3>
              <input
                className="input"
                style={{ width: 200 }}
                placeholder="搜尋姓名 / 電話 / 教室"
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
                      <th>uid</th>
                      <th>教室</th>
                      <th>組別</th>
                      <th>身份</th>
                      <th>姓名</th>
                      <th>電話</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.phoneKey}>
                        <td className="mono">{s.studentId}</td>
                        <td>{s.classroom}</td>
                        <td>{s.group}</td>
                        <td>{s.role}</td>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td className="mono">{maskPhone(s.phoneKey)}</td>
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
            <p className="hint" style={{ marginTop: 10 }}>
              要修改某位學員的資料，直接重新匯入該筆（同電話會覆蓋）。
            </p>
          </div>
        </>
      )}
    </div>
  );
}

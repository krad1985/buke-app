import { useEffect, useState } from 'react';
import { authMessage, loginAdmin, registerAdmin } from '../../lib/admins';
import { listSeries } from '../../lib/series';
import { REGIONS } from '../../lib/regions';
import type { AdminProfile, AdminRequest, Series } from '../../types';

export default function AdminLogin({ onSignedIn }: { onSignedIn: (p: AdminProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [request, setRequest] = useState<AdminRequest>({
    role: 'classroom',
    region: '',
    classroom: '',
    seriesIds: [],
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  useEffect(() => {
    listSeries()
      .then(setSeriesList)
      .catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (mode === 'register') {
        await registerAdmin(email, password, name, request);
        setOk('已送出申請，核准後即可登入。');
        setMode('login');
      } else {
        onSignedIn(await loginAdmin(email, password));
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code ? authMessage(code) : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel login-panel">
      <h1>{mode === 'register' ? '申請管理帳號' : '管理後台'}</h1>

      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>電子郵件</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>密碼</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {mode === 'register' && (
          <>
            <label className="field">
              <span>姓名</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>申請角色</span>
              <select
                className="select"
                value={request.role}
                onChange={(e) =>
                  setRequest({ ...request, role: e.target.value as AdminRequest['role'] })
                }
              >
                <option value="classroom">教室窗口</option>
                <option value="region">區域窗口</option>
                <option value="series">系列管理員</option>
              </select>
            </label>
            {request.role !== 'series' && (
              <label className="field">
                <span>區域</span>
                <select
                  className="select"
                  value={request.region}
                  onChange={(e) => setRequest({ ...request, region: e.target.value })}
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
            {request.role === 'classroom' && (
              <label className="field">
                <span>教室</span>
                <input
                  className="input"
                  value={request.classroom}
                  onChange={(e) => setRequest({ ...request, classroom: e.target.value })}
                  placeholder="例：201"
                />
              </label>
            )}
            {request.role === 'series' && (
              <div className="field span2">
                <span>申請的系列</span>
                <div className="checkline span2">
                  {seriesList.length === 0 ? (
                    <span className="hint">尚未建立系列</span>
                  ) : (
                    seriesList.map((s) => (
                      <label key={s.seriesId} className="checkline">
                        <input
                          type="checkbox"
                          checked={request.seriesIds.includes(s.seriesId)}
                          onChange={() =>
                            setRequest({
                              ...request,
                              seriesIds: request.seriesIds.includes(s.seriesId)
                                ? request.seriesIds.filter((x) => x !== s.seriesId)
                                : [...request.seriesIds, s.seriesId],
                            })
                          }
                        />
                        <span>{s.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
            <label className="field">
              <span>備註（給核准的人看）</span>
              <input
                className="input"
                value={request.note}
                onChange={(e) => setRequest({ ...request, note: e.target.value })}
                placeholder="例：我是北區 201 的班長"
              />
            </label>
          </>
        )}

        {error && <p className="form-error">{error}</p>}
        {ok && <p className="form-ok">{ok}</p>}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '處理中…' : mode === 'register' ? '送出申請' : '登入'}
        </button>
      </form>

      <p className="gate-skip">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
            setOk(null);
          }}
        >
          {mode === 'register' ? '回登入' : '申請帳號'}
        </button>
      </p>
    </div>
  );
}

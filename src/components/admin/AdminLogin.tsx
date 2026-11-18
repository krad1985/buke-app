import { useState } from 'react';
import { authMessage, bootstrapAdmin, loginAdmin, registerAdmin } from '../../lib/admins';
import { REGIONS } from '../../lib/regions';
import type { AdminProfile, AdminRequest } from '../../types';

type Mode = 'login' | 'setup' | 'register';

export default function AdminLogin({ onSignedIn }: { onSignedIn: (p: AdminProfile) => void }) {
  const [mode, setMode] = useState<Mode>('login');
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
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'setup') {
        onSignedIn(await bootstrapAdmin(email, password, name));
      } else if (mode === 'register') {
        await registerAdmin(email, password, name, request);
        setMode('login');
        setError('已送出申請，請等管理員核准後再登入。');
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
      <h1>
        {mode === 'setup' ? '建立總管理員' : mode === 'register' ? '申請管理帳號' : '管理後台'}
      </h1>

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

        {mode !== 'login' && (
          <label className="field">
            <span>姓名</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}

        {mode === 'register' && (
          <>
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

        {error && <p className={mode === 'register' && !error.includes('失敗') ? 'form-ok' : 'form-error'}>{error}</p>}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '處理中…' : mode === 'setup' ? '建立並登入' : mode === 'register' ? '送出申請' : '登入'}
        </button>
      </form>

      <p className="gate-skip">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'register' ? '回登入' : '申請帳號'}
        </button>
        {mode === 'login' && (
          <>
            {'　'}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode('setup');
                setError(null);
              }}
            >
              第一次使用：建立總管理員
            </button>
          </>
        )}
      </p>
    </div>
  );
}

import { useState } from 'react';
import { adminCreatePassword, authErrorMessage } from '../../lib/firebase';
import { loginAdmin } from '../../lib/adminAuth';

export default function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [account, setAccount] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'setup') {
        if (password.length < 6) throw new Error('密碼至少 6 個字元。');
        if (password !== confirm) throw new Error('兩次輸入的密碼不一致。');
        await adminCreatePassword(password);
        onSignedIn();
        return;
      }
      await loginAdmin(account, password);
      onSignedIn();
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = (err as Error).message;
      if (code) setError(authErrorMessage(code));
      else if (message === 'NO_ACCOUNT') setError('查不到這個帳號。');
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel login-panel">
      <h1>{mode === 'setup' ? '設定管理密碼' : '管理後台登入'}</h1>
      <p className="hint">
        {mode === 'setup'
          ? '第一次使用：設定課程管理員（admin）的密碼。設定完之後，這個畫面就不會再用到。'
          : '請輸入管理員帳號與密碼。'}
      </p>

      <form onSubmit={submit} className="login-form">
        {mode === 'login' && (
          <label className="field">
            <span>帳號</span>
            <input
              className="input mono"
              autoComplete="username"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
            />
          </label>
        )}
        <label className="field">
          <span>{mode === 'setup' ? '設定密碼' : '密碼'}</span>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {mode === 'setup' && (
          <label className="field">
            <span>再輸入一次</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '處理中…' : mode === 'setup' ? '建立管理密碼' : '登入'}
        </button>
      </form>

      <p className="hint" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'setup' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? '第一次使用？設定管理密碼' : '回登入'}
        </button>
      </p>
    </div>
  );
}

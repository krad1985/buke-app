import { useState } from 'react';
import { loginAdmin } from '../../lib/admins';
import type { AdminProfile } from '../../types';

export default function AdminLogin({ onSignedIn }: { onSignedIn: (p: AdminProfile) => void }) {
  const [account, setAccount] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const profile = await loginAdmin(account, password);
      onSignedIn(profile);
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes('permission') || msg.includes('insufficient')
          ? '無法連線到管理員資料。'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel login-panel">
      <h1>登入</h1>

      <form onSubmit={submit} className="login-form">
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
        <label className="field">
          <span>密碼</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  );
}

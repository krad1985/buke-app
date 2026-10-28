import { useState } from 'react';
import { loginAdmin } from '../../lib/adminAuth';

export default function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginAdmin(password);
      onSignedIn();
    } catch (err) {
      const msg = (err as Error).message;
      setError(
        msg.includes('permission') || msg.includes('insufficient') ? '無法讀取管理設定。' : msg
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel login-panel">
      <h1>管理後台</h1>
      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>管理密碼</span>
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

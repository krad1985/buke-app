import { useState } from 'react';
import { changeAdminPass } from '../../lib/adminAuth';

export default function PasswordTab() {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPass !== confirm) {
      setError('兩次輸入的新密碼不一致。');
      return;
    }
    setBusy(true);
    try {
      await changeAdminPass(oldPass, newPass);
      setMessage('密碼已更新。');
      setOldPass('');
      setNewPass('');
      setConfirm('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>管理密碼</h2>
      </div>

      <div className="panel" style={{ maxWidth: 420 }}>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>目前密碼</span>
            <input
              className="input"
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>新密碼</span>
            <input
              className="input"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>再輸入一次</span>
            <input
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-ok">{message}</p>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? '更新中…' : '更新密碼'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { changeMyPassword, authMessage } from '../../lib/admins';
import type { AdminProfile } from '../../types';

interface Props {
  profile: AdminProfile;
  onChanged: (p: AdminProfile) => void;
}

export default function PasswordTab({ profile, onChanged }: Props) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirm) {
      setError('兩次輸入的新密碼不一致。');
      return;
    }
    setBusy(true);
    try {
      await changeMyPassword(oldPassword, newPassword);
      onChanged(profile);
      setMessage('密碼已更新。');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code ? authMessage(code) : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>我的密碼</h2>
        <span className="hint">{profile.email}</span>
      </div>

      <div className="panel" style={{ maxWidth: 420 }}>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>目前密碼</span>
            <input
              className="input"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>新密碼</span>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>再輸入一次</span>
            <input
              className="input"
              type="password"
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

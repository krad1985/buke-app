import { useState } from 'react';
import { changeMyPassword } from '../../lib/admins';
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
      const updated = await changeMyPassword(profile.account, oldPassword, newPassword);
      onChanged(updated);
      setMessage('密碼已更新，下次請用新密碼登入。');
      setOldPassword('');
      setNewPassword('');
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
        <div>
          <h2>我的密碼</h2>
          <p className="hint">
            目前登入：{profile.account}（{profile.name}）
          </p>
        </div>
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
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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

import { useState } from 'react';
import { changeMyPassword } from '../../lib/adminAuth';
import type { AdminProfile } from '../../types';

export default function PasswordTab({ profile }: { profile: AdminProfile }) {
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
      setMessage('密碼已更新，下次請用新密碼登入。');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setError('目前密碼不正確。');
      else if (code === 'auth/weak-password') setError('新密碼強度不足（至少 6 個字元）。');
      else setError((err as Error).message);
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
        <p className="hint" style={{ marginTop: 12 }}>
          忘記密碼時，請由課程管理員在「管理員」頁重設；課程管理員自己忘記時，需到 Firebase Console 重設。
        </p>
      </div>
    </div>
  );
}

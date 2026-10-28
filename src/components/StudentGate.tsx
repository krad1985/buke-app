import { useState } from 'react';
import { findStudentByLogin, toLookupKey } from '../lib/roster';
import type { Student } from '../types';

interface Props {
  onBound: (student: Student) => void;
  onSkip: () => void;
}

export default function StudentGate({ onBound, onSkip }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = toLookupKey(input);
    if (!key) {
      setError('請輸入學員代碼或手機號碼。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const student = await findStudentByLogin(key);
      if (!student) {
        setError('查不到這筆資料，請確認代碼或手機是否正確。');
        return;
      }
      onBound(student);
    } catch {
      setError('目前無法連線，請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="panel gate-card">
        <h1>請輸入學員代碼或手機</h1>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>學員代碼／手機</span>
            <input
              className="input mono"
              autoComplete="off"
              placeholder="TW00103698 或 0912345678"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? '查詢中…' : '開始上課'}
          </button>
        </form>
        <p className="gate-skip">
          <button type="button" className="link-btn" onClick={onSkip}>
            先看看課程
          </button>
        </p>
      </div>
    </div>
  );
}

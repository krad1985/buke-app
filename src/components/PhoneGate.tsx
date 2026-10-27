import { useState } from 'react';
import { findStudentByPhone, isValidPhone, normalizePhone } from '../lib/roster';
import type { Student } from '../types';

interface Props {
  onBound: (student: Student) => void;
  onSkip: () => void;
}

export default function PhoneGate({ onBound, onSkip }: Props) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = normalizePhone(phone);
    if (!isValidPhone(key)) {
      setError('請輸入完整的手機號碼。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const student = await findStudentByPhone(key);
      if (!student) {
        setError('查不到這個號碼，請確認或聯絡窗口更新名單。');
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
        <h1>請輸入手機號碼</h1>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>手機號碼</span>
            <input
              className="input mono"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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

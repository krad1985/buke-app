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
      setError('請輸入完整的手機號碼，例如 0912345678。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const student = await findStudentByPhone(key);
      if (!student) {
        setError('查不到這個號碼。請確認號碼是否正確，或聯絡課程窗口更新名單。');
        return;
      }
      onBound(student);
    } catch {
      setError('目前無法連線到名單，請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="panel gate-card">
        <h1>請輸入手機號碼</h1>
        <p className="hint">
          系統用電話號碼辨識學員，用來記錄你的補課進度。不需要密碼，也不需要註冊。
        </p>
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
        <p className="hint" style={{ marginTop: 14 }}>
          <button type="button" className="link-btn" onClick={onSkip}>
            先看看課程（不記錄進度）
          </button>
        </p>
      </div>
      <p className="hint gate-note">
        提醒：這是防君子的設計。知道他人電話號碼的人可以看到該筆進度，但名單無法整批下載。
      </p>
    </div>
  );
}

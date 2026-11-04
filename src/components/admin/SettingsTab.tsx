import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '../../lib/settings';
import type { AppSettings } from '../../types';

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e: unknown) => setError(String((e as Error).message)));
  }, []);

  const toggle = async (value: boolean) => {
    setError(null);
    setMessage(null);
    const next = { ...(settings ?? { allowGuestView: true }), allowGuestView: value };
    setSettings(next);
    try {
      await saveSettings(next);
      setMessage('已更新。');
    } catch (e) {
      setError('儲存失敗：' + (e as Error).message);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>設定</h2>
      </div>

      <div className="panel">
        <h3>訪客瀏覽</h3>
        {settings === null ? (
          <p className="hint">載入中…</p>
        ) : (
          <label className="checkline">
            <input
              type="checkbox"
              checked={settings.allowGuestView}
              onChange={(e) => void toggle(e.target.checked)}
            />
            <span>允許未登入的人查看課程（關閉後，必須輸入學員代碼或手機才能進入）</span>
          </label>
        )}
        {message && <p className="form-ok">{message}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

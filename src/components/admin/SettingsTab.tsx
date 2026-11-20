import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '../../lib/settings';
import { backfillRosters } from '../../lib/roster';
import { repairAdminScopes } from '../../lib/admins';
import { logEvent } from '../../lib/audit';
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
      logEvent({ action: 'settings.update', detail: { allowGuestView: value } });
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

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>補齊名單資料</h3>
        <p className="hint">
          舊名單補上「教室索引」與「公開投影」（不含電話）。換版後學員端讀的是公開投影，
          若有人登入後看不到資料，按一次這個就好。
        </p>
        <button
          className="btn"
          onClick={async () => {
            setMessage(null);
            setError(null);
            try {
              const n = await backfillRosters();
              logEvent({ action: 'roster.import', target: 'backfill', detail: { count: n } });
              setMessage(`已補齊 ${n} 筆。`);
            } catch (e) {
              setError('補齊失敗：' + (e as Error).message);
            }
          }}
        >
          執行補齊
        </button>

        <p className="hint" style={{ marginTop: 16 }}>
          舊的管理員帳號缺少「區域／教室索引」，教室窗口會讀不到名單。按一次重建即可。
        </p>
        <button
          className="btn"
          onClick={async () => {
            setMessage(null);
            setError(null);
            try {
              const n = await repairAdminScopes();
              setMessage(`已重建 ${n} 個管理員的權限索引。`);
            } catch (e) {
              setError('重建失敗：' + (e as Error).message);
            }
          }}
        >
          重建管理員索引
        </button>
      </div>
    </div>
  );
}

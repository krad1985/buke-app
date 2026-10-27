import { useCallback, useEffect, useState } from 'react';
import { createAdmin, listAdmins, removeAdmin, resetAdminPassword, setAdminEnabled } from '../../lib/adminAuth';
import { REGIONS } from '../../lib/regions';
import type { AdminProfile, AdminRole } from '../../types';

interface Props {
  profile: AdminProfile;
}

export default function AdminTab({ profile }: Props) {
  const [admins, setAdmins] = useState<AdminProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole>('region');
  const [region, setRegion] = useState('');
  const [password, setPassword] = useState('');

  const [resetting, setResetting] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const reload = useCallback(() => {
    listAdmins()
      .then(setAdmins)
      .catch((e: unknown) => {
        setAdmins([]);
        setError('讀取管理員失敗：' + (e instanceof Error ? e.message : String(e)));
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await createAdmin({ account, name, role, region, password });
      setOk(`已建立管理員「${account}」，請把帳號與密碼交給對方。`);
      setAccount('');
      setName('');
      setRegion('');
      setPassword('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (target: AdminProfile) => {
    setError(null);
    setOk(null);
    try {
      await resetAdminPassword(target, newPassword);
      setOk(`已重設「${target.account}」的密碼。`);
      setResetting(null);
      setNewPassword('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <div>
          <h2>管理員</h2>
          <p className="hint">
            課程管理員可維護課程與管理員；區域管理員只能匯入自己區域的名單、匯出自己區域的補課記錄。
          </p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {ok && <p className="form-ok">{ok}</p>}

      <div className="panel">
        <h3>現有管理員</h3>
        {admins === null ? (
          <p className="hint">載入中…</p>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>帳號</th>
                  <th>姓名</th>
                  <th>角色</th>
                  <th>區域</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.uid}>
                    <td className="mono">{a.account}</td>
                    <td>{a.name}</td>
                    <td>{a.role === 'course' ? '課程管理員' : '區域管理員'}</td>
                    <td>{a.region || '—'}</td>
                    <td>
                      <span className={`state-dot ${a.enabled === false ? 'idle' : 'done'}`}>
                        {a.enabled === false ? '已停用' : '啟用中'}
                      </span>
                    </td>
                    <td className="ta-right">
                      {a.account !== profile.account && (
                        <>
                          <button
                            className="btn tiny"
                            onClick={() =>
                              setAdminEnabled(a.uid, a.enabled === false)
                                .then(reload)
                                .catch((e: unknown) => setError((e as Error).message))
                            }
                          >
                            {a.enabled === false ? '啟用' : '停用'}
                          </button>
                          <button
                            className="btn tiny"
                            onClick={() => {
                              setResetting(a.uid);
                              setNewPassword('');
                            }}
                          >
                            重設密碼
                          </button>
                          <button
                            className="btn tiny ghost danger"
                            onClick={() => {
                              if (!window.confirm(`移除管理員「${a.account}」？對方將立即失去後台權限。`)) return;
                              removeAdmin(a)
                                .then(reload)
                                .catch((e: unknown) => setError((e as Error).message));
                            }}
                          >
                            移除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {resetting && (
          <div className="inline-form">
            <span className="hint">設定新密碼（至少 6 個字元）</span>
            <input
              className="input"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密碼"
            />
            <button
              className="btn primary small"
              onClick={() => {
                const target = admins?.find((a) => a.uid === resetting);
                if (target) void handleReset(target);
              }}
            >
              確認重設
            </button>
            <button className="btn small ghost" onClick={() => setResetting(null)}>
              取消
            </button>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>新增管理員</h3>
        <form onSubmit={submit} className="form-grid">
          <label className="field">
            <span>帳號（英數字）</span>
            <input
              className="input mono"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="例：tainan01"
              required
            />
          </label>
          <label className="field">
            <span>姓名</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：王小明" />
          </label>
          <label className="field">
            <span>角色</span>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              <option value="region">區域管理員</option>
              <option value="course">課程管理員</option>
            </select>
          </label>
          <label className="field">
            <span>區域（區域管理員必填）</span>
            <select
              className="select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={role !== 'region'}
            >
              <option value="">請選擇</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>初始密碼</span>
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
              required
            />
          </label>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '建立中…' : '建立'}
            </button>
          </div>
        </form>
        <p className="hint">
          建立的帳號會立刻生效。帳號與區域一旦建立就不要隨意變更，避免與既有名單路徑不一致。
        </p>
      </div>
    </div>
  );
}

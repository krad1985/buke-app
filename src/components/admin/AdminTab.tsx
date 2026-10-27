import { useCallback, useEffect, useState } from 'react';
import {
  createAdmin,
  listAdmins,
  removeAdmin,
  resetAdminPassword,
  setAdminEnabled,
} from '../../lib/admins';
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
  const [pass, setPass] = useState('');

  const [resetting, setResetting] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');

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
      await createAdmin({ account, name, role, region, pass });
      setOk(`已建立「${account}」，帳號密碼請交給對方。`);
      setAccount('');
      setName('');
      setRegion('');
      setPass('');
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
      await resetAdminPassword(target.account, newPass);
      setOk(`已把「${target.account}」的密碼改為新密碼。`);
      setResetting(null);
      setNewPass('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>管理員</h2>
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
                  <tr key={a.account}>
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
                              setAdminEnabled(a.account, a.enabled === false)
                                .then(reload)
                                .catch((e: unknown) => setError((e as Error).message))
                            }
                          >
                            {a.enabled === false ? '啟用' : '停用'}
                          </button>
                          <button
                            className="btn tiny"
                            onClick={() => {
                              setResetting(a.account);
                              setNewPass('');
                            }}
                          >
                            改密碼
                          </button>
                          <button
                            className="btn tiny ghost danger"
                            onClick={() => {
                              if (!window.confirm(`移除管理員「${a.account}」？`)) return;
                              removeAdmin(a.account)
                                .then(reload)
                                .catch((e: unknown) => setError((e as Error).message));
                            }}
                          >
                            移除
                          </button>
                        </>
                      )}
                      {a.account === profile.account && <span className="hint">目前登入中</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {resetting && (
          <div className="inline-form">
            <span className="hint">新密碼</span>
            <input className="input" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button
              className="btn primary small"
              onClick={() => {
                const target = admins?.find((a) => a.account === resetting);
                if (target) void handleReset(target);
              }}
            >
              確認
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
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
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
            <span>登入密碼</span>
            <input className="input" value={pass} onChange={(e) => setPass(e.target.value)} required />
          </label>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '建立中…' : '建立'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

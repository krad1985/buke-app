import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAdmin,
  listAdmins,
  removeAdmin,
  resetAdminPassword,
  setAdminEnabled,
} from '../../lib/admins';
import { REGIONS } from '../../lib/regions';
import type { AdminProfile, AdminRole, Series } from '../../types';

interface Props {
  profile: AdminProfile;
  series: Series[];
}

const ROLE_LABEL: Record<AdminRole, string> = {
  super: '總管理員',
  series: '系列管理員',
  region: '區域窗口',
  classroom: '教室窗口',
};

export default function AdminTab({ profile, series }: Props) {
  const isSuper = profile.role === 'super';
  const [admins, setAdmins] = useState<AdminProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole>(isSuper ? 'series' : 'classroom');
  const [region, setRegion] = useState(isSuper ? '' : profile.region);
  const [classroom, setClassroom] = useState('');
  const [seriesIds, setSeriesIds] = useState<string[]>([]);
  const [pass, setPass] = useState('');

  const [resetting, setResetting] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');

  const reload = useCallback(() => {
    listAdmins()
      .then(setAdmins)
      .catch((e: unknown) => {
        setAdmins([]);
        setError('讀取管理員失敗：' + (e as Error).message);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const visible = useMemo(() => {
    if (!admins) return [];
    if (isSuper) return admins;
    return admins.filter(
      (a) => a.role === 'classroom' && a.region === profile.region
    );
  }, [admins, isSuper, profile.region]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await createAdmin({
        account,
        name,
        role,
        region,
        classroom,
        seriesIds,
        pass,
      });
      setOk(`已建立「${account}」。`);
      setAccount('');
      setName('');
      setClassroom('');
      setSeriesIds([]);
      setPass('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSeries = (id: string) => {
    setSeriesIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>{isSuper ? '管理員' : '教室窗口'}</h2>
      </div>

      {error && <p className="form-error">{error}</p>}
      {ok && <p className="form-ok">{ok}</p>}

      <div className="panel">
        <h3>現有帳號</h3>
        {admins === null ? (
          <p className="hint">載入中…</p>
        ) : visible.length === 0 ? (
          <p className="hint">沒有資料。</p>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>帳號</th>
                  <th>姓名</th>
                  <th>角色</th>
                  <th>範圍</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.account}>
                    <td className="mono">{a.account}</td>
                    <td>{a.name}</td>
                    <td>{ROLE_LABEL[a.role]}</td>
                    <td>{scopeLabel(a, series)}</td>
                    <td>
                      <span className={`state-dot ${a.enabled === false ? 'idle' : 'done'}`}>
                        {a.enabled === false ? '已停用' : '啟用中'}
                      </span>
                    </td>
                    <td className="ta-right">
                      {a.account !== profile.account ? (
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
                              if (!window.confirm(`移除「${a.account}」？`)) return;
                              removeAdmin(a.account)
                                .then(reload)
                                .catch((e: unknown) => setError((e as Error).message));
                            }}
                          >
                            移除
                          </button>
                        </>
                      ) : (
                        <span className="hint">目前登入中</span>
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
            <span className="hint">新密碼</span>
            <input className="input" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button
              className="btn primary small"
              onClick={() => {
                const target = admins?.find((a) => a.account === resetting);
                if (!target) return;
                resetAdminPassword(target.account, newPass)
                  .then(() => {
                    setResetting(null);
                    setNewPass('');
                    reload();
                  })
                  .catch((e: unknown) => setError((e as Error).message));
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
        <h3>{isSuper ? '新增管理員' : '新增教室窗口'}</h3>
        <form onSubmit={submit} className="form-grid">
          <label className="field">
            <span>帳號（英數字）</span>
            <input
              className="input mono"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="例：tn01"
              required
            />
          </label>
          <label className="field">
            <span>姓名</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          {isSuper && (
            <label className="field">
              <span>角色</span>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                <option value="super">總管理員</option>
                <option value="series">系列管理員</option>
                <option value="region">區域窗口</option>
                <option value="classroom">教室窗口</option>
              </select>
            </label>
          )}

          {(role === 'region' || role === 'classroom') && (
            <label className="field">
              <span>區域</span>
              <select
                className="select"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={!isSuper}
              >
                <option value="">請選擇</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          {role === 'classroom' && (
            <label className="field">
              <span>教室</span>
              <input
                className="input"
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder="例：201"
              />
            </label>
          )}

          {role === 'series' && (
            <div className="field span2">
              <span>可管理的系列</span>
              <div className="checkline span2">
                {series.length === 0 ? (
                  <span className="hint">尚未建立系列</span>
                ) : (
                  series.map((s) => (
                    <label key={s.seriesId} className="checkline">
                      <input
                        type="checkbox"
                        checked={seriesIds.includes(s.seriesId)}
                        onChange={() => toggleSeries(s.seriesId)}
                      />
                      <span>{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

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

function scopeLabel(a: AdminProfile, series: Series[]): string {
  if (a.role === 'series') {
    const names = series.filter((s) => a.seriesIds?.includes(s.seriesId)).map((s) => s.name);
    return names.length ? names.join('、') : '未指定';
  }
  if (a.role === 'classroom') return `${a.region}／${a.classroom}`;
  if (a.role === 'region') return a.region;
  return '全部';
}

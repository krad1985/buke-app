import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addGrant,
  createAdmin,
  listAdmins,
  removeAdmin,
  removeGrant,
  resetAdminPassword,
  setAdminEnabled,
} from '../../lib/admins';
import { REGIONS } from '../../lib/regions';
import type { AdminGrant, AdminProfile, AdminRole, Series } from '../../types';

interface Props {
  profile: AdminProfile;
  series: Series[];
}

type GrantDraft = Omit<AdminGrant, 'id'>;

const emptyGrant = (): GrantDraft => ({
  role: 'region',
  region: '',
  classroom: '',
  seriesIds: [],
});

export default function AdminTab({ profile, series }: Props) {
  const isSuper = profile.role === 'super';
  const [admins, setAdmins] = useState<AdminProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [superAdmin, setSuperAdmin] = useState(false);
  const [grant, setGrant] = useState<GrantDraft>(emptyGrant());

  const [editingGrants, setEditingGrants] = useState<string | null>(null);
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
    return admins.filter((a) =>
      a.grants.some((g) => g.role === 'classroom' && g.region === profile.region)
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
        pass,
        superAdmin,
        grants: superAdmin ? [] : [grant],
      });
      setOk(`已建立「${account}」。`);
      setAccount('');
      setName('');
      setPass('');
      setSuperAdmin(false);
      setGrant(emptyGrant());
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddGrant = async (target: AdminProfile) => {
    setError(null);
    setOk(null);
    try {
      await addGrant(target.account, grant);
      setGrant(emptyGrant());
      setOk(`已新增權限給「${target.account}」。`);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
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
                  <th>權限</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.account}>
                    <td className="mono">{a.account}</td>
                    <td>{a.name}</td>
                    <td>
                      <span className="grant-list">{summarize(a, series).join('、')}</span>
                    </td>
                    <td>
                      <span className={`state-dot ${a.enabled === false ? 'idle' : 'done'}`}>
                        {a.enabled === false ? '已停用' : '啟用中'}
                      </span>
                    </td>
                    <td className="ta-right">
                      {isSuper && (
                        <button className="btn tiny" onClick={() => setEditingGrants(a.account)}>
                          權限
                        </button>
                      )}
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
                              if (!window.confirm(`移除「${a.account}」？`)) return;
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

        {editingGrants && (
          <GrantEditor
            target={visible.find((a) => a.account === editingGrants) ?? null}
            series={series}
            grant={grant}
            setGrant={setGrant}
            onAdd={() => {
              const target = visible.find((a) => a.account === editingGrants);
              if (target) void handleAddGrant(target);
            }}
            onRemove={(grantId) => {
              const target = visible.find((a) => a.account === editingGrants);
              if (!target) return;
              removeGrant(target.account, grantId)
                .then(reload)
                .catch((e: unknown) => setError((e as Error).message));
            }}
            onClose={() => setEditingGrants(null)}
          />
        )}

        {resetting && (
          <div className="inline-form">
            <span className="hint">新密碼</span>
            <input className="input" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button
              className="btn primary small"
              onClick={() => {
                resetAdminPassword(resetting, newPass)
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
          <label className="field">
            <span>登入密碼</span>
            <input className="input" value={pass} onChange={(e) => setPass(e.target.value)} required />
          </label>

          {isSuper && (
            <label className="checkline" style={{ alignSelf: 'end', paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={superAdmin}
                onChange={(e) => setSuperAdmin(e.target.checked)}
              />
              <span>總管理員（全權）</span>
            </label>
          )}

          {!superAdmin && (
            <GrantFields grant={grant} setGrant={setGrant} series={series} lockedRegion={isSuper ? '' : profile.region} />
          )}

          <div className="field span2" style={{ alignItems: 'flex-end' }}>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? '建立中…' : '建立'}
            </button>
          </div>
        </form>
        <p className="hint">建立後可在「權限」再追加其他身分，同一個帳號登入後可切換。</p>
      </div>
    </div>
  );
}

function GrantFields({
  grant,
  setGrant,
  series,
  lockedRegion,
}: {
  grant: GrantDraft;
  setGrant: (g: GrantDraft) => void;
  series: Series[];
  lockedRegion: string;
}) {
  return (
    <>
      <label className="field">
        <span>權限角色</span>
        <select
          className="select"
          value={grant.role}
          onChange={(e) => setGrant({ ...grant, role: e.target.value as AdminGrant['role'] })}
        >
          <option value="region">區域窗口</option>
          <option value="classroom">教室窗口</option>
          <option value="series">系列管理員</option>
        </select>
      </label>

      {(grant.role === 'region' || grant.role === 'classroom') && (
        <label className="field">
          <span>區域</span>
          <select
            className="select"
            value={grant.region || lockedRegion}
            onChange={(e) => setGrant({ ...grant, region: e.target.value })}
            disabled={!!lockedRegion}
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

      {grant.role === 'classroom' && (
        <label className="field">
          <span>教室</span>
          <input
            className="input"
            value={grant.classroom}
            onChange={(e) => setGrant({ ...grant, classroom: e.target.value })}
            placeholder="例：201"
          />
        </label>
      )}

      {grant.role === 'series' && (
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
                    checked={grant.seriesIds.includes(s.seriesId)}
                    onChange={() =>
                      setGrant({
                        ...grant,
                        seriesIds: grant.seriesIds.includes(s.seriesId)
                          ? grant.seriesIds.filter((x) => x !== s.seriesId)
                          : [...grant.seriesIds, s.seriesId],
                      })
                    }
                  />
                  <span>{s.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

function GrantEditor({
  target,
  series,
  grant,
  setGrant,
  onAdd,
  onRemove,
  onClose,
}: {
  target: AdminProfile | null;
  series: Series[];
  grant: GrantDraft;
  setGrant: (g: GrantDraft) => void;
  onAdd: () => void;
  onRemove: (grantId: string) => void;
  onClose: () => void;
}) {
  if (!target) return null;
  return (
    <div className="grant-editor">
      <div className="section-head">
        <h3>
          {target.name}
          <span className="hint mono"> {target.account}</span>
        </h3>
        <button className="btn small" onClick={onClose}>
          關閉
        </button>
      </div>

      <ul className="grant-rows">
        {target.superAdmin && <li>總管理員（全權）</li>}
        {target.grants.map((g) => (
          <li key={g.id}>
            <span>{grantText(g, series)}</span>
            <button className="btn tiny ghost danger" onClick={() => onRemove(g.id)}>
              移除
            </button>
          </li>
        ))}
        {!target.superAdmin && target.grants.length === 0 && <li className="hint">尚無權限</li>}
      </ul>

      <div className="form-grid">
        <GrantFields grant={grant} setGrant={setGrant} series={series} lockedRegion="" />
        <div className="field span2">
          <button className="btn" onClick={onAdd}>
            新增這個權限
          </button>
        </div>
      </div>
    </div>
  );
}

function grantText(g: AdminGrant, series: Series[]): string {
  if (g.role === 'series') {
    const names = series.filter((s) => g.seriesIds.includes(s.seriesId)).map((s) => s.name);
    return `系列管理員：${names.length ? names.join('、') : '未指定'}`;
  }
  if (g.role === 'region') return `區域窗口：${g.region}`;
  return `教室窗口：${g.region}／${g.classroom}`;
}

function summarize(a: AdminProfile, series: Series[]): string[] {
  const out: string[] = [];
  if (a.superAdmin) out.push('總管理員');
  for (const g of a.grants) out.push(grantText(g, series));
  return out.length ? out : ['無權限'];
}

export const _role = (r: AdminRole) => r;

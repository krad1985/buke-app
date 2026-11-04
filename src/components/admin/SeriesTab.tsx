import { useState } from 'react';
import { saveSeries, deleteSeries, newSeriesId } from '../../lib/series';
import type { Series } from '../../types';

interface Props {
  series: Series[];
  onChanged: () => void;
}

export default function SeriesTab({ series, onChanged }: Props) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(series.length + 1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await saveSeries({ seriesId: newSeriesId(), name, sortOrder });
      setName('');
      setSortOrder(sortOrder + 1);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-home">
      <div className="admin-toolbar">
        <h2>系列課程</h2>
      </div>

      <div className="panel">
        <h3>現有系列</h3>
        {series.length === 0 ? (
          <p className="hint">還沒有系列。課程若未指定系列，所有學員都看得到。</p>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>名稱</th>
                  <th>排序</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.seriesId}>
                    <td>
                      <input
                        className="input"
                        defaultValue={s.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== s.name) void saveSeries({ ...s, name: v }).then(onChanged);
                        }}
                      />
                    </td>
                    <td className="mono">{s.sortOrder}</td>
                    <td className="ta-right">
                      <button
                        className="btn tiny ghost danger"
                        onClick={() => {
                          if (!window.confirm(`刪除系列「${s.name}」？（已屬於此系列的課程不會被刪除，但會失去系列歸屬）`))
                            return;
                          void deleteSeries(s.seriesId).then(onChanged);
                        }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>新增系列</h3>
        <form onSubmit={add} className="form-grid">
          <label className="field">
            <span>名稱</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：奢摩他儲"
            />
          </label>
          <label className="field">
            <span>排序</span>
            <input
              className="input narrow"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </label>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" type="submit" disabled={busy}>
              建立
            </button>
          </div>
        </form>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

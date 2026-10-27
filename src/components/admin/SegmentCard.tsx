import TimeInput from '../TimeInput';
import QuestionCard from './QuestionCard';
import { fmtTime } from '../../lib/format';
import type { Question, Segment } from '../../types';

interface Props {
  segment: Segment;
  index: number;
  total: number;
  now: number;
  videoDuration: number;
  onChange: (seg: Segment) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}

const newQuestion = (): Question => ({
  qid: `q-${Date.now().toString(36)}`,
  prompt: '',
  type: 'single',
  options: [
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
  ],
  correctKeys: ['A'],
});

export default function SegmentCard({
  segment,
  index,
  total,
  now,
  videoDuration,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: Props) {
  const patch = (p: Partial<Segment>) => onChange({ ...segment, ...p });
  const longEnough = videoDuration === 0 || segment.endSec <= videoDuration + 1;

  return (
    <div className="seg-card">
      <div className="seg-card-head">
        <span className="seg-num">第 {index + 1} 段</span>
        <input
          className="input title-input"
          value={segment.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="段落標題，例：第 2 段：皈依三寶"
        />
        <div className="row-gap">
          <button type="button" className="btn tiny ghost" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button
            type="button"
            className="btn tiny ghost"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" className="btn tiny ghost" onClick={onDuplicate}>
            複製
          </button>
          <button type="button" className="btn tiny ghost danger" onClick={onRemove}>
            刪除
          </button>
        </div>
      </div>

      <div className="seg-times">
        <label className="field inline">
          <span>開始</span>
          <TimeInput value={segment.startSec} onChange={(v) => patch({ startSec: v })} />
          <button type="button" className="btn tiny" onClick={() => patch({ startSec: Math.round(now) })}>
            用目前時間
          </button>
        </label>
        <label className="field inline">
          <span>結束</span>
          <TimeInput value={segment.endSec} onChange={(v) => patch({ endSec: v })} />
          <button type="button" className="btn tiny" onClick={() => patch({ endSec: Math.round(now) })}>
            用目前時間
          </button>
        </label>
        <span className="seg-len">長度 {fmtTime(Math.max(segment.endSec - segment.startSec, 0))}</span>
      </div>

      {!longEnough && (
        <p className="form-error">結束時間超影片長度（{fmtTime(videoDuration)}），播放時會自動截到片尾。</p>
      )}

      <div className="seg-rules">
        <label className="field inline">
          <span>通過條件</span>
          <select
            className="select"
            value={segment.passRule}
            onChange={(e) => patch({ passRule: e.target.value as Segment['passRule'] })}
          >
            <option value="allCorrect">全部答對</option>
            <option value="minCorrect">答對指定題數</option>
          </select>
        </label>
        {segment.passRule === 'minCorrect' && (
          <label className="field inline">
            <span>需答對</span>
            <input
              className="input narrow"
              type="number"
              min={1}
              value={segment.minCorrectCount ?? 1}
              onChange={(e) => patch({ minCorrectCount: Math.max(1, Number(e.target.value) || 1) })}
            />
            <span>題</span>
          </label>
        )}
        <label className="field inline">
          <span>可作答次數（0 = 不限）</span>
          <input
            className="input narrow"
            type="number"
            min={0}
            value={segment.maxAttempts}
            onChange={(e) => patch({ maxAttempts: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <label className="field inline">
          <span>答錯後</span>
          <select
            className="select"
            value={segment.onFailAction}
            onChange={(e) => patch({ onFailAction: e.target.value as Segment['onFailAction'] })}
          >
            <option value="retryQuiz">可直接重答</option>
            <option value="rewatch">重看本段</option>
          </select>
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={segment.showAnswerAfterFail}
            onChange={(e) => patch({ showAnswerAfterFail: e.target.checked })}
          />
          <span>答錯後顯示正解</span>
        </label>
      </div>

      <div className="q-list">
        {segment.questions.map((q, qi) => (
          <QuestionCard
            key={q.qid}
            question={q}
            index={qi}
            onChange={(nq) =>
              patch({ questions: segment.questions.map((x) => (x.qid === q.qid ? nq : x)) })
            }
            onRemove={() => patch({ questions: segment.questions.filter((x) => x.qid !== q.qid) })}
          />
        ))}
        <button
          type="button"
          className="btn small"
          onClick={() => patch({ questions: [...segment.questions, newQuestion()] })}
        >
          ＋ 新增題目
        </button>
      </div>
    </div>
  );
}

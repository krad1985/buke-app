import { fmtTime } from '../lib/format';
import type { Segment } from '../types';

interface Props {
  segments: Segment[];
  activeIndex: number;
  passed: number[];
  allowRewatch: boolean;
  onReplay: (index: number) => void;
}

export default function SegmentList({ segments, activeIndex, passed, allowRewatch, onReplay }: Props) {
  return (
    <aside className="panel segment-panel">
      <div className="panel-head">
        <h2>課程段落</h2>
      </div>
      <ol className="segment-list">
        {segments.map((seg) => {
          const isPassed = passed.includes(seg.segIndex);
          const isActive = seg.segIndex === activeIndex;
          const isLocked = !isPassed && !isActive;
          const canReplay = isPassed && allowRewatch && !isActive;
          return (
            <li
              key={seg.segIndex}
              className={[
                'segment-item',
                isPassed ? 'is-passed' : '',
                isActive ? 'is-active' : '',
                isLocked ? 'is-locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="segment-main">
                <span className="segment-state" aria-hidden="true">
                  {isPassed ? '✓' : isLocked ? '🔒' : '▶'}
                </span>
                <div>
                  <p className="segment-title">{seg.title}</p>
                  <p className="segment-time">
                    {fmtTime(seg.startSec)} – {fmtTime(seg.endSec)}
                  </p>
                </div>
              </div>
              {canReplay && (
                <button type="button" className="btn tiny" onClick={() => onReplay(seg.segIndex)}>
                  重看
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

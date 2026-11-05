import { fmtTime } from '../lib/format';
import { IconCheck, IconLock, IconPlay } from './Icons';
import type { Segment } from '../types';

interface Props {
  segments: Segment[];
  activeIndex: number;
  passed: number[];
  allowRewatch: boolean;
  /** 自由選看：所有段落都可點 */
  freeMode: boolean;
  onReplay: (index: number) => void;
}

export default function SegmentList({
  segments,
  activeIndex,
  passed,
  allowRewatch,
  freeMode,
  onReplay,
}: Props) {
  return (
    <aside className="panel segment-panel">
      <div className="panel-head">
        <h2>課程段落</h2>
      </div>
      <ol className="segment-list">
        {segments.map((seg) => {
          const isPassed = passed.includes(seg.segIndex);
          const isActive = seg.segIndex === activeIndex;
          const isLocked = !freeMode && !isPassed && !isActive;
          const canOpen = freeMode
            ? !isActive
            : isPassed && allowRewatch && !isActive;
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
                  {isPassed ? <IconCheck /> : isLocked ? <IconLock /> : <IconPlay size={12} />}
                </span>
                <div>
                  <p className="segment-title">{seg.title}</p>
                  <p className="segment-time">
                    {fmtTime(seg.startSec)} – {fmtTime(seg.endSec)}
                  </p>
                </div>
              </div>
              {canOpen && (
                <button type="button" className="btn tiny" onClick={() => onReplay(seg.segIndex)}>
                  {freeMode ? '看這段' : '重看'}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

import { useCallback, useMemo, useState } from 'react';
import SegmentCard from './SegmentCard';
import TimecodePicker from './TimecodePicker';
import { saveCourse } from '../../lib/coursesRepo';
import type { Course, Segment } from '../../types';

interface Props {
  course: Course;
  onSaved: () => void;
  onCancel: () => void;
}

function validate(c: Course): string[] {
  const errs: string[] = [];
  if (!c.title.trim()) errs.push('請填課程名稱');
  if (!c.youtubeVideoId.trim()) errs.push('請填 YouTube 影片 ID');
  if (c.segments.length === 0) errs.push('至少要有一個段落');

  c.segments.forEach((seg, i) => {
    const n = i + 1;
    if (seg.endSec <= seg.startSec) errs.push(`第 ${n} 段：結束時間要晚於開始時間`);
    if (seg.questions.length === 0) errs.push(`第 ${n} 段：至少要有一題`);
    seg.questions.forEach((q, qi) => {
      const tag = `第 ${n} 段第 ${qi + 1} 題`;
      if (!q.prompt.trim()) errs.push(`${tag}：題目不可空白`);
      if (q.options.length < 2) errs.push(`${tag}：至少要有兩個選項`);
      if (q.options.some((o) => !o.text.trim())) errs.push(`${tag}：選項內容不可空白`);
      if (q.correctKeys.length === 0) errs.push(`${tag}：請勾選正解`);
      if (q.correctKeys.some((k) => !q.options.some((o) => o.key === k)))
        errs.push(`${tag}：正解對不到任何選項`);
      if (q.type !== 'multiple' && q.correctKeys.length > 1) errs.push(`${tag}：單選題只能有一個正解`);
    });

    const next = c.segments[i + 1];
    if (next && seg.endSec > next.startSec) errs.push(`第 ${n} 段與第 ${n + 1} 段的時間重疊`);
  });

  return errs;
}

export default function CourseEditor({ course, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState<Course>(() => JSON.parse(JSON.stringify(course)) as Course);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const handleTick = useCallback((sec: number, dur: number) => {
    setNow(sec);
    if (dur > 0) setDuration(dur);
  }, []);

  const errors = useMemo(() => validate(draft), [draft]);

  const patch = (p: Partial<Course>) => setDraft((prev) => ({ ...prev, ...p }));

  const updateSegment = (index: number, seg: Segment) => {
    setDraft((prev) => ({
      ...prev,
      segments: prev.segments.map((s, i) => (i === index ? seg : s)),
    }));
  };

  const addSegment = () => {
    setDraft((prev) => {
      const last = prev.segments[prev.segments.length - 1];
      const start = last ? last.endSec : 0;
      return {
        ...prev,
        segments: [
          ...prev.segments,
          {
            segIndex: prev.segments.length,
            title: `第 ${prev.segments.length + 1} 段`,
            startSec: start,
            endSec: start + 300,
            passRule: 'allCorrect',
            maxAttempts: 0,
            onFailAction: 'retryQuiz',
            showAnswerAfterFail: true,
            questions: [
              {
                qid: `q-${Date.now().toString(36)}`,
                prompt: '',
                type: 'single',
                options: [
                  { key: 'A', text: '' },
                  { key: 'B', text: '' },
                  { key: 'C', text: '' },
                ],
                correctKeys: ['A'],
              },
            ],
          },
        ],
      };
    });
  };

  const removeSegment = (index: number) => {
    if (!window.confirm(`確定刪除第 ${index + 1} 段？`)) return;
    setDraft((prev) => ({ ...prev, segments: prev.segments.filter((_, i) => i !== index) }));
  };

  const moveSegment = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.segments.length) return;
    setDraft((prev) => {
      const list = [...prev.segments];
      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, segments: list };
    });
  };

  const duplicateSegment = (index: number) => {
    setDraft((prev) => {
      const src = prev.segments[index];
      const copy: Segment = JSON.parse(JSON.stringify(src)) as Segment;
      copy.title = `${src.title}（複本）`;
      copy.questions = copy.questions.map((q) => ({ ...q, qid: `q-${Math.random().toString(36).slice(2, 9)}` }));
      const list = [...prev.segments];
      list.splice(index + 1, 0, copy);
      return { ...prev, segments: list };
    });
  };

  const handleSave = async () => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      await saveCourse(draft);
      onSaved();
    } catch (e) {
      setServerError(
        '儲存失敗：' +
          (e instanceof Error ? e.message : String(e)) +
          '（若為 permission-denied，表示這個帳號不在 Firestore 規則的管理員名單內）'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editor">
      <div className="editor-top">
        <button className="btn ghost small" onClick={onCancel}>
          ← 回課程列表
        </button>
        <div className="row-gap">
          <a className="btn tiny ghost" href={`#/c/${draft.courseId}`} target="_blank" rel="noreferrer">
            預覽學員畫面
          </a>
          <button className="btn primary" onClick={handleSave} disabled={busy}>
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-col">
          <section className="panel">
            <h2>課程資料</h2>
            <div className="form-grid">
              <label className="field">
                <span>課程名稱</span>
                <input className="input" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
              </label>
              <label className="field">
                <span>講師（選填）</span>
                <input className="input" value={draft.teacher ?? ''} onChange={(e) => patch({ teacher: e.target.value })} />
              </label>
              <label className="field span2">
                <span>課程說明</span>
                <textarea
                  className="input"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </label>
              <label className="field">
                <span>YouTube 影片 ID</span>
                <input
                  className="input mono"
                  value={draft.youtubeVideoId}
                  onChange={(e) => patch({ youtubeVideoId: e.target.value.trim() })}
                  placeholder="例如 dQw4w9WgXcQ"
                />
              </label>
              <label className="field">
                <span>排序（小的在前）</span>
                <input
                  className="input narrow"
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => patch({ sortOrder: Number(e.target.value) || 0 })}
                />
              </label>
              <div className="checkline span2">
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={draft.isPublished}
                    onChange={(e) => patch({ isPublished: e.target.checked })}
                  />
                  <span>上架</span>
                </label>
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={draft.allowRewatch}
                    onChange={(e) => patch({ allowRewatch: e.target.checked })}
                  />
                  <span>允許重看已通過的段落</span>
                </label>
              </div>
            </div>
            <p className="hint">影片需為「公開」或「不公開」。</p>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>段落與題目</h2>
              <button className="btn small" onClick={addSegment}>
                ＋ 新增段落
              </button>
            </div>
            <div className="seg-list">
              {draft.segments.map((seg, i) => (
                <SegmentCard
                  key={`${seg.segIndex}-${i}`}
                  segment={seg}
                  index={i}
                  total={draft.segments.length}
                  now={now}
                  videoDuration={duration}
                  onChange={(s) => updateSegment(i, s)}
                  onRemove={() => removeSegment(i)}
                  onMove={(dir) => moveSegment(i, dir)}
                  onDuplicate={() => duplicateSegment(i)}
                />
              ))}
              {draft.segments.length === 0 && <p className="hint">尚無段落。</p>}
            </div>
          </section>
        </div>

        <div className="editor-col side">
          <div className="panel sticky">
            <h2>抓時間碼</h2>
            <TimecodePicker videoId={draft.youtubeVideoId} onTick={handleTick} />
          </div>
        </div>
      </div>

      {(showErrors || serverError) && (
        <div className="panel error-box">
          {serverError && <p className="form-error">{serverError}</p>}
          {showErrors && errors.length > 0 && (
            <>
              <p className="form-error">還有 {errors.length} 個問題要修：</p>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

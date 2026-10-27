import { useMemo, useState } from 'react';
import type { AnswerRecord, Segment } from '../types';

export interface QuizResult {
  passed: boolean;
  records: AnswerRecord[];
  correctCount: number;
  need: number;
}

interface Props {
  segment: Segment;
  /** 本段已作答次數（不含本次） */
  attemptCount: number;
  result: QuizResult | null;
  isLast: boolean;
  onCheck: (answers: Record<string, string[]>) => void;
  onRetry: () => void;
  onContinue: () => void;
  onRewatch: () => void;
}

export default function QuizPanel({
  segment,
  attemptCount,
  result,
  isLast,
  onCheck,
  onRetry,
  onContinue,
  onRewatch,
}: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const answeredAll = useMemo(
    () => segment.questions.every((q) => (selected[q.qid] ?? []).length > 0),
    [segment.questions, selected]
  );

  const recordOf = (qid: string) => result?.records.find((r) => r.qid === qid);
  const attemptsLeft = segment.maxAttempts > 0 ? segment.maxAttempts - attemptCount : Infinity;
  const exhausted = attemptsLeft <= 0;

  const toggle = (qid: string, key: string, multiple: boolean) => {
    if (result) return;
    setSelected((prev) => {
      const current = prev[qid] ?? [];
      if (!multiple) return { ...prev, [qid]: [key] };
      return {
        ...prev,
        [qid]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
      };
    });
  };

  return (
    <div className="panel quiz-panel">
      <div className="panel-head">
        <span className="chip">第 {segment.segIndex + 1} 段檢核</span>
        <h2>{segment.title}</h2>
        {segment.maxAttempts > 0 && (
          <p className="hint">
            可作答次數：{Math.max(segment.maxAttempts - attemptCount, 0)} 次
            {attemptCount > 0 ? `（已用 ${attemptCount} 次）` : ''}
          </p>
        )}
      </div>

      <div className="quiz-body">
        {segment.questions.map((q, qi) => {
          const rec = recordOf(q.qid);
          const multiple = q.type === 'multiple';
          const showCorrect =
            !!result && (result.passed || segment.showAnswerAfterFail);
          return (
            <div key={q.qid} className={`quiz-q ${rec ? (rec.correct ? 'q-ok' : 'q-bad') : ''}`}>
              <div className="quiz-q-text">
                <span className="q-index">{qi + 1}</span>
                <span>
                  {q.prompt}
                  {multiple && <em className="q-tag">多選</em>}
                </span>
              </div>

              <div className="quiz-options">
                {q.options.map((opt) => {
                  const isSelected = (selected[q.qid] ?? []).includes(opt.key);
                  const isCorrectKey = showCorrect && q.correctKeys.includes(opt.key);
                  const isWrongPick =
                    !!rec &&
                    !rec.correct &&
                    rec.selected.includes(opt.key) &&
                    !q.correctKeys.includes(opt.key);
                  return (
                    <button
                      type="button"
                      key={opt.key}
                      className={[
                        'quiz-opt',
                        isSelected ? 'selected' : '',
                        isCorrectKey ? 'is-correct' : '',
                        isWrongPick ? 'is-wrong' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => toggle(q.qid, opt.key, multiple)}
                      disabled={!!result}
                    >
                      <span className="opt-key">{opt.key}</span>
                      <span className="opt-text">{opt.text}</span>
                      {isCorrectKey && <span className="opt-mark">正解</span>}
                    </button>
                  );
                })}
              </div>

              {rec && !rec.correct && (
                <p className="q-msg bad">這一題答錯了</p>
              )}
              {showCorrect && q.explanation && <p className="q-msg">{q.explanation}</p>}
            </div>
          );
        })}
      </div>

      <div className="panel-foot">
        {!result && (
          <>
            <button
              type="button"
              className="btn primary"
              disabled={!answeredAll}
              onClick={() => onCheck(selected)}
            >
              送出答案
            </button>
            {!answeredAll && <span className="hint">每題都要作答才能送出</span>}
            <button type="button" className="btn ghost" onClick={onRewatch}>
              重看本段
            </button>
          </>
        )}

        {result && result.passed && (
          <>
            <p className="result-line ok">
              全部正確（{result.correctCount} / {segment.questions.length}），已通過本段。
            </p>
            <button type="button" className="btn primary" onClick={onContinue}>
              {isLast ? '完成課程' : '繼續下一段'}
            </button>
          </>
        )}

        {result && !result.passed && (
          <>
            <p className="result-line bad">
              答對 {result.correctCount} / {segment.questions.length}，
              {segment.passRule === 'allCorrect'
                ? '需全部答對才能解鎖下一段。'
                : `需答對 ${result.need} 題。`}
            </p>
            {exhausted ? (
              <button type="button" className="btn primary" onClick={onRewatch}>
                重看本段
              </button>
            ) : (
              <>
                <button type="button" className="btn primary" onClick={onRetry}>
                  再試一次
                </button>
                <button type="button" className="btn ghost" onClick={onRewatch}>
                  重看本段
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

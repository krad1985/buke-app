import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration, fmtTime, segmentSeconds } from '../lib/format';
import { loadYouTubeApi, type YTPlayer } from '../lib/youtube';
import type { AnswerRecord, Course, CourseProgress, Segment } from '../types';
import QuizPanel, { type QuizResult } from './QuizPanel';
import SegmentList from './SegmentList';

type Phase = 'intro' | 'playing' | 'quiz' | 'finished';

interface Props {
  course: Course;
  initialProgress: CourseProgress;
  onSaveProgress: (progress: CourseProgress) => void;
  onExit: () => void;
}

const YT_ERRORS: Record<number, string> = {
  2: '影片 ID 格式不正確。',
  5: '瀏覽器無法播放這支影片。',
  100: '影片不存在，或設為「私人」而無法嵌入。',
  101: '這支影片的擁有者不允許嵌入播放。',
  150: '這支影片的擁有者不允許嵌入播放。',
};

export default function LessonView({ course, initialProgress, onSaveProgress, onExit }: Props) {
  const segments = course.segments;
  const saved = initialProgress;

  const [phase, setPhase] = useState<Phase>(() =>
    segments.length > 0 && saved.passed.length >= segments.length ? 'finished' : 'intro'
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(saved.activeIndex, Math.max(segments.length, 1))
  );
  const [passed, setPassed] = useState<number[]>(saved.passed);
  const [watchedSec, setWatchedSec] = useState<number>(
    saved.watchedSec ?? segmentSeconds(segments, saved.passed)
  );
  const [attempts, setAttempts] = useState<Record<string, number>>(saved.attempts ?? {});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [quizKey, setQuizKey] = useState(0);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const resumeAtRef = useRef<number | null>(
    saved.lastPositionSec > 0 ? saved.lastPositionSec : null
  );
  const posRef = useRef(0);

  const activeSeg: Segment | undefined = segments[activeIndex];
  const reviewSeg: Segment | undefined = reviewIndex !== null ? segments[reviewIndex] : undefined;
  const guardSeg = reviewSeg ?? activeSeg;

  const effEnd = useCallback(
    (seg: Segment) => (duration > 0 ? Math.min(seg.endSec, duration) : seg.endSec),
    [duration]
  );

  /* ---------- 建立播放器（整支影片只載入一次，切段不重載） ---------- */
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    const el = document.createElement('div');
    el.className = 'player-host-inner';
    host.appendChild(el);

    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        playerRef.current = new YT.Player(el, {
          videoId: course.youtubeVideoId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              if (disposed) return;
              const d = e.target.getDuration();
              setDuration(Number.isFinite(d) ? d : 0);
              const from = resumeAtRef.current;
              const start = segments[saved.activeIndex]?.startSec ?? 0;
              const target =
                from !== null && from > start ? Math.min(from, (d || from) - 1) : start;
              e.target.seekTo(Math.max(target, 0), true);
              e.target.pauseVideo();
              setReady(true);
            },
            onStateChange: (e: { data: number }) => {
              setPlaying(e.data === 1);
              if (e.data === 0) {
                // 影片自然結束：若還在進行中的段落，直接進入檢核
                setPhase((p) => (p === 'playing' ? 'quiz' : p));
              }
            },
            onError: (e: { data: number }) => {
              setLoadError(YT_ERRORS[e.data] ?? '影片載入失敗，請確認影片是否允許嵌入。');
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) setLoadError('無法載入 YouTube 播放器，請檢查網路連線後重新整理。');
      });

    return () => {
      disposed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* 播放器可能尚未建立完成 */
      }
      playerRef.current = null;
    };
    // course.youtubeVideoId 換課時才重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.youtubeVideoId]);

  /* ---------- 進度儲存 ---------- */
  const persist = useCallback(() => {
    onSaveProgress({
      courseId: course.courseId,
      activeIndex,
      passed,
      attempts,
      lastPositionSec: posRef.current,
      watchedSec,
      updatedAt: Date.now(),
    });
  }, [course.courseId, activeIndex, passed, attempts, watchedSec, onSaveProgress]);

  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    const id = window.setInterval(persist, 10000);
    return () => window.clearInterval(id);
  }, [persist]);

  /* ---------- 段落守門：到終點就出題，越界就拉回 ---------- */
  useEffect(() => {
    if (phase !== 'playing' || !ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const t = p.getCurrentTime();
      if (typeof t !== 'number' || !Number.isFinite(t)) return;
      setCurrentTime(t);
      posRef.current = t;

      const seg = guardSeg;
      if (!seg) return;
      const end = effEnd(seg);

      if (t >= end - 0.3) {
        p.pauseVideo();
        if (reviewIndex !== null) {
          setReviewIndex(null);
          const back = segments[activeIndex];
          if (back) p.seekTo(back.startSec, true);
        } else {
          setQuizKey((k) => k + 1);
          setResult(null);
          setPhase('quiz');
        }
      } else if (t < seg.startSec - 0.8) {
        p.seekTo(seg.startSec, true);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, ready, guardSeg, effEnd, reviewIndex, activeIndex, segments]);

  /* ---------- 操作 ---------- */
  const seekTo = (sec: number) => {
    playerRef.current?.seekTo(sec, true);
    setCurrentTime(sec);
    posRef.current = sec;
  };

  const playSeg = (index: number) => {
    const seg = segments[index];
    if (!seg) return;
    seekTo(seg.startSec);
    playerRef.current?.playVideo();
    setPhase('playing');
  };

  const handleStart = () => {
    if (!activeSeg) {
      setPhase('finished');
      return;
    }
    if (resumeAtRef.current === null) seekTo(activeSeg.startSec);
    resumeAtRef.current = null;
    playerRef.current?.playVideo();
    setPhase('playing');
  };

  const handleTogglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };

  const handleCheck = (answers: Record<string, string[]>) => {
    if (!activeSeg) return;
    const records: AnswerRecord[] = activeSeg.questions.map((q) => {
      const sel = [...(answers[q.qid] ?? [])].sort();
      const cor = [...q.correctKeys].sort();
      const correct =
        sel.length === cor.length && sel.every((k, i) => k === cor[i]);
      return { qid: q.qid, selected: sel, correct };
    });
    const correctCount = records.filter((r) => r.correct).length;
    const need =
      activeSeg.passRule === 'minCorrect'
        ? activeSeg.minCorrectCount ?? activeSeg.questions.length
        : activeSeg.questions.length;
    const ok = correctCount >= need;

    setAttempts((prev) => ({
      ...prev,
      [String(activeSeg.segIndex)]: (prev[String(activeSeg.segIndex)] ?? 0) + 1,
    }));
    setResult({ passed: ok, records, correctCount, need });

    if (ok) {
      const nextPassed = passed.includes(activeSeg.segIndex)
        ? passed
        : [...passed, activeSeg.segIndex];
      setPassed(nextPassed);
      setWatchedSec(segmentSeconds(segments, nextPassed));
    }
  };

  const handleRewatch = () => {
    if (!activeSeg) return;
    setResult(null);
    setQuizKey((k) => k + 1);
    playSeg(activeSeg.segIndex);
  };

  const handleRetry = () => {
    setResult(null);
    setQuizKey((k) => k + 1);
  };

  const handleContinue = () => {
    const next = activeIndex + 1;
    setResult(null);
    setQuizKey((k) => k + 1);
    setActiveIndex(next);
    if (next >= segments.length) {
      setPhase('finished');
      setPlaying(false);
      playerRef.current?.pauseVideo();
      return;
    }
    const seg = segments[next];
    seekTo(seg.startSec);
    playerRef.current?.playVideo();
    setPhase('playing');
  };

  const handleReplay = (index: number) => {
    const seg = segments[index];
    if (!seg || activeIndex >= segments.length) return;
    setResult(null);
    setReviewIndex(index);
    seekTo(seg.startSec);
    playerRef.current?.playVideo();
    setPhase('playing');
  };

  const backToCurrent = () => {
    const seg = segments[activeIndex];
    setReviewIndex(null);
    playerRef.current?.pauseVideo();
    if (seg) seekTo(seg.startSec);
  };

  const handleReset = () => {
    if (!window.confirm('確定要清除本課程的觀看進度嗎？')) return;
    setPassed([]);
    setWatchedSec(0);
    setAttempts({});
    setActiveIndex(0);
    setResult(null);
    setReviewIndex(null);
    setPhase('intro');
    seekTo(segments[0]?.startSec ?? 0);
  };

  const segStart = guardSeg?.startSec ?? 0;
  const segEnd = guardSeg ? effEnd(guardSeg) : 0;
  const qaMode = useMemo(
    () => new URLSearchParams(window.location.search).has('qa'),
    []
  );
  const outOfRange =
    duration > 0 && activeSeg ? activeSeg.startSec >= duration : false;
  const totalDone = passed.length;

  return (
    <div className="lesson">
      <div className="lesson-head">
        <button className="btn ghost small" onClick={onExit}>
          ← 課程列表
        </button>
        <div className="lesson-title">
          <h1>{course.title}</h1>
          <p className="hint">
            已通過 {totalDone} / {segments.length} 段
            {watchedSec > 0 && <>・已補 {fmtDuration(watchedSec)}</>}
          </p>
        </div>
      </div>

      <div className="lesson-grid">
        <div className="lesson-main">
          <div className="player-wrap">
            <div className="player-host" ref={hostRef} />

            {!ready && !loadError && (
              <div className="player-overlay">
                <p>正在載入播放器…</p>
              </div>
            )}

            {loadError && (
              <div className="player-overlay error">
                <p>{loadError}</p>
              </div>
            )}

            {ready && phase === 'intro' && (
              <div className="player-overlay start">
                <p className="overlay-eyebrow">
                  {activeSeg ? `第 ${activeSeg.segIndex + 1} 段，共 ${segments.length} 段` : '準備開始'}
                </p>
                <h2>{activeSeg?.title ?? '課程'}</h2>
                <button className="btn primary big" onClick={handleStart}>
                  開始上課
                </button>
              </div>
            )}

            {ready && phase === 'finished' && (
              <div className="player-overlay start">
                <p className="overlay-eyebrow">全部段落已通過</p>
                <h2>本課程已完成</h2>
                <p className="hint">累計補課時數：{fmtDuration(watchedSec)}</p>
                <div className="row-center">
                  <button className="btn" onClick={onExit}>
                    回課程列表
                  </button>
                  <button className="btn ghost" onClick={handleReset}>
                    清除進度重來
                  </button>
                </div>
              </div>
            )}
          </div>

          {reviewIndex !== null && reviewSeg && (
            <div className="notice review">
              <span>重看第 {reviewSeg.segIndex + 1} 段</span>
              <button className="btn tiny" onClick={backToCurrent}>
                回到目前進度
              </button>
            </div>
          )}

          {outOfRange && (
            <p className="notice warn">
              段落起點（{fmtTime(activeSeg?.startSec ?? 0)}）超過影片長度（{fmtTime(duration)}）。
            </p>
          )}

          {phase !== 'finished' && (
            <div className="controls">
              <button
                className="btn icon"
                onClick={phase === 'intro' ? handleStart : handleTogglePlay}
                disabled={!ready || phase === 'quiz' || !!loadError}
                aria-label={phase === 'intro' ? '開始上課' : playing ? '暫停' : '播放'}
              >
                {phase === 'intro' ? '▶' : playing ? '❚❚' : '▶'}
              </button>

              <input
                className="seek"
                type="range"
                min={segStart}
                max={segEnd || 1}
                step={0.1}
                value={Math.min(Math.max(currentTime, segStart), segEnd || 1)}
                onChange={(e) => seekTo(Number(e.target.value))}
                disabled={!ready || phase !== 'playing'}
                aria-label="段落內進度"
              />

              <span className="time">
                {fmtTime(Math.max(currentTime - segStart, 0))} / {fmtTime(Math.max(segEnd - segStart, 0))}
              </span>

              <button
                className="btn tiny"
                onClick={() => guardSeg && playSeg(guardSeg.segIndex)}
                disabled={!ready || phase !== 'playing'}
              >
                重看本段
              </button>

              {qaMode && (
                <button
                  className="btn tiny ghost"
                  title="跳到目前段落終點，用來快速檢查題目設定"
                  onClick={() => {
                    if (!guardSeg) return;
                    seekTo(Math.max(effEnd(guardSeg) - 0.2, guardSeg.startSec));
                  }}
                  disabled={!ready || phase !== 'playing'}
                >
                  跳結尾
                </button>
              )}
            </div>
          )}

          {phase === 'quiz' && activeSeg && (
            <QuizPanel
              key={`${activeSeg.segIndex}-${quizKey}`}
              segment={activeSeg}
              attemptCount={attempts[String(activeSeg.segIndex)] ?? 0}
              result={result}
              isLast={activeIndex >= segments.length - 1}
              onCheck={handleCheck}
              onRetry={handleRetry}
              onContinue={handleContinue}
              onRewatch={handleRewatch}
            />
          )}
        </div>

        <SegmentList
          segments={segments}
          activeIndex={activeIndex}
          passed={passed}
          allowRewatch={course.allowRewatch && phase !== 'finished'}
          onReplay={handleReplay}
        />
      </div>
    </div>
  );
}

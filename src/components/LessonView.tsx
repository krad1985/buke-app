import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtDuration, fmtTime, segmentSeconds } from '../lib/format';
import { IconPause, IconPlay, IconUsers } from './Icons';
import { createPlayer, type PlayerHandle } from '../lib/player';
import { courseVideo } from '../lib/video';
import { listStudentsInRegion } from '../lib/roster';
import { loadCourseProgresses } from '../lib/progressRepo';
import type { AnswerRecord, Course, CourseProgress, Segment, Student } from '../types';
import QuizPanel, { type QuizResult } from './QuizPanel';
import SegmentList from './SegmentList';

type Phase = 'intro' | 'playing' | 'quiz' | 'finished';

interface Props {
  course: Course;
  initialProgress: CourseProgress;
  onSaveProgress: (progress: CourseProgress) => void;
  onExit: () => void;
  student?: Student | null;
}

export default function LessonView({ course, initialProgress, onSaveProgress, onExit, student }: Props) {
  const segments = course.segments;
  const saved = initialProgress;
  const video = useMemo(() => courseVideo(course), [course]);

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
  const [isFull, setIsFull] = useState(false);
  const [pseudoFull, setPseudoFull] = useState(false);
  const [rate, setRate] = useState(1);
  const [peersOpen, setPeersOpen] = useState(false);
  const [peerCount, setPeerCount] = useState<number | null>(null);
  const [textSize, setTextSize] = useState<'s' | 'm' | 'l'>(() => {
    const v = localStorage.getItem('buke.textSize');
    return v === 's' || v === 'l' ? v : 'm';
  });
  const free = course.freeNavigation === true;
  const [peers, setPeers] = useState<{ name: string; me: boolean; passed: number; total: number }[] | null>(
    null
  );

  const hostRef = useRef<HTMLDivElement>(null);
  const peersPanelRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rateRef = useRef(1);
  const playerRef = useRef<PlayerHandle | null>(null);
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

    const from = resumeAtRef.current;
    const start = segments[saved.activeIndex]?.startSec ?? 0;

    void createPlayer({
      container: el,
      video: video,
      startAt: Math.max(start, 0),
      rate: rateRef.current,
      onReady: (d) => {
        if (disposed) return;
        setDuration(d);
        // 續看：若上次位置在目前段落之內就從那裡開始
        if (from !== null && from > start) {
          const target = Math.min(from, (d || from) - 1);
          playerRef.current?.seek(Math.max(target, 0));
        }
        setReady(true);
      },
      onStateChange: () => {
        const t = playerRef.current?.getCurrentTime() ?? 0;
        setCurrentTime(t);
        setPlaying(true);
      },
      onError: (message) => setLoadError(message),
    })
      .then((handle) => {
        if (disposed) {
          handle.destroy();
          return;
        }
        playerRef.current = handle;
      })
      .catch(() => {
        if (!disposed) setLoadError('無法載入播放器，請檢查網路連線後重新整理。');
      });

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // 換來源或換影片才重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.provider, video.id, video.hash]);

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

      if (free) {
        // 自由選看：不擋、不跳段，看到段落結尾就記為已看過
        const end = effEnd(seg);
        if (t >= end - 0.3 && !passed.includes(seg.segIndex)) {
          setPassed((prev) => (prev.includes(seg.segIndex) ? prev : [...prev, seg.segIndex]));
        }
        return;
      }

      const end = effEnd(seg);

      if (t >= end - 0.3) {
        p.pause();
        if (reviewIndex !== null) {
          setReviewIndex(null);
          const back = segments[activeIndex];
          if (back) p.seek(back.startSec);
        } else {
          if (document.fullscreenElement) void document.exitFullscreen?.();
          setQuizKey((k) => k + 1);
          setResult(null);
          setPhase('quiz');
        }
      } else if (t < seg.startSec - 0.8) {
        p.seek(seg.startSec);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, ready, guardSeg, effEnd, reviewIndex, activeIndex, segments, free, passed]);

  useEffect(() => {
    if (!free) return;
    setWatchedSec(segmentSeconds(segments, passed));
  }, [free, passed, segments]);

  /* ---------- 操作 ---------- */
  const seekTo = (sec: number) => {
    playerRef.current?.seek(sec);
    setCurrentTime(sec);
    posRef.current = sec;
  };

  const changeRate = (r: number) => {
    setRate(r);
    rateRef.current = r;
    playerRef.current?.setRate(r);
  };

  const toggleFullscreen = () => {
    if (pseudoFull) {
      setPseudoFull(false);
      return;
    }
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    // iOS Safari 不支援元素全螢幕，退回自訂全螢幕
    if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen()
        .then(() => setIsFull(true))
        .catch(() => setPseudoFull(true));
    } else {
      setPseudoFull(true);
    }
  };

  useEffect(() => {
    if (!student) {
      setPeerCount(null);
      return;
    }
    let alive = true;
    listStudentsInRegion(student.region)
      .then((list) => {
        if (!alive) return;
        const same = list.filter(
          (s) =>
            s.groupLarge === student.groupLarge &&
            s.groupSmall === student.groupSmall &&
            (s.groupLarge !== '' || s.groupSmall !== '')
        );
        setPeerCount(Math.max(same.length - 1, 0));
      })
      .catch(() => {
        if (alive) setPeerCount(0);
      });
    return () => {
      alive = false;
    };
  }, [student]);

  const openPeers = async () => {
    if (!student) return;
    setPeersOpen(true);
    setPeers(null);
    peersPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const list = await listStudentsInRegion(student.region);
      const same = list.filter(
        (s) =>
          s.groupLarge === student.groupLarge &&
          s.groupSmall === student.groupSmall &&
          (s.groupLarge !== '' || s.groupSmall !== '')
      );
      const progress = await loadCourseProgresses(
        student.region,
        same.map((s) => s.studentId),
        course.courseId
      );
      setPeers(
        same
          .map((s) => ({
            name: s.name,
            me: s.studentId === student.studentId,
            passed: progress[s.studentId]?.passed.length ?? 0,
            total: segments.length,
          }))
          .sort((a, b) => b.passed - a.passed || a.name.localeCompare(b.name))
      );
    } catch {
      setPeers([]);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pseudoFull) setPseudoFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudoFull]);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const playSeg = (index: number) => {    const seg = segments[index];
    if (!seg) return;
    seekTo(seg.startSec);
    playerRef.current?.play();
    setPhase('playing');
  };

  const handleStart = () => {
    if (!activeSeg) {
      setPhase('finished');
      return;
    }
    if (resumeAtRef.current === null) seekTo(activeSeg.startSec);
    resumeAtRef.current = null;
    playerRef.current?.play();
    setPhase('playing');
  };

  const handleTogglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pause();
    else p.play();
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
      playerRef.current?.pause();
      return;
    }
    const seg = segments[next];
    seekTo(seg.startSec);
    playerRef.current?.play();
    setPhase('playing');
  };

  const handleReplay = (index: number) => {
    const seg = segments[index];
    if (!seg || activeIndex >= segments.length) return;
    setResult(null);
    if (free) {
      setActiveIndex(index);
      seekTo(seg.startSec);
      playerRef.current?.play();
      setPhase('playing');
      return;
    }
    setReviewIndex(index);
    seekTo(seg.startSec);
    playerRef.current?.play();
    setPhase('playing');
  };

  const backToCurrent = () => {
    const seg = segments[activeIndex];
    setReviewIndex(null);
    playerRef.current?.pause();
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
    <div className="lesson" data-textsize={textSize}>
      <div className="lesson-head">
        <button className="btn ghost small" onClick={onExit}>
          ← 課程列表
        </button>
        <div className="lesson-title">
          <h1>{course.title}</h1>
          <p className="hint">
            已通過 {totalDone} / {segments.length} 段
            {watchedSec > 0 && <>・已學習 {fmtDuration(watchedSec)}</>}
          </p>
        </div>
        {student && (
          <button
            className="btn small peer-btn"
            onClick={openPeers}
            disabled={peerCount === 0}
            title={peerCount === 0 ? '同組目前沒有其他學員' : undefined}
          >
            <IconUsers />
            {peersOpen
              ? '收起同組進度'
              : peerCount === null
                ? '同組進度'
                : peerCount === 0
                  ? '同組無其他學員'
                  : `同組進度（${peerCount + 1} 人）`}
          </button>
        )}
        <div className="textsize" role="group" aria-label="文字大小">
          {(['s', 'm', 'l'] as const).map((v) => (
            <button
              key={v}
              className={`ts-btn ${textSize === v ? 'active' : ''}`}
              onClick={() => {
                setTextSize(v);
                localStorage.setItem('buke.textSize', v);
              }}
            >
              {v === 's' ? '小' : v === 'm' ? '中' : '大'}
            </button>
          ))}
        </div>
      </div>

      <div className="lesson-grid">
        <div className="lesson-main">
          <div className={`player-box ${pseudoFull ? 'is-fullscreen' : ''}`} ref={boxRef}>
            <div className="player-wrap">
              <div className="player-host" ref={hostRef} />
              {video.provider === 'youtube' && (
                <div
                  className="player-shield"
                  onClick={phase === 'intro' ? handleStart : handleTogglePlay}
                  role="presentation"
                />
              )}

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
                <p className="hint">累計學習時數：{fmtDuration(watchedSec)}</p>
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

            {phase !== 'finished' && (
              <div className="controls">
                <button
                  className="btn icon"
                  onClick={phase === 'intro' ? handleStart : handleTogglePlay}
                  disabled={!ready || phase === 'quiz' || !!loadError}
                  aria-label={phase === 'intro' ? '開始上課' : playing ? '暫停' : '播放'}
                >
                  {phase === 'intro' || !playing ? <IconPlay /> : <IconPause />}
                </button>

                <input
                  className="seek"
                  type="range"
                  min={free ? 0 : segStart}
                  max={free ? duration || 1 : segEnd || 1}
                  step={0.1}
                  value={
                    free
                      ? Math.min(currentTime, duration || 1)
                      : Math.min(Math.max(currentTime, segStart), segEnd || 1)
                  }
                  onChange={(e) => seekTo(Number(e.target.value))}
                  disabled={!ready || phase !== 'playing'}
                  aria-label="播放進度"
                />

                <span className="time">
                  {free
                    ? `${fmtTime(currentTime)} / ${fmtTime(duration)}`
                    : `${fmtTime(Math.max(currentTime - segStart, 0))} / ${fmtTime(Math.max(segEnd - segStart, 0))}`}
                </span>

                <select
                  className="speed"
                  value={rate}
                  onChange={(e) => changeRate(Number(e.target.value))}
                  disabled={!ready}
                  aria-label="播放速度"
                >
                  {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <option key={r} value={r}>
                      {r}x
                    </option>
                  ))}
                </select>

                <button
                  className="btn tiny"
                  onClick={toggleFullscreen}
                  disabled={!ready}
                  aria-label="全螢幕"
                >
                  {isFull ? '縮小' : '全螢幕'}
                </button>

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
                    title="跳到目前段落終點"
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
          </div>

          {peersOpen && student && (
            <div className="panel peers-panel" ref={peersPanelRef}>
              <div className="section-head">
                <h3>同組進度</h3>
                <div className="row-gap">
                  <span className="hint">
                    大組 {student.groupLarge || '—'}・小組 {student.groupSmall || '—'}
                  </span>
                  <button className="btn tiny" onClick={() => setPeersOpen(false)}>
                    關閉
                  </button>
                </div>
              </div>
              {!peers ? (
                <p className="hint">讀取中…</p>
              ) : peers.length === 0 ? (
                <p className="hint">同組沒有其他學員。</p>
              ) : (
                <ul className="peers-list">
                  {peers.map((p) => (
                    <li key={p.name + p.passed} className={p.me ? 'me' : ''}>
                      <span className="peers-name">
                        {p.name}
                        {p.me ? '（我）' : ''}
                      </span>
                      <span className="peers-bar">
                        <span
                          className="peers-fill"
                          style={{ width: `${p.total ? (p.passed / p.total) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="mono">
                        {p.passed}/{p.total}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
          freeMode={free}
          onReplay={handleReplay}
        />
      </div>
    </div>
  );
}

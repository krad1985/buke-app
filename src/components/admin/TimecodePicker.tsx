import { useEffect, useRef, useState } from 'react';
import { createPlayer, type PlayerHandle } from '../../lib/player';
import { fmtTime } from '../../lib/format';
import type { VideoRef } from '../../lib/video';

interface Props {
  video: VideoRef;
  onTick: (sec: number, duration: number) => void;
}

/** 後台抓時間碼用的小播放器：邊看邊把目前秒數帶到段落欄位 */
export default function TimecodePicker({ video, onTick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !video.id) return;
    let disposed = false;
    setReady(false);
    setError(null);
    setNow(0);

    const el = document.createElement('div');
    el.className = 'player-host-inner';
    host.appendChild(el);

    void createPlayer({
      container: el,
      video,
      startAt: 0,
      rate: 1,
      onReady: (d) => {
        if (disposed) return;
        setReady(true);
        onTick(0, d);
      },
      onStateChange: () => setPlaying(true),
      onError: (message) => setError(message),
    })
      .then((handle) => {
        if (disposed) {
          handle.destroy();
          return;
        }
        playerRef.current = handle;
      })
      .catch(() => setError('無法載入播放器。'));

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.provider, video.id, video.hash]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const t = p.getCurrentTime();
      if (Number.isFinite(t)) {
        setNow(t);
        onTick(t, p.getDuration());
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [ready, onTick]);

  return (
    <div className="admin-picker">
      <div className="admin-picker-video">
        <div ref={hostRef} className="player-host" />
        {!video.id && <p className="hint pad">填入影片 ID 後顯示播放器。</p>}
        {video.id && !ready && !error && <p className="hint pad">播放器載入中…</p>}
        {error && <p className="hint pad warn-text">{error}</p>}
      </div>
      <div className="admin-picker-side">
        <p className="picker-time">{fmtTime(now)}</p>
        <div className="row-gap">
          <button
            type="button"
            className="btn small"
            disabled={!ready}
            onClick={() => {
              const p = playerRef.current;
              if (!p) return;
              if (playing) {
                p.pause();
                setPlaying(false);
              } else {
                p.play();
                setPlaying(true);
              }
            }}
          >
            {playing ? '暫停' : '播放'}
          </button>
          <span className="hint">{video.provider === 'vimeo' ? 'Vimeo' : 'YouTube'}</span>
        </div>
        <p className="hint">播到位置後，按段落的「用目前時間」。</p>
      </div>
    </div>
  );
}

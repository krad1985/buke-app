import { useEffect, useRef, useState } from 'react';
import { loadYouTubeApi, type YTPlayer } from '../../lib/youtube';
import { fmtTime } from '../../lib/format';

interface Props {
  videoId: string;
  onTick: (sec: number, duration: number) => void;
}

/** 後台抓時間碼用的小播放器：邊看邊把目前秒數帶到段落欄位 */
export default function TimecodePicker({ videoId, onTick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !videoId) return;
    let disposed = false;
    setReady(false);
    setError(null);
    setNow(0);

    const el = document.createElement('div');
    el.className = 'player-host-inner';
    host.appendChild(el);

    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        playerRef.current = new YT.Player(el, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, origin: window.location.origin },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              if (disposed) return;
              setReady(true);
              onTick(0, e.target.getDuration() || 0);
            },
            onError: () => setError('影片無法載入，請確認 ID 正確且允許嵌入。'),
          },
        });
      })
      .catch(() => setError('無法載入 YouTube 播放器。'));

    return () => {
      disposed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* 尚未建立完成 */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const t = p.getCurrentTime();
      if (typeof t === 'number' && Number.isFinite(t)) {
        setNow(t);
        onTick(t, p.getDuration() || 0);
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [ready, onTick]);

  return (
    <div className="admin-picker">
      <div className="admin-picker-video">
        <div ref={hostRef} className="player-host" />
        {!videoId && <p className="hint pad">填入影片 ID 後顯示播放器。</p>}
        {videoId && !ready && !error && <p className="hint pad">播放器載入中…</p>}
        {error && <p className="hint pad warn-text">{error}</p>}
      </div>
      <div className="admin-picker-side">
        <p className="picker-time">{fmtTime(now)}</p>
        <div className="row-gap">
          <button
            type="button"
            className="btn small"
            disabled={!ready}
            onClick={() => (playerRef.current?.getPlayerState() === 1 ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())}
          >
            播放 / 暫停
          </button>
        </div>
        <p className="hint">播到位置後，按段落的「用目前時間」。</p>
      </div>
    </div>
  );
}

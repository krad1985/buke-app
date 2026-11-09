import { loadYouTubeApi, type YTPlayer } from './youtube';
import type { VideoRef } from './video';

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(sec: number): void;
  /** 同步取值（Vimeo 是 Promise，這裡以事件快取） */
  getCurrentTime(): number;
  getDuration(): number;
  setRate(rate: number): void;
  destroy(): void;
}

interface Options {
  container: HTMLElement;
  video: VideoRef;
  startAt: number;
  rate: number;
  onReady: (duration: number) => void;
  onStateChange: () => void;
  onError: (message: string) => void;
}

declare global {
  interface Window {
    Vimeo?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
    };
  }
}

let vimeoPromise: Promise<NonNullable<Window['Vimeo']>> | null = null;

function loadVimeoApi(): Promise<NonNullable<Window['Vimeo']>> {
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (vimeoPromise) return vimeoPromise;

  vimeoPromise = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Vimeo 播放器載入逾時')), 12000);
    const tag = document.createElement('script');
    tag.src = 'https://player.vimeo.com/api/player.js';
    tag.async = true;
    tag.onload = () => {
      window.clearTimeout(timer);
      if (window.Vimeo?.Player) resolve(window.Vimeo);
      else reject(new Error('Vimeo 播放器載入失敗'));
    };
    tag.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('無法連線 Vimeo'));
    };
    document.head.appendChild(tag);
  });
  return vimeoPromise;
}

const YT_ERRORS: Record<number, string> = {
  2: '影片 ID 格式不正確。',
  5: '瀏覽器無法播放這支影片。',
  100: '影片不存在，或設為「私人」而無法嵌入。',
  101: '這支影片的擁有者不允許嵌入播放。',
  150: '這支影片的擁有者不允許嵌入播放。',
};

export async function createPlayer(opts: Options): Promise<PlayerHandle> {
  if (opts.video.provider === 'vimeo') return createVimeoPlayer(opts);
  return createYouTubePlayer(opts);
}

async function createYouTubePlayer(opts: Options): Promise<PlayerHandle> {
  const YT = await loadYouTubeApi();
  let player: YTPlayer | null = null;

  player = new YT.Player(opts.container, {
    videoId: opts.video.id,
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
        const d = e.target.getDuration();
        e.target.seekTo(opts.startAt, true);
        e.target.setPlaybackRate(opts.rate);
        e.target.pauseVideo();
        opts.onReady(Number.isFinite(d) ? d : 0);
      },
      onStateChange: () => opts.onStateChange(),
      onError: (e: { data: number }) => opts.onError(YT_ERRORS[e.data] ?? '影片載入失敗。'),
    },
  });

  return {
    play: () => player?.playVideo(),
    pause: () => player?.pauseVideo(),
    seek: (sec) => player?.seekTo(sec, true),
    getCurrentTime: () => {
      const t = player?.getCurrentTime();
      return typeof t === 'number' && Number.isFinite(t) ? t : 0;
    },
    getDuration: () => {
      const d = player?.getDuration();
      return typeof d === 'number' && Number.isFinite(d) ? d : 0;
    },
    setRate: (r) => player?.setPlaybackRate(r),
    destroy: () => {
      try {
        player?.destroy();
      } catch {
        /* 尚未建立完成 */
      }
      player = null;
    },
  };
}

async function createVimeoPlayer(opts: Options): Promise<PlayerHandle> {
  const Vimeo = await loadVimeoApi();

  type VimeoPlayer = {
    ready: () => Promise<void>;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    setCurrentTime: (s: number) => Promise<number>;
    getCurrentTime: () => Promise<number>;
    getDuration: () => Promise<number>;
    setPlaybackRate: (r: number) => Promise<number>;
    destroy: () => Promise<void>;
    on: (event: string, cb: () => void) => void;
  };

  const player = new Vimeo.Player(opts.container, {
    id: Number(opts.video.id),
    ...(opts.video.hash ? { h: opts.video.hash } : {}),
    controls: false,
    title: false,
    byline: false,
    portrait: false,
    badge: false,
    dnt: true,
    transparent: false,
    autopause: false,
    playsinline: true,
    responsive: false,
    keyboard: false,
    pip: false,
    fullscreen: false,
  }) as VimeoPlayer;

  let cachedTime = 0;
  let cachedDuration = 0;
  let disposed = false;

  const tick = () => {
    void player
      .getCurrentTime()
      .then((t) => {
        if (!disposed && Number.isFinite(t)) cachedTime = t;
      })
      .catch(() => undefined);
  };

  const timer = window.setInterval(tick, 250);

  player.on('timeupdate', () => tick());
  player.on('play', () => opts.onStateChange());
  player.on('pause', () => opts.onStateChange());
  player.on('ended', () => opts.onStateChange());
  player.on('error', () =>
    opts.onError(
      'Vimeo 無法播放：影片可能設為「僅限特定網域嵌入」。請管理者把隱私改成「任何知道連結的人」，或把本網域加入允許清單。'
    )
  );

  try {
    await player.ready();
    cachedDuration = await player.getDuration().catch(() => 0);
    // 這些在影片 metadata 尚未就緒時可能不會 resolve，不要 await
    void player.setCurrentTime(opts.startAt).catch(() => undefined);
    void player.setPlaybackRate(opts.rate).catch(() => undefined);
    void player.pause().catch(() => undefined);
    opts.onReady(Number.isFinite(cachedDuration) ? cachedDuration : 0);
  } catch {
    opts.onError(
      'Vimeo 無法播放：影片可能設為「僅限特定網域嵌入」。請管理者把隱私改成「任何知道連結的人」，或把本網域加入允許清單。'
    );
  }

  return {
    play: () => void player.play().catch(() => undefined),
    pause: () => void player.pause().catch(() => undefined),
    seek: (sec) => {
      cachedTime = sec;
      void player.setCurrentTime(sec).catch(() => undefined);
    },
    getCurrentTime: () => cachedTime,
    getDuration: () => cachedDuration,
    setRate: (r) => void player.setPlaybackRate(r).catch(() => undefined),
    destroy: () => {
      disposed = true;
      window.clearInterval(timer);
      void player.destroy().catch(() => undefined);
    },
  };
}

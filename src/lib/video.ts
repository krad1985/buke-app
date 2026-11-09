import type { Course, VideoProvider } from '../types';

export interface VideoRef {
  provider: VideoProvider;
  id: string;
  hash?: string;
}

/** 統一取出課程的影片來源（相容舊資料的 youtubeVideoId） */
export function courseVideo(course: Course): VideoRef {
  if (course.videoProvider === 'vimeo') {
    return { provider: 'vimeo', id: (course.videoId ?? '').trim(), hash: (course.videoHash ?? '').trim() };
  }
  return {
    provider: 'youtube',
    id: (course.videoId || course.youtubeVideoId || '').trim(),
  };
}

/** 從貼上的網址擷取 ID（與 hash），方便後台貼連結就好 */
export function parseVideoUrl(input: string): VideoRef | null {
  const text = input.trim();
  if (!text) return null;

  // Vimeo：vimeo.com/1222868790/7a467b68ce 或 player.vimeo.com/video/1222868790?h=...
  const vimeo = text.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/);
  if (vimeo) {
    const hashFromQuery = text.match(/[?&]h=([0-9a-zA-Z]+)/);
    return { provider: 'vimeo', id: vimeo[1], hash: vimeo[2] ?? hashFromQuery?.[1] ?? '' };
  }

  // YouTube：youtu.be/ID、watch?v=ID、embed/ID
  const yt =
    text.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    text.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    text.match(/embed\/([A-Za-z0-9_-]{6,})/);
  if (yt) return { provider: 'youtube', id: yt[1] };

  // 只貼 ID
  if (/^\d{6,}$/.test(text)) return { provider: 'vimeo', id: text };
  if (/^[A-Za-z0-9_-]{6,20}$/.test(text)) return { provider: 'youtube', id: text };

  return null;
}

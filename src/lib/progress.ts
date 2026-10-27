import type { CourseProgress } from '../types';

const KEY = 'buke.progress.v1';

type Store = Record<string, CourseProgress>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function emptyProgress(courseId: string): CourseProgress {
  return {
    courseId,
    activeIndex: 0,
    passed: [],
    attempts: {},
    lastPositionSec: 0,
    updatedAt: Date.now(),
  };
}

export function loadAllLocal(): Store {
  return readStore();
}

/** 本機快取，雲端同步失敗時仍可續看 */
export function saveLocal(progress: CourseProgress) {
  const store = readStore();
  store[progress.courseId] = progress;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* 無痕模式或配額滿時靜默失敗 */
  }
}

export function loadProgressLocal(courseId: string): CourseProgress {
  return readStore()[courseId] ?? emptyProgress(courseId);
}

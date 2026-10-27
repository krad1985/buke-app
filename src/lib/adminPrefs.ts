const KEY = 'buke.adminRegion';

/** 記住課程管理員上次選的區域，切換頁籤不用重打 */
export function getPrefRegion(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setPrefRegion(region: string): void {
  try {
    if (region) localStorage.setItem(KEY, region);
    else localStorage.removeItem(KEY);
  } catch {
    /* 無痕模式 */
  }
}

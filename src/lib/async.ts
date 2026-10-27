/** 為 Firestore 請求加上逾時，避免規則未部署或離線時畫面一直卡在「載入中」 */
export function withTimeout<T>(promise: Promise<T>, ms = 15000, message = '連線逾時'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      }
    );
  });
}

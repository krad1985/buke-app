/** 固定區域清單：名稱就是 Firestore 路徑的一部分，不接受自由輸入，避免同區多種寫法 */
export const REGIONS = ['北區', '桃區', '竹區', '中區', '園區', '嘉區', '南區', '高區', '國際'] as const;

export type RegionName = (typeof REGIONS)[number];

export function isRegionName(value: string): value is RegionName {
  return (REGIONS as readonly string[]).includes(value);
}

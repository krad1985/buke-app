export type QuestionType = 'single' | 'multiple' | 'trueFalse';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface Question {
  qid: string;
  prompt: string;
  type: QuestionType;
  options: QuestionOption[];
  /** 正解選項的 key；防君子模式下與題目存在同一份文件 */
  correctKeys: string[];
  explanation?: string;
}

export type PassRule = 'allCorrect' | 'minCorrect';
export type OnFailAction = 'retryQuiz' | 'rewatch';

export interface Segment {
  segIndex: number;
  title: string;
  /** 段落起點（秒）。手動指定，因為要依內容切段 */
  startSec: number;
  /** 段落終點（秒），播放到此為止並跳出題目 */
  endSec: number;
  passRule: PassRule;
  minCorrectCount?: number;
  /** 可作答次數上限，0 = 不限 */
  maxAttempts: number;
  onFailAction: OnFailAction;
  showAnswerAfterFail: boolean;
  questions: Question[];
}

export interface Course {
  courseId: string;
  title: string;
  description: string;
  teacher?: string;
  /** YouTube 影片 ID（公開或不公開）；私人影片無法嵌入 */
  youtubeVideoId: string;
  isPublished: boolean;
  sortOrder: number;
  /** 是否允許重看已通過的段落 */
  allowRewatch: boolean;
  /** 示範資料標記，串接 Firebase 後可移除 */
  isMock?: boolean;
  segments: Segment[];
}

export interface AnswerRecord {
  qid: string;
  selected: string[];
  correct: boolean;
}

/** 學員名單（以手機號碼為識別，doc ID = 正規化後的號碼） */
export interface Student {
  studentId: string;
  name: string;
  phone: string;
  phoneKey: string;
  region: string;
  classroom: string;
  group: string;
  role: string;
  updatedAt: number;
}

export type AdminRole = 'course' | 'region';

/** 管理員（doc ID = Firebase Auth uid） */
export interface AdminProfile {
  uid: string;
  account: string;
  name: string;
  role: AdminRole;
  region: string;
  enabled: boolean;
  authEmail: string;
}

export interface CourseProgress {
  courseId: string;
  /** 目前進行中的段落下標（0-based）；等於 segments.length 表示全部完成 */
  activeIndex: number;
  /** 已通過的段落下標 */
  passed: number[];
  /** 各段落累計作答次數 */
  attempts: Record<string, number>;
  lastPositionSec: number;
  updatedAt: number;
  /** 累計已補課時數（秒）：通過的段落長度加總 */
  watchedSec?: number;
  /** 預留：之後匯入名單時用來把匿名進度認領成具名紀錄 */
  bindCode?: string;
}

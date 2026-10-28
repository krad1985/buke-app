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
  segments: Segment[];
}

export interface AnswerRecord {
  qid: string;
  selected: string[];
  correct: boolean;
}

/** 學員名單（doc ID = 學員代碼） */
export interface Student {
  /** 學員代碼，例如 TW00103698；同時是資料庫文件 ID */
  studentId: string;
  name: string;
  /** 手機（選填），可作為登入依據 */
  phone?: string;
  /** 母班行政組織 */
  classroom: string;
  /** 大組-小組 */
  group: string;
  /** 身份別：學員／輔導員… */
  role: string;
  region: string;
  updatedAt: number;
}

export type AdminRole = 'course' | 'region';

/** 管理員（doc ID = 帳號） */
export interface AdminProfile {
  account: string;
  name: string;
  role: AdminRole;
  region: string;
  enabled: boolean;
  /** 明文密碼：防君子模式，前端比對用 */
  pass: string;
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
}

import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * 稽核紀錄：只寫不改、不刪（規則禁止 update/delete）。
 * 後台不顯示；需要追查時到 Firebase Console → auditLogs 查詢或匯出。
 */
export type AuditAction =
  | 'admin.login'
  | 'admin.create'
  | 'admin.approve'
  | 'admin.reject'
  | 'admin.enable'
  | 'admin.disable'
  | 'admin.remove'
  | 'admin.reset_password'
  | 'admin.password_change'
  | 'admin.grant_add'
  | 'admin.grant_remove'
  | 'roster.import'
  | 'roster.export'
  | 'records.export'
  | 'course.save'
  | 'course.delete'
  | 'course.import'
  | 'series.save'
  | 'series.delete'
  | 'settings.update';

export interface AuditEvent {
  action: AuditAction;
  /** 對象：email、課程 ID、區域… */
  target?: string;
  detail?: Record<string, unknown>;
}

/** fire-and-forget，寫入失敗不影響主要操作 */
export function logEvent(event: AuditEvent): void {
  const user = auth.currentUser;
  if (!user) return;
  void addDoc(collection(db, 'auditLogs'), {
    at: Date.now(),
    iso: new Date().toISOString(),
    actorUid: user.uid,
    actorEmail: user.email ?? '',
    action: event.action,
    target: event.target ?? '',
    detail: event.detail ?? {},
  }).catch(() => undefined);
}

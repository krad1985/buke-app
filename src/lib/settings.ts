import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AppSettings } from '../types';

const ref = () => doc(db, 'config', 'settings');

export const DEFAULT_SETTINGS: AppSettings = { allowGuestView: true };

export async function loadSettings(): Promise<AppSettings> {
  const snap = await getDoc(ref());
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data() as Partial<AppSettings>;
  return { allowGuestView: data.allowGuestView !== false };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setDoc(ref(), { ...settings, updatedAt: Date.now() }, { merge: true });
}

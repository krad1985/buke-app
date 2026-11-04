import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Series } from '../types';

const ref = (id: string) => doc(db, 'series', id);

export async function listSeries(): Promise<Series[]> {
  const snap = await getDocs(collection(db, 'series'));
  return snap.docs
    .map((d) => ({ ...(d.data() as Series), seriesId: d.id }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export async function getSeries(id: string): Promise<Series | null> {
  const snap = await getDoc(ref(id));
  return snap.exists() ? { ...(snap.data() as Series), seriesId: snap.id } : null;
}

export async function saveSeries(series: Series): Promise<void> {
  await setDoc(ref(series.seriesId), {
    name: series.name.trim(),
    sortOrder: Number.isFinite(series.sortOrder) ? series.sortOrder : 0,
  });
}

export async function deleteSeries(id: string): Promise<void> {
  await deleteDoc(ref(id));
}

export function newSeriesId(): string {
  return doc(collection(db, 'series')).id;
}

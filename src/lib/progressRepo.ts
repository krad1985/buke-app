import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { saveLocal } from './progress';
import type { Course, CourseProgress, Student } from '../types';

/**
 * 進度路徑：regions/{區域}/students/{學員代碼}/progress/{courseId}
 * 以學員代碼為識別，換裝置也還在。（防君子）
 */
const progressCol = (region: string, studentId: string) =>
  collection(db, 'regions', region, 'students', studentId, 'progress');

export async function loadAllProgress(
  region: string,
  studentId: string
): Promise<Record<string, CourseProgress>> {
  const snap = await getDocs(progressCol(region, studentId));
  const out: Record<string, CourseProgress> = {};
  snap.docs.forEach((d) => {
    out[d.id] = { ...(d.data() as CourseProgress), courseId: d.id };
  });
  Object.values(out).forEach(saveLocal);
  return out;
}

export async function saveProgressFor(
  region: string,
  studentId: string,
  progress: CourseProgress
): Promise<void> {
  saveLocal(progress);
  await setDoc(doc(progressCol(region, studentId), progress.courseId), progress);
}

export interface StudentRecord {
  student: Student;
  progress: Record<string, CourseProgress>;
}

/** 匯出報表用：逐一讀取該區學員的進度（不開放 collection-group 查詢，避免整庫被撈） */
export async function loadRegionRecords(region: string, students: Student[]): Promise<StudentRecord[]> {
  const out: StudentRecord[] = [];
  const chunk = 8;
  for (let i = 0; i < students.length; i += chunk) {
    const slice = students.slice(i, i + chunk);
    const results = await Promise.all(
      slice.map(async (student) => {
        try {
          const snap = await getDocs(progressCol(region, student.studentId));
          const progress: Record<string, CourseProgress> = {};
          snap.docs.forEach((d) => {
            progress[d.id] = { ...(d.data() as CourseProgress), courseId: d.id };
          });
          return { student, progress };
        } catch {
          return { student, progress: {} };
        }
      })
    );
    out.push(...results);
  }
  return out;
}

export function completedCourses(progress: Record<string, CourseProgress>, courses: Course[]): string[] {
  return courses
    .filter((c) => {
      const p = progress[c.courseId];
      return p && c.segments.length > 0 && p.passed.length >= c.segments.length;
    })
    .map((c) => c.title);
}

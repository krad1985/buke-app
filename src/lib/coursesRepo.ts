import { deleteDoc, doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Course, Segment } from '../types';

export function normalizeSegments(segments: Segment[]): Segment[] {
  return segments.map((seg, i) => ({ ...seg, segIndex: i }));
}

function normalizeCourse(course: Course): Course {
  return {
    ...course,
    sortOrder: Number.isFinite(course.sortOrder) ? course.sortOrder : 0,
    allowRewatch: course.allowRewatch !== false,
    segments: normalizeSegments(course.segments),
  };
}

export async function listAllCourses(): Promise<Course[]> {
  const snap = await getDocs(collection(db, 'courses'));
  return snap.docs
    .map((d) => {
      const data = d.data() as Partial<Course>;
      return {
        ...data,
        courseId: d.id,
        title: data.title ?? '（未命名課程）',
        description: data.description ?? '',
        youtubeVideoId: data.youtubeVideoId ?? '',
        isPublished: data.isPublished === true,
        allowRewatch: data.allowRewatch !== false,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
        segments: normalizeSegments(Array.isArray(data.segments) ? data.segments : []),
      } as Course;
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title));
}

export async function saveCourse(course: Course): Promise<void> {
  // JSON 來回一趟可移除 undefined（Firestore 不接受 undefined 欄位）
  const payload = normalizeCourse(JSON.parse(JSON.stringify(course)) as Course);
  await setDoc(doc(db, 'courses', course.courseId), {
    ...payload,
    updatedAt: Date.now(),
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(db, 'courses', courseId));
}

export function newCourseId(): string {
  return doc(collection(db, 'courses')).id;
}

export function emptyCourse(courseId: string): Course {
  return {
    courseId,
    title: '未命名課程',
    description: '',
    teacher: '',
    youtubeVideoId: '',
    isPublished: false,
    sortOrder: 1,
    allowRewatch: true,
    segments: [],
  };
}

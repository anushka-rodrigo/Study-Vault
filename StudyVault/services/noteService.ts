import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import { db, storage } from '../config/firebase';
import { ref, deleteObject } from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';

// Resolves a stored fileUrl/filePath into a valid absolute file URI.
export const resolveFileUri = (fileUrlOrPath?: string): string => {
  if (!fileUrlOrPath) return '';
  if (fileUrlOrPath.startsWith('http://') || fileUrlOrPath.startsWith('https://')) {
    return fileUrlOrPath;
  }

  const filename = fileUrlOrPath.substring(fileUrlOrPath.lastIndexOf('/') + 1).split('?')[0];

  if (fileUrlOrPath.includes('/notes/')) {
    const notesIdx = fileUrlOrPath.indexOf('/notes/');
    const relativePath = fileUrlOrPath.substring(notesIdx + 1);
    return `${FileSystem.documentDirectory}${relativePath}`;
  }

  return `${FileSystem.documentDirectory}${filename}`;
};

export type Note = {
  id: string;
  userId: string;
  title: string;
  date: string; // Formatted date string for UI display
  type: 'document' | 'image';
  pinned: boolean;
  summarized: boolean;
  summary?: string;
  createdAt?: any;
  filePath?: string;
  fileUrl?: string;
};

const formatDate = (dateValue: any): string => {
  if (!dateValue) return 'Unknown Date';

  let dateObj: Date;
  if (dateValue instanceof Timestamp) {
    dateObj = dateValue.toDate();
  } else if (dateValue instanceof Date) {
    dateObj = dateValue;
  } else if (typeof dateValue === 'string') {
    dateObj = new Date(dateValue);
  } else if (dateValue.seconds) {
    dateObj = new Date(dateValue.seconds * 1000);
  } else {
    dateObj = new Date();
  }

  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const fetchNotes = async (userId: string): Promise<Note[]> => {
  try {
    const notesRef = collection(db, 'notes');
    const q = query(
      notesRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    const notes: Note[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      notes.push({
        id: docSnap.id,
        userId: data.userId,
        title: data.title,
        date: formatDate(data.createdAt),
        type: data.type || 'document',
        pinned: !!data.pinned,
        summarized: !!data.summarized,
        summary: data.summary || '',
        createdAt: data.createdAt,
        filePath: data.filePath || '',
        fileUrl: data.fileUrl || '',
      });
    });

    return notes;
  } catch (error) {
    console.error('Error fetching notes from Firestore:', error);
    throw error;
  }
};

export const addNote = async (
  userId: string,
  title: string,
  type: 'document' | 'image'
): Promise<Note> => {
  try {
    const notesRef = collection(db, 'notes');

    const newNoteData = {
      userId,
      title,
      type,
      pinned: false,
      summarized: false,
      summary: '',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(notesRef, newNoteData);

    return {
      id: docRef.id,
      userId,
      title,
      date: formatDate(new Date()),
      type,
      pinned: false,
      summarized: false,
      summary: '',
    };
  } catch (error) {
    console.error('Error adding note to Firestore:', error);
    throw error;
  }
};

export const deleteNoteFromDb = async (noteId: string, filePath?: string): Promise<void> => {
  try {
    if (filePath) {
      if (filePath.startsWith('file://') || !filePath.startsWith('http')) {
        const resolvedPath = resolveFileUri(filePath);
        const fileInfo = await FileSystem.getInfoAsync(resolvedPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(resolvedPath, { idempotent: true });
        }
      } else {
        const fileStorageRef = ref(storage, filePath);
        await deleteObject(fileStorageRef);
      }
    }

    const noteDocRef = doc(db, 'notes', noteId);
    await deleteDoc(noteDocRef);
  } catch (error) {
    console.error('Error in deleteNoteFromDb (dual deletion):', error);
    throw error;
  }
};

export const togglePinNoteInDb = async (noteId: string, pinned: boolean): Promise<void> => {
  try {
    const noteDocRef = doc(db, 'notes', noteId);
    await updateDoc(noteDocRef, { pinned });
  } catch (error) {
    console.error('Error updating pin status in Firestore:', error);
    throw error;
  }
};

// Summaries are stored as text in Firestore.
export const saveNoteSummary = async (noteId: string, summaryText: string): Promise<void> => {
  try {
    const noteDocRef = doc(db, 'notes', noteId);
    await updateDoc(noteDocRef, {
      summary: summaryText,
      summarized: true,
    });
  } catch (error) {
    console.error('Error saving summary to Firestore:', error);
    throw error;
  }
};

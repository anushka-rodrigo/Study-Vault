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

import { db } from '../config/firebase';

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

export const deleteNoteFromDb = async (noteId: string): Promise<void> => {
  try {
    const noteDocRef = doc(db, 'notes', noteId);
    await deleteDoc(noteDocRef);
  } catch (error) {
    console.error('Error deleting note from Firestore:', error);
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

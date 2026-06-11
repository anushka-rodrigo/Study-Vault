import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type Folder = {
  id: string;
  userId: string;
  name: string;
  noteIds: string[];
};

export const fetchFolders = async (userId: string): Promise<Folder[]> => {
  const foldersRef = collection(db, 'folders');
  const q = query(foldersRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);

  const folders: Folder[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    folders.push({
      id: docSnap.id,
      userId: data.userId,
      name: data.name,
      noteIds: data.noteIds || [],
    });
  });
  return folders;
};

export const createFolder = async (userId: string, name: string): Promise<Folder> => {
  const foldersRef = collection(db, 'folders');
  const docRef = await addDoc(foldersRef, {
    userId,
    name,
    noteIds: [],
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    name,
    noteIds: [],
  };
};

export const addNoteToFolderInDb = async (folderId: string, noteId: string): Promise<void> => {
  const folderDocRef = doc(db, 'folders', folderId);
  await updateDoc(folderDocRef, {
    noteIds: arrayUnion(noteId),
  });
};

export const removeNoteFromFolderInDb = async (folderId: string, noteId: string): Promise<void> => {
  const folderDocRef = doc(db, 'folders', folderId);
  await updateDoc(folderDocRef, {
    noteIds: arrayRemove(noteId),
  });
};

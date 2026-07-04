import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
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

export const deleteFolderFromDb = async (folderId: string): Promise<void> => {
  const folderDocRef = doc(db, 'folders', folderId);
  await deleteDoc(folderDocRef);
};

// Client-side search: filters an already-fetched folder list by folder name.
// Case-insensitive. Results are ranked so names that START WITH the query
// appear first, followed by names that merely CONTAIN the query elsewhere.
export const searchFoldersByName = (folders: Folder[], searchQuery: string): Folder[] => {
  const trimmedQuery = searchQuery.trim().toLowerCase();
  if (!trimmedQuery) return folders;

  const startsWith: Folder[] = [];
  const contains: Folder[] = [];

  for (const folder of folders) {
    const name = folder.name?.toLowerCase() || '';
    if (name.startsWith(trimmedQuery)) {
      startsWith.push(folder);
    } else if (name.includes(trimmedQuery)) {
      contains.push(folder);
    }
  }
  
  return [...startsWith, ...contains];
};


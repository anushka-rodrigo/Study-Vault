import * as FileSystem from 'expo-file-system/legacy';
import { resolveFileUri } from './fileStorageService';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const PROFILE_IMAGES_DIR = `${FileSystem.documentDirectory}profileImages/`;

// Ensures the profileImages directory exists before writing to it.
const ensureProfileImagesDir = async (): Promise<void> => {
    const dirInfo = await FileSystem.getInfoAsync(PROFILE_IMAGES_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(PROFILE_IMAGES_DIR, { intermediates: true });
    }
};

// Copies a picked image (from expo-image-picker) into permanent local storage and returns a relative path to save in Firestore.
export const uploadProfileImage = async (
    userId: string,
    pickedImageUri: string
): Promise<string> => {
    try {
        await ensureProfileImagesDir();

        // Unique filename per upload (timestamp), so the URI always changes.
        const extensionMatch = pickedImageUri.match(/\.(\w+)$/);
        const extension = extensionMatch ? extensionMatch[1] : 'jpg';
        const filename = `${userId}_${Date.now()}.${extension}`;
        const destinationUri = `${PROFILE_IMAGES_DIR}${filename}`;

        await FileSystem.copyAsync({ from: pickedImageUri, to: destinationUri });

        // Store the relative path 
        return `profileImages/${filename}`;
    } catch (error) {
        console.error('Error saving profile image locally:', error);
        throw error;
    }
};

// Deletes a previously saved local profile image, if it exists.
export const deleteOldProfileImage = async (relativePath?: string): Promise<void> => {
    if (!relativePath) return;
    try {
        const resolvedPath = resolveFileUri(relativePath);
        const fileInfo = await FileSystem.getInfoAsync(resolvedPath);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(resolvedPath, { idempotent: true });
        }
    } catch (error) {
        console.error('Error deleting old profile image:', error);
    }
};

// Deletes the user's Firestore profile document and their local profile image.
export const deleteUserProfileData = async (
    userId: string,
    profileImagePath?: string
): Promise<void> => {
    try {
        if (profileImagePath) {
            await deleteOldProfileImage(profileImagePath);
        }
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
    } catch (error) {
        console.error('Error deleting user profile data:', error);
        throw error;
    }
};
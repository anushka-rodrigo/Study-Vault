import * as FileSystem from 'expo-file-system/legacy';

// Resolves a stored relative path (or full URL) into a valid absolute file URI.
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

    if (fileUrlOrPath.includes('profileImages/')) {
        const idx = fileUrlOrPath.indexOf('profileImages/');
        const relativePath = fileUrlOrPath.substring(idx);
        return `${FileSystem.documentDirectory}${relativePath}`;
    }

    return `${FileSystem.documentDirectory}${filename}`;
};
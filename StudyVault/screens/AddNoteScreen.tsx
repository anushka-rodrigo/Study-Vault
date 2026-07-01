import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

type Props = {
  navigation: any;
};

export default function AddNoteScreen({ navigation }: Props) {
  const [pickingPdf, setPickingPdf] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  const checkDuplicateNote = async (userId: string, title: string): Promise<boolean> => {
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
      where('title', '==', title)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };


  // Pick a PDF, store locally, and save metadata to Firestore.
  const handleUploadPDF = async () => {
    setPickingPdf(true);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'User is not logged in.');
      setPickingPdf(false);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const asset = result.assets[0];

      const noteTitle = asset.name.replace(/\.[^/.]+$/, "");

      const isDuplicate = await checkDuplicateNote(currentUser.uid, noteTitle);
      if (isDuplicate) {
        Alert.alert(
          'Duplicate Note',
          'A note with the name "' + noteTitle + '" already exists. Please choose another file or rename it before uploading.'
        );
        return;
      }

      // Copy file from temporary cache to permanent local storage.
      const destFilename = `${Date.now()}_${asset.name}`;
      const dirPath = `${FileSystem.documentDirectory}notes/${currentUser.uid}/docs/`;
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      const localDest = `${dirPath}${destFilename}`;
      await FileSystem.copyAsync({
        from: asset.uri,
        to: localDest,
      });

      // Save note title, type, and local file path to Firestore.
      await addDoc(collection(db, 'notes'), {
        userId: currentUser.uid,
        title: noteTitle,
        type: 'document',
        fileUrl: localDest,
        filePath: localDest,
        pinned: false,
        summarized: false,
        summary: '',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Success',
        'PDF saved locally and note created!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to upload PDF: ' + (error.message || error));
    } finally {
      setPickingPdf(false);
    }
  };

  // Pick an image, store it locally, and write metadata to Firestore.
  const handleUploadImage = async () => {
    setPickingImage(true);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'User is not logged in.');
      setPickingImage(false);
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      const filename = asset.fileName || `image_${Date.now()}.jpg`;

      const noteTitle = filename.replace(/\.[^/.]+$/, "");

      const isDuplicate = await checkDuplicateNote(currentUser.uid, noteTitle);
      if (isDuplicate) {
        Alert.alert(
          'Duplicate Note',
          'A note with the name "' + noteTitle + '" already exists. Please choose another image or rename it before uploading.'
        );
        return;
      }

      const destFilename = `${Date.now()}_${filename}`;
      const dirPath = `${FileSystem.documentDirectory}notes/${currentUser.uid}/images/`;
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      const localDest = `${dirPath}${destFilename}`;
      await FileSystem.copyAsync({
        from: asset.uri,
        to: localDest,
      });

      // Save note title, type, and local file path to Firestore.
      await addDoc(collection(db, 'notes'), {
        userId: currentUser.uid,
        title: noteTitle,
        type: 'image',
        fileUrl: localDest,
        filePath: localDest,
        pinned: false,
        summarized: false,
        summary: '',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Success',
        'Image saved locally and note created!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to upload image: ' + (error.message || error));
    } finally {
      setPickingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Note</Text>
        {/* Spacer to centre title */}
        <View style={styles.backBtn} />
      </View>

      {/* Body */}
      <View style={styles.body}>

        {/* Upload PDF card */}
        <TouchableOpacity
          style={[styles.uploadCard, styles.uploadCardPdf]}
          onPress={handleUploadPDF}
          disabled={pickingPdf || pickingImage}
          activeOpacity={0.75}
        >
          <View style={[styles.iconCircle, styles.iconCirclePdf]}>
            {pickingPdf ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Image source={require('../assets/icons/pdf-icon.jpg')} style={styles.cardIconImage} resizeMode="contain" />
            )}
          </View>
          <Text style={styles.cardTitle}>Upload PDF</Text>
          <Text style={styles.cardSubtitle}>Select from device storage</Text>
        </TouchableOpacity>

        {/* Upload Handwritten Notes card */}
        <TouchableOpacity
          style={[styles.uploadCard, styles.uploadCardImage]}
          onPress={handleUploadImage}
          disabled={pickingPdf || pickingImage}
          activeOpacity={0.75}
        >
          <View style={[styles.iconCircle, styles.iconCircleImage]}>
            {pickingImage ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Image source={require('../assets/icons/image-icon.jpg')} style={styles.cardIconImage} resizeMode="contain" />
            )}
          </View>
          <Text style={styles.cardTitle}>Upload Handwritten Notes</Text>
          <Text style={styles.cardSubtitle}>Select from gallery or files</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
  },

  // Body — vertically centred cards
  body: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },

  // Upload cards
  uploadCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  uploadCardPdf: {
    borderColor: '#60A5FA',
  },
  uploadCardImage: {
    borderColor: '#C084FC',
  },

  cardIconImage: { width: 36, height: 36 },

  // Icon circles
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconCirclePdf: {
    backgroundColor: '#2563EB',
  },
  iconCircleImage: {
    backgroundColor: '#7C3AED',
  },
  iconEmoji: {
    fontSize: 30,
  },

  // Card text
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '400',
  },
});
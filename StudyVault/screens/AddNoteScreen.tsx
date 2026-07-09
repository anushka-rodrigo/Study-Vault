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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/colors';

type Props = {
  navigation: any;
};

// Holds the data for a file that has been picked but not yet saved, while the user is in the rename dialog.
type PendingUpload = {
  uri: string;        
  name: string;       
  type: 'document' | 'image';
};

export default function AddNoteScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors);

  const [pickingPdf, setPickingPdf] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  // Rename-before-upload state
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');   // name WITHOUT extension
  const [saving, setSaving] = useState(false);

  const checkDuplicateNote = async (userId: string, title: string): Promise<boolean> => {
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
      where('title', '==', title)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };


  // Pick a PDF and open the rename dialog.
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

      // Pre-fill rename dialog with the filename (no extension)
      const defaultTitle = asset.name.replace(/\.[^/.]+$/, '');
      setPendingUpload({ uri: asset.uri, name: asset.name, type: 'document' });
      setRenameValue(defaultTitle);
      setRenameModalVisible(true);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to pick PDF: ' + (error.message || error));
    } finally {
      setPickingPdf(false);
    }
  };

  // Pick an image and open the rename dialog.
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

      // Pre-fill rename dialog with the filename (no extension)
      const defaultTitle = filename.replace(/\.[^/.]+$/, '');
      setPendingUpload({ uri: asset.uri, name: filename, type: 'image' });
      setRenameValue(defaultTitle);
      setRenameModalVisible(true);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to pick image: ' + (error.message || error));
    } finally {
      setPickingImage(false);
    }
  };

  // After User confirmed the name, do the duplicate check and save.
  const handleConfirmUpload = async () => {
    if (!pendingUpload) return;

    const noteTitle = renameValue.trim();
    if (!noteTitle) {
      Alert.alert('Name required', 'Please enter a name for this note.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'User is not logged in.');
      return;
    }

    setSaving(true);
    try {
      // Duplicate-name check (uses the user-supplied title)
      const isDuplicate = await checkDuplicateNote(currentUser.uid, noteTitle);
      if (isDuplicate) {
        Alert.alert(
          'Duplicate Note',
          `A note named "${noteTitle}" already exists. Please choose a different name.`
        );
        return;
      }

      // Copy file to permanent local storage.
      if (pendingUpload.type === 'document') {
        const destFilename = `${Date.now()}_${pendingUpload.name}`;
        const dirPath = `${FileSystem.documentDirectory}notes/${currentUser.uid}/docs/`;
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        const localDest = `${dirPath}${destFilename}`;
        await FileSystem.copyAsync({ from: pendingUpload.uri, to: localDest });

        // Save metadata to Firestore.
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
      } else {
        const destFilename = `${Date.now()}_${pendingUpload.name}`;
        const dirPath = `${FileSystem.documentDirectory}notes/${currentUser.uid}/images/`;
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        const localDest = `${dirPath}${destFilename}`;
        await FileSystem.copyAsync({ from: pendingUpload.uri, to: localDest });

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
      }

      // Close modal and go back on success.
      setRenameModalVisible(false);
      setPendingUpload(null);
      Alert.alert(
        'Success',
        pendingUpload.type === 'document'
          ? 'PDF saved locally and note created!'
          : 'Image saved locally and note created!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Failed to save note: ' + (error.message || error));
    } finally {
      setSaving(false);
    }
  };

  // Dismiss the rename modal and discard the picked file.
  const handleCancelRename = () => {
    setRenameModalVisible(false);
    setPendingUpload(null);
    setRenameValue('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

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
              <ActivityIndicator color={colors.primaryButtonText} size="large" />
            ) : (
              <Text style={styles.cardIcon}>📄</Text>
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
              <ActivityIndicator color={colors.primaryButtonText} size="large" />
            ) : (
              <Text style={styles.cardIcon}>📝</Text>
            )}
          </View>
          <Text style={styles.cardTitle}>Upload Handwritten Notes</Text>
          <Text style={styles.cardSubtitle}>Select from gallery or files</Text>
        </TouchableOpacity>

      </View>

      {/* Rename-before-upload modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelRename}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.renameOverlay}
        >
          <View style={styles.renameCard}>
            {/* Icon badge */}
            <View style={[
              styles.renameBadge,
              pendingUpload?.type === 'document' ? styles.renameBadgePdf : styles.renameBadgeImage,
            ]}>
              <Text style={styles.renameBadgeEmoji}>
                {pendingUpload?.type === 'document' ? '📄' : '📝'}
              </Text>
            </View>

            <Text style={styles.renameTitle}>Name Your Note</Text>
            <Text style={styles.renameSubtitle}>
              You can keep the original name or type a custom one.
            </Text>

            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Enter note name"
              placeholderTextColor={colors.placeholder}
              autoFocus
              selectTextOnFocus
              maxLength={80}
            />

            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={handleCancelRename}
                disabled={saving}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.renameConfirmBtn,
                  pendingUpload?.type === 'document' ? styles.renameConfirmBtnPdf : styles.renameConfirmBtnImage,
                ]}
                onPress={handleConfirmUpload}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryButtonText} size="small" />
                ) : (
                  <Text style={styles.renameConfirmText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: colors.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },

  // Body 
  body: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    gap: 10,
  },
  uploadCardPdf: {
        borderColor: colors.header,
  },
  uploadCardImage: {
    borderColor: colors.accent,
  },

  cardIcon: { fontSize: 24 },

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
    backgroundColor: colors.header,
  },
  iconCircleImage: {
    backgroundColor: colors.accent,
  },
  iconEmoji: {
    fontSize: 30,
  },

  // Card text
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '400',
  },

  // Rename modal
  renameOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  renameCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  renameBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  renameBadgePdf: { backgroundColor: colors.background },
  renameBadgeImage: { backgroundColor: colors.accent },
  renameBadgeEmoji: { fontSize: 28 },
  renameTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  renameSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  renameInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.inputBackground,
    marginBottom: 22,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  renameCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
  },
  renameCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  renameConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  renameConfirmBtnPdf: { backgroundColor: colors.primaryButton },
  renameConfirmBtnImage: { backgroundColor: colors.accent },
  renameConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryButtonText,
  },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ScrollView,
  Switch,
  Modal,
} from 'react-native';

import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/colors';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import { resolveFileUri } from '../services/fileStorageService';
import { uploadProfileImage, deleteOldProfileImage } from '../services/profileService';
import { fetchNotes, deleteNoteFromDb } from '../services/noteService';
import { fetchFolders, deleteFolderFromDb } from '../services/folderService';
import { deleteUserProfileData } from '../services/profileService';

type Props = {
  navigation: any;
};

export default function ProfileScreen({ navigation }: Props) {
  const { colors, mode, toggleTheme } = useTheme();
  const styles = getStyles(colors);

  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [savedFullName, setSavedFullName] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [profileImagePath, setProfileImagePath] = useState('');
  const [profileImageUri, setProfileImageUri] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Subscribe to auth state and load profile from Firestore on mount.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFullName(data.fullName || '');
            setUsername(data.username || '');
            setEmail(data.email || user.email || '');

            if (data.profileImagePath) {
              setProfileImagePath(data.profileImagePath);
              const resolvedUri = resolveFileUri(data.profileImagePath);
              const fileInfo = await FileSystem.getInfoAsync(resolvedUri);
              // Falls back to default avatar if the file isn't on this device.
              if (fileInfo.exists) {
                setProfileImageUri(resolvedUri);
              } else {
                setProfileImageUri('');
              }
            }
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to fetch user details from database.');
        }
      } else {
        navigation.replace('Login');
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleEdit = () => {
    // Snapshot current values so cancel can revert them.
    setSavedFullName(fullName);
    setSavedUsername(username);
    setSavedEmail(email);
    setIsEditing(true);
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const newRelativePath = await uploadProfileImage(user.uid, result.assets[0].uri);

      // Remove the previous local file so storage doesn't fill up with old images.
      if (profileImagePath && profileImagePath !== newRelativePath) {
        await deleteOldProfileImage(profileImagePath);
      }

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { profileImagePath: newRelativePath });

      setProfileImagePath(newRelativePath);
      setProfileImageUri(resolveFileUri(newRelativePath));
      Alert.alert('Success', 'Profile picture updated successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile picture.');
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        fullName,
        username,
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile details.');
    }
  };

  const handleCancel = () => {
    setFullName(savedFullName);
    setUsername(savedUsername);
    setEmail(savedEmail);
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await auth.signOut();
            navigation.replace('Login');
          } catch (error) {
            Alert.alert('Error', 'Failed to log out.');
          }
        },
      },
    ]);
  };

  // Shows the warning, then opens the password confirmation modal.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, notes, and profile picture. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setDeleteModalVisible(true),
        },
      ]
    );
  };

  // Reauthenticates with password first, then deletes data only if that succeeds.
  const handleConfirmDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    if (!deletePassword) {
      Alert.alert('Password required', 'Please enter your password to confirm.');
      return;
    }

    setDeletingAccount(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      const userNotes = await fetchNotes(user.uid);
      for (const note of userNotes) {
        await deleteNoteFromDb(note.id, note.filePath || note.fileUrl);
      }

      const userFolders = await fetchFolders(user.uid);
      for (const folder of userFolders) {
        await deleteFolderFromDb(folder.id);
      }

      await deleteUserProfileData(user.uid, profileImagePath);
      await user.delete();

      setDeleteModalVisible(false);
      setDeletePassword('');
      Alert.alert('Account Deleted', 'Your account has been deleted successfully.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);

    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert('Incorrect password', 'Please enter the correct password to confirm deletion.');
      } else {
        Alert.alert('Error', 'Failed to delete account. Please try again.');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={isEditing ? handleCancel : () => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerSideBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Profile</Text>

        <TouchableOpacity
          onPress={isEditing ? handleSave : handleEdit}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerSideBtn}
        >
          {isEditing ? (
            <Text style={styles.saveText}>Save</Text>
          ) : (
            <Text style={styles.editIcon}>✏️</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarIcon}>👤</Text>
            )}
            {isEditing && (
              <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage}>
                <Text style={styles.cameraIcon}>📷</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Show name/email */}
          {!isEditing && (
            <>
              <Text style={styles.avatarName}>{fullName}</Text>
              <Text style={styles.avatarEmail}>{email}</Text>
            </>
          )}
        </View>

        {/* Info fields */}
        <View style={styles.fieldsContainer}>

          {/* Full Name */}
          <View style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>👤</Text>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    placeholderTextColor={colors.placeholder}
                  />
                ) : (
                  <Text style={styles.fieldValue}>{fullName}</Text>
                )}
              </View>
            </View>
            {isEditing && <View style={styles.fieldUnderline} />}
          </View>

          {/* Username */}
          <View style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldIcon, { color: '#7C3AED' }]}>👤</Text>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Username</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    returnKeyType="next"
                    placeholderTextColor={colors.placeholder}
                  />
                ) : (
                  <Text style={styles.fieldValue}>{username}</Text>
                )}
              </View>
            </View>
            {isEditing && <View style={styles.fieldUnderline} />}
          </View>

          {/* Email */}
          <View style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>✉️</Text>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>Email</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    placeholderTextColor={colors.placeholder}
                  />
                ) : (
                  <Text style={styles.fieldValue}>{email}</Text>
                )}
              </View>
            </View>
            {isEditing && <View style={styles.fieldUnderline} />}
          </View>

          {/* Change Password */}
          <TouchableOpacity
            style={styles.fieldCard}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.7}
          >
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>🔒</Text>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldValueBold}>Change Password</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Dark Mode toggle */}
          <View style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldIcon}>🌙</Text>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldValueBold}>Dark Mode</Text>
              </View>
              <Switch
                value={mode === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D1D5DB', true: colors.header }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

        </View>

        {/* Logout button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Delete account button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.85}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Delete account password confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Confirm Password</Text>
            <Text style={styles.deleteModalSubtitle}>
              Enter your password to permanently delete your account.
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              autoFocus
            />
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeletePassword('');
                }}
                disabled={deletingAccount}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmBtn}
                onPress={handleConfirmDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={styles.deleteModalConfirmText}>
                  {deletingAccount ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerSideBtn: { width: 44, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: colors.text, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  editIcon: { fontSize: 20, textAlign: 'right' },
  saveText: { fontSize: 15, fontWeight: '700', color: colors.header, textAlign: 'right' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: colors.header,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarIcon: { fontSize: 44 },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  cameraIcon: { fontSize: 14 },
  avatarName: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  avatarEmail: { fontSize: 13, color: colors.textSecondary },

  // Fields
  fieldsContainer: { paddingHorizontal: 16, gap: 12 },
  fieldCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldIcon: { fontSize: 20, width: 24, textAlign: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  fieldValueBold: { fontSize: 15, fontWeight: '600', color: colors.text },
  fieldInput: {
    fontSize: 15, fontWeight: '600', color: colors.text,
    padding: 0, margin: 0,
  },
  fieldUnderline: { height: 1, backgroundColor: colors.border, marginTop: 8 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryButton, borderRadius: 14,
    marginHorizontal: 16, marginTop: 28,
    paddingVertical: 16, gap: 10,
  },
  logoutIcon: { fontSize: 18, color: colors.primaryButtonText, fontWeight: '700' },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.primaryButtonText },

  // Delete account
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: 14,
    marginHorizontal: 16, marginTop: 12, marginBottom: 12,
    paddingVertical: 16, gap: 10,
    borderWidth: 1, borderColor: '#EF4444',
  },
  deleteText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },

  // Delete account password modal
  deleteModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  deleteModalCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%',
  },
  deleteModalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 },
  deleteModalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 18, lineHeight: 18 },
  deleteModalInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    color: colors.text, backgroundColor: colors.background, marginBottom: 20,
  },
  deleteModalActions: { flexDirection: 'row', gap: 12 },
  deleteModalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.background, alignItems: 'center',
  },
  deleteModalCancelText: { fontSize: 15, fontWeight: '700', color: colors.text },
  deleteModalConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  deleteModalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

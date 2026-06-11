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
} from 'react-native';

import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

type Props = {
  navigation: any;
};

export default function ProfileScreen({ navigation }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [savedFullName, setSavedFullName] = useState('');
  const [savedUsername, setSavedUsername] = useState('');
  const [savedEmail, setSavedEmail] = useState('');

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
            <Text style={styles.avatarIcon}>👤</Text>
            {isEditing && (
              <TouchableOpacity style={styles.cameraBtn}>
                <Text style={styles.cameraIcon}>📷</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Show name/email under avatar only in view mode */}
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

        </View>

        {/* Logout button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerSideBtn: { width: 44, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#374151', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  editIcon: { fontSize: 20, textAlign: 'right' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#2563EB', textAlign: 'right' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarIcon: { fontSize: 44 },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cameraIcon: { fontSize: 14 },
  avatarName: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  avatarEmail: { fontSize: 13, color: '#6B7280' },

  // Fields
  fieldsContainer: { paddingHorizontal: 16, gap: 12 },
  fieldCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldIcon: { fontSize: 20, width: 24, textAlign: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  fieldValueBold: { fontSize: 15, fontWeight: '600', color: '#111827' },
  fieldInput: {
    fontSize: 15, fontWeight: '600', color: '#111827',
    padding: 0, margin: 0,
  },
  fieldUnderline: { height: 1, backgroundColor: '#E5E7EB', marginTop: 8 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2563EB', borderRadius: 14,
    marginHorizontal: 16, marginTop: 28,
    paddingVertical: 16, gap: 10,
  },
  logoutIcon: { fontSize: 18, color: '#FFFFFF', fontWeight: '700' },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
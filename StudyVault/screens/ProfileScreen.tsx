import React, { useState } from 'react';
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

type Props = {
  navigation: any;
};

export default function ProfileScreen({ navigation }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  // Profile data state
  const [fullName, setFullName]   = useState('John Doe');
  const [username, setUsername]   = useState('johndoe');
  const [email, setEmail]         = useState('john.doe@university.edu');

  // Saved copies to revert on cancel
  const [savedFullName, setSavedFullName] = useState('John Doe');
  const [savedUsername, setSavedUsername] = useState('johndoe');
  const [savedEmail, setSavedEmail]       = useState('john.doe@university.edu');

  const handleEdit = () => {
    // Save current values so we can revert if user cancels
    setSavedFullName(fullName);
    setSavedUsername(username);
    setSavedEmail(email);
    setIsEditing(true);
  };

  const handleSave = () => {
    // TODO: persist to Firebase here
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Revert to saved values
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
        onPress: () => navigation.replace('Login'),
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
  avatarName:  { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
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
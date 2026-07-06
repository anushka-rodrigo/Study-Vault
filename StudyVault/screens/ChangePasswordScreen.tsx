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

import { auth } from '../config/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/colors';

type Props = {
  navigation: any;
};

export default function ChangePasswordScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }

    // Reauthenticates the user with their current password and applies the new password.
    const user = auth.currentUser;
    if (!user || !user.email) {
      Alert.alert('Error', 'User session not found.');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert('Success', 'Password changed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password. Please verify your current password.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerSideBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSideBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current Password */}
        <Text style={styles.inputLabel}>Current Password</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            returnKeyType="next"
          />
        </View>

        {/* New Password */}
        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            returnKeyType="next"
          />
        </View>

        {/* Confirm New Password */}
        <Text style={styles.inputLabel}>Confirm New Password</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            onSubmitEditing={handleSavePassword}
          />
        </View>

        {/* Save Password button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSavePassword}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>Save Password</Text>
        </TouchableOpacity>

      </ScrollView>
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 8 },

  // Input fields
  inputLabel: {
    fontSize: 14, fontWeight: '600', color: colors.text,
    marginBottom: 6, marginTop: 8,
  },
  inputCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    marginBottom: 4,
  },
  input: {
    fontSize: 15, color: colors.text,
    paddingVertical: 12,
  },

  // Save button
  saveBtn: {
    backgroundColor: colors.primaryButton, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.primaryButtonText },
});
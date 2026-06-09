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

type Props = {
  navigation: any;
};

export default function AddNoteScreen({ navigation }: Props) {
  const [pickingPdf, setPickingPdf] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  const handleUploadPDF = async () => {
    setPickingPdf(true);
    try {
      // TODO: Replace the block below with your real file picker implementation.
      // Recommended package: expo-document-picker
      //
      // import * as DocumentPicker from 'expo-document-picker';
      //
      // const result = await DocumentPicker.getDocumentAsync({
      //   type: 'application/pdf',
      //   copyToCacheDirectory: true,
      // });
      //
      // if (result.canceled) return;
      // const file = result.assets[0];
      // Upload file.uri to Firebase Storage here, then navigate back.
      //
      // ── MOCK (remove when real picker is wired up) ──────────────────────────
      await new Promise(resolve => setTimeout(resolve, 800));
      Alert.alert(
        'PDF Selected (mock)',
        'Wire up expo-document-picker and Firebase Storage here.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      // ── END MOCK ────────────────────────────────────────────────────────────
    } finally {
      setPickingPdf(false);
    }
  };

  const handleUploadImage = async () => {
    setPickingImage(true);
    try {
      // TODO: Replace the block below with your real image picker implementation.
      // Recommended package: expo-image-picker
      //
      // import * as ImagePicker from 'expo-image-picker';
      //
      // const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // if (!permission.granted) {
      //   Alert.alert('Permission required', 'Allow access to your photo library.');
      //   return;
      // }
      //
      // const result = await ImagePicker.launchImageLibraryAsync({
      //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
      //   quality: 1,
      // });
      //
      // if (result.canceled) return;
      // const file = result.assets[0];
      // Upload file.uri to Firebase Storage here, then navigate back.
      //
      // ── MOCK (remove when real picker is wired up) ──────────────────────────
      await new Promise(resolve => setTimeout(resolve, 800));
      Alert.alert(
        'Image Selected (mock)',
        'Wire up expo-image-picker and Firebase Storage here.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      // ── END MOCK ────────────────────────────────────────────────────────────
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
              <Image source={require('../assets/icons/pdf-icon.png')} style={styles.cardIconImage} resizeMode="contain" />
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
              <Image source={require('../assets/icons/image-icon.png')} style={styles.cardIconImage} resizeMode="contain" />
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
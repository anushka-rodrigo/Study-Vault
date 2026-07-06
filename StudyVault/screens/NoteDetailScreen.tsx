import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Image,
  Platform,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';

import { togglePinNoteInDb, saveNoteSummary, renameNoteInDb, isNoteTitleTaken, Note, resolveFileUri } from '../services/noteService';
import { summarizeNote, formatSummaryForExport, NoteSummaryData } from '../services/geminiService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/colors';

type Props = {
  navigation: any;
  route: {
    params: {
      note: Note;
      onPinToggle: (pinned: boolean) => void;
    };
  };
};

// Renders a structured AI summary (real bold/section components, no markdown parsing).
function StructuredSummary({ data, colors }: { data: NoteSummaryData; colors: ThemeColors }) {
  const summaryStyles = getSummaryStyles(colors);
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 6 }}>
        <Text style={summaryStyles.sectionHeading}>Overview</Text>
        <Text style={summaryStyles.paragraph}>{data.overview}</Text>
      </View>

      {data.keyTopics.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={summaryStyles.sectionHeading}>Key Topics</Text>
          {data.keyTopics.map((topic, i) => (
            <View key={i} style={summaryStyles.bulletRow}>
              <Text style={summaryStyles.bullet}>•</Text>
              <Text style={summaryStyles.bulletText}>
                <Text style={summaryStyles.bold}>{topic.title}: </Text>
                {topic.description}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.keyFormulas.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={summaryStyles.sectionHeading}>Key Formulas & Definitions</Text>
          {data.keyFormulas.map((f, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={summaryStyles.formula}>{f.formula}</Text>
              <Text style={summaryStyles.paragraph}>{f.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {data.workedExample.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={summaryStyles.sectionHeading}>Worked Example</Text>
          {data.workedExample.map((step, i) => (
            <View key={i} style={summaryStyles.bulletRow}>
              <Text style={summaryStyles.bold}>{i + 1}.</Text>
              <Text style={summaryStyles.bulletText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Fallback renderer for old notes summarized before the JSON format was introduced
// (their "summary" field in Firestore is plain markdown-ish text, not JSON).
function LegacySummaryText({ text, colors }: { text: string; colors: ThemeColors }) {
  const summaryStyles = getSummaryStyles(colors);
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        if (line.trim() === '') return <View key={i} style={{ height: 6 }} />;

        if (line.trim().startsWith('•')) {
          const bulletText = line.trim().replace(/^•\s*/, '');
          const parts = bulletText.split(/\*\*(.*?)\*\*/g);
          return (
            <View key={i} style={summaryStyles.bulletRow}>
              <Text style={summaryStyles.bullet}>•</Text>
              <Text style={summaryStyles.bulletText}>
                {parts.map((part, j) =>
                  j % 2 === 1
                    ? <Text key={j} style={summaryStyles.bold}>{part}</Text>
                    : part
                )}
              </Text>
            </View>
          );
        }

        if (line.includes('**')) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <Text key={i} style={summaryStyles.paragraph}>
              {parts.map((part, j) =>
                j % 2 === 1
                  ? <Text key={j} style={summaryStyles.bold}>{part}</Text>
                  : part
              )}
            </Text>
          );
        }

        return <Text key={i} style={summaryStyles.paragraph}>{line}</Text>;
      })}
    </View>
  );
}

// Tries to parse the stored summary as structured JSON; falls back to legacy text rendering.
function SummaryContent({ text, colors }: { text: string; colors: ThemeColors }) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.keyTopics)) {
      return <StructuredSummary data={parsed as NoteSummaryData} colors={colors} />;
    }
  } catch {
    // Not JSON — fall through to legacy renderer below.
  }
  return <LegacySummaryText text={text} colors={colors} />;
}

// summaryStyles depends on the active theme, so it's a function called with
// the current palette rather than a static StyleSheet.create() at module scope.
const getSummaryStyles = (colors: ThemeColors) => StyleSheet.create({
  sectionHeading: { fontSize: 14, fontWeight: '800', color: colors.header, textTransform: 'uppercase', letterSpacing: 0.3 },
  formula: { fontSize: 14, fontWeight: '700', color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  paragraph: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  bold: { fontWeight: '700', color: colors.text },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});

export default function DbNoteDetailScreen({ navigation, route }: Props) {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors);

  const { note, onPinToggle } = route.params;
  const [pinned, setPinned] = useState(note.pinned);
  const [summarized, setSummarized] = useState(note.summarized);
  const [summary, setSummary] = useState(note.summary ?? '');
  const [summarizing, setSummarizing] = useState(false);

  // Rename state
  const [noteTitle, setNoteTitle] = useState(note.title);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const resolvedFileUrl = resolveFileUri(note.fileUrl);

  const handlePinToggle = async () => {
    const newPinned = !pinned;
    try {
      await togglePinNoteInDb(note.id, newPinned);
      setPinned(newPinned);
      onPinToggle(newPinned);
    } catch (error) {
      Alert.alert('Error', 'Failed to update pin status in Firestore.');
    }
  };

  const handleSummarize = async (isResummarize: boolean = false) => {
    if (!resolvedFileUrl) {
      Alert.alert('Error', 'No file is attached to this note.');
      return;
    }

    setSummarizing(true);
    try {
      const result = await summarizeNote(resolvedFileUrl, note.type, note.title);

      if (!result.success || !result.summaryData) {
        Alert.alert('Summarization Failed', result.error || 'Please try again.');
        return;
      }

      // Stored as a JSON string so the existing "summary" string field in
      // Firestore/noteService doesn't need a schema change.
      const summaryJson = JSON.stringify(result.summaryData);
      await saveNoteSummary(note.id, summaryJson);
      setSummary(summaryJson);
      setSummarized(true);

      // The card just swaps text in place on resummarize, which can be easy
      // to miss if only a few words changed, so confirm it explicitly.
      if (isResummarize) {
        Alert.alert('Summary Updated', 'The AI summary has been regenerated.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save summary to database.');
    } finally {
      setSummarizing(false);
    }
  };

  // Opens the rename modal pre-filled with the current title.
  const handleOpenRename = () => {
    setRenameValue(noteTitle);
    setRenameModalVisible(true);
  };

  // Saves the new title to Firestore and updates local state.
  const handleConfirmRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for this note.');
      return;
    }
    if (trimmed === noteTitle) {
      setRenameModalVisible(false);
      return;
    }
    setRenaming(true);
    try {
      const isDuplicate = await isNoteTitleTaken(note.userId, trimmed, note.id);

      if (isDuplicate) {
        Alert.alert('Name already used', 'Another note already has this name. Please choose a different one.');
        setRenaming(false);
        return;
      }

      await renameNoteInDb(note.id, trimmed);
      setNoteTitle(trimmed);
      setRenameModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to rename note: ' + (error.message || error));
    } finally {
      setRenaming(false);
    }
  };

  const handleResummarize = () => {
    Alert.alert('Resummarize', 'Regenerate AI summary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resummarize',
        onPress: () => {
          handleSummarize(true);
        },
      },
    ]);
  };

  // The stored "summary" is JSON for new notes, plain text for old (pre-JSON) notes.
  // This always returns clean plain text, suitable for sharing/downloading.
  const getSummaryExportText = (): string => {
    try {
      const parsed = JSON.parse(summary);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.keyTopics)) {
        return formatSummaryForExport(parsed as NoteSummaryData);
      }
    } catch {
      // Not JSON — it's already legacy plain text.
    }
    return summary;
  };

  const handleShareSummary = async () => {
    if (!summary) {
      Alert.alert('No Summary Available', 'Please generate an AI summary first before sharing it.');
      return;
    }
    try {
      await Share.share({
        message: `AI Summary of ${note.title}:\n\n${getSummaryExportText()}`,
        title: `Summary of ${note.title}`,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share summary: ' + error.message);
    }
  };

  // Exports the AI Summary text as a local .txt file.
  const handleDownloadSummary = async () => {
    if (!summary) {
      Alert.alert('No Summary Available', 'Please generate an AI summary first before exporting it.');
      return;
    }

    const sanitizedTitle = note.title.toLowerCase().replace(/\s+/g, '_');
    const filename = `${sanitizedTitle}_summary.txt`;
    const content = getSummaryExportText();

    try {
      if (Platform.OS === 'android') {
        // Ask user to pick a directory (e.g. Downloads) and write straight into it.
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          // User backed out of the folder picker to cancel — not an error, just stop here.
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          'text/plain'
        );
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        Alert.alert('Downloaded', 'Summary saved to the selected folder.');
      } else {
        // iOS: no public writable "Downloads" — share sheet's "Save to Files" is the platform-correct save path.
        const tempUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(tempUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempUri, { UTI: 'public.plain-text' });
        } else {
          Alert.alert('Success', 'Summary saved to local storage.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to download summary: ' + error.message);
    }
  };

  // Resolves the note's attached file to a local URI, downloading it first if
  // it's still a remote URL. Shared by view/share/download so all three stay
  // in sync on how a "local copy" of the file is obtained.
  const ensureLocalFileUri = async (): Promise<string | null> => {
    if (!resolvedFileUrl) return null;

    if (resolvedFileUrl.startsWith('http://') || resolvedFileUrl.startsWith('https://')) {
      const filename = resolvedFileUrl.substring(resolvedFileUrl.lastIndexOf('/') + 1).split('?')[0];
      const dirPath = `${FileSystem.documentDirectory}notes/${note.userId}/${note.type === 'document' ? 'docs' : 'images'}/`;

      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

      const fullPath = `${dirPath}${filename}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      if (!fileInfo.exists) {
        Alert.alert('Downloading', 'Downloading file...');
        const downloadResult = await FileSystem.downloadAsync(resolvedFileUrl, fullPath);
        return downloadResult.uri;
      }
      return fullPath;
    }

    const fileInfo = await FileSystem.getInfoAsync(resolvedFileUrl);
    if (!fileInfo.exists) {
      Alert.alert('Error', 'Local target file path does not exist.');
      return null;
    }
    return resolvedFileUrl;
  };

  // Shares the actual attached file (PDF/image), not the AI summary.
  const handleShareFile = async () => {
    if (!resolvedFileUrl) {
      Alert.alert('Error', 'No file is attached to this note.');
      return;
    }
    try {
      const localUri = await ensureLocalFileUri();
      if (!localUri) return;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share file: ' + error.message);
    }
  };

  // Saves the actual attached file (PDF/image) to device storage, not the AI summary.
  const handleDownloadFile = async () => {
    if (!resolvedFileUrl) {
      Alert.alert('Error', 'No file is attached to this note.');
      return;
    }
    try {
      const localUri = await ensureLocalFileUri();
      if (!localUri) return;

      const filename = localUri.substring(localUri.lastIndexOf('/') + 1).split('?')[0]
        || `${note.title.toLowerCase().replace(/\s+/g, '_')}.${note.type === 'document' ? 'pdf' : 'jpg'}`;
      const mimeType = note.type === 'document' ? 'application/pdf' : 'image/jpeg';

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          // User backed out of the folder picker to cancel — not an error, just stop here.
          return;
        }

        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          mimeType
        );
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        Alert.alert('Downloaded', 'File saved to the selected folder.');
      } else {
        // iOS: no public writable "Downloads" — share sheet's "Save to Files" is the platform-correct save path.
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to download file: ' + error.message);
    }
  };

  // Opens the file in the device's system viewer. Handles remote files by downloading them first.
  const handleOpenFile = async () => {
    if (!resolvedFileUrl) {
      Alert.alert('Error', 'No file URI associated with this note.');
      return;
    }

    try {
      const localUri = await ensureLocalFileUri();
      if (!localUri) return;

      // Launch default system viewer
      if (Platform.OS === 'android') {
        const cUri = await FileSystem.getContentUriAsync(localUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: cUri,
          flags: 1, // Grant read permission
          type: note.type === 'document' ? 'application/pdf' : 'image/*',
        });
      } else {
        // iOS Fallback: Open with sharing controller (which has "Quick Look" viewer built-in)
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Alert.alert('Error', 'Sharing / viewing is not available on this device.');
        }
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Could not open file: ' + error.message);
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
          style={styles.headerIconBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Pin toggle */}
          <TouchableOpacity
            onPress={handlePinToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
          >
            <Text style={[styles.headerIconText, pinned && styles.headerIconActive]}>
              {pinned ? '📌' : '📍'}
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            onPress={handleShareFile}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
          >
            <Text style={styles.headerIconText}>📤</Text>
          </TouchableOpacity>

          {/* Download */}
          <TouchableOpacity
            onPress={handleDownloadFile}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
          >
            <Text style={styles.headerIconText}>📥 </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title — tapping the pencil opens rename modal */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{noteTitle}</Text>
          <TouchableOpacity
            onPress={handleOpenRename}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.titleEditBtn}
          >
            <Text style={styles.titleEditIcon}>✏️</Text>
          </TouchableOpacity>
        </View>

        {/* Original Note card */}
        <View style={styles.card}>
          <View style={styles.fileRow}>
            <View style={note.type === 'document' ? styles.fileIconCircle : styles.fileIconCircleImage}>
              {note.type === 'document' ? (
                <Text style={styles.fileIcon}>📄</Text>
              ) : (
                <Text style={styles.fileIcon}>📝</Text>
              )}
            </View>

            <View style={styles.fileInfo}>
              <Text style={styles.fileLabel}>Original Note</Text>
              <Text style={styles.fileName}>
                {noteTitle.toLowerCase().replace(/\s+/g, '_')}.
                {note.type === 'document' ? 'pdf' : 'jpg'}
              </Text>
            </View>

            <TouchableOpacity onPress={handleOpenFile} style={styles.openFileBtn}>
              <Text style={styles.openFileIcon}>↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Show a visual preview if the note is an image. */}
        {note.type === 'image' && resolvedFileUrl && (
          <View style={styles.imagePreviewCard}>
            <Image
              source={{ uri: resolvedFileUrl }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          </View>
        )}

        {/* AI Summary card */}
        <View style={styles.card}>
          <View style={styles.summaryHeaderRow}>
            <View style={styles.summaryIconCircle}>
              <Text style={styles.summaryIconText}>✦</Text>
            </View>
            <Text style={styles.summaryTitle}>AI Summary</Text>
          </View>

          {summarized && summary ? (
            <>
              <View style={styles.summaryBody}>
                <SummaryContent text={summary} colors={colors} />
              </View>

              <View style={styles.summaryActionsRow}>
                <TouchableOpacity
                  style={styles.summaryActionButton}
                  onPress={handleShareSummary}
                  activeOpacity={0.7}
                >
                  <Text style={styles.summaryActionButtonText}>Share Summary</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.summaryActionButton}
                  onPress={handleDownloadSummary}
                  activeOpacity={0.7}
                >
                  <Text style={styles.summaryActionButtonText}>Download Summary</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, styles.quizButton]}
                onPress={() => navigation.navigate('Quiz', { title: noteTitle, summary })}
                activeOpacity={0.8}
              >
                <Text style={styles.quizButtonText}>Generate Quiz</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, summarizing && styles.actionButtonDisabled]}
                onPress={handleResummarize}
                disabled={summarizing}
                activeOpacity={0.8}
              >
                {summarizing ? (
                  <ActivityIndicator color={colors.textSecondary} size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>Resummarize</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.notSummarizedText}>
                No summary yet. Tap below to generate an AI summary for this{' '}
                {note.type === 'document' ? 'document' : 'image'}.
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, summarizing && styles.actionButtonDisabled]}
                onPress={() => handleSummarize()}
                disabled={summarizing}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>
                  {summarizing ? 'Summarizing...' : 'Summarize'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Rename modal*/}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.renameOverlay}
        >
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename Note</Text>
            <Text style={styles.renameSubtitle}>Enter a new name for this note.</Text>

            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Note name"
              placeholderTextColor={colors.placeholder}
              autoFocus
              selectTextOnFocus
              maxLength={80}
            />

            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={() => setRenameModalVisible(false)}
                disabled={renaming}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.renameConfirmBtn}
                onPress={handleConfirmRename}
                disabled={renaming}
              >
                {renaming ? (
                  <ActivityIndicator color={colors.primaryButtonText} size="small" />
                ) : (
                  <Text style={styles.renameConfirmText}>Save</Text>
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerIconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { fontSize: 22, color: colors.text, fontWeight: '600' },
  headerIconText: { fontSize: 20, color: colors.textSecondary },
  headerIconActive: { color: '#7C3AED' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  titleEditBtn: { paddingTop: 2 },
  titleEditIcon: { fontSize: 18 },
  // Rename modal
  renameOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  renameCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  renameTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
  renameSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 18 },
  renameInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: colors.text, backgroundColor: colors.inputBackground, marginBottom: 20,
  },
  renameActions: { flexDirection: 'row', gap: 12 },
  renameCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.border, alignItems: 'center',
  },
  renameCancelText: { fontSize: 15, fontWeight: '700', color: colors.text },
  renameConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.primaryButton, alignItems: 'center',
  },
  renameConfirmText: { fontSize: 15, fontWeight: '700', color: colors.primaryButtonText },
  card: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, gap: 14,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIconCircle: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.header,
    justifyContent: 'center', alignItems: 'center',
  },
   fileIconCircleImage: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  fileIcon: { fontSize: 24 },
  fileInfo: { flex: 1 },
  fileLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  fileName: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  openFileBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  openFileIcon: { fontSize: 16, color: colors.header, fontWeight: '700' },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIconCircle: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.header,
    justifyContent: 'center', alignItems: 'center',
  },
  summaryIconText: { fontSize: 16, color: colors.headerText, fontWeight: '700' },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  summaryBody: { gap: 4 },
  notSummarizedText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  actionButton: {
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.header,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: 15, fontWeight: '700', color: colors.header },
  quizButton: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  quizButtonText: { fontSize: 15, fontWeight: '700', color: colors.primaryButtonText },
  imagePreviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  imagePreview: {
    width: '100%',
    height: 240,
    borderRadius: 8,
  },
  summaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  summaryActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

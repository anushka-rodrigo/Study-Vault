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
} from 'react-native';

import { togglePinNoteInDb, saveNoteSummary, Note } from '../services/noteService';

type Props = {
  navigation: any;
  route: {
    params: {
      note: Note;
      onPinToggle: (pinned: boolean) => void;
    };
  };
};

function SummaryContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        if (line.trim() === '') return <View key={i} style={{ height: 6 }} />;

        if (line.trim().startsWith('•')) {
          return (
            <View key={i} style={summaryStyles.bulletRow}>
              <Text style={summaryStyles.bullet}>•</Text>
              <Text style={summaryStyles.bulletText}>{line.trim().replace(/^•\s*/, '')}</Text>
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

const summaryStyles = StyleSheet.create({
  paragraph: { fontSize: 14, color: '#374151', lineHeight: 22 },
  bold: { fontWeight: '700', color: '#111827' },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { fontSize: 14, color: '#374151', lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
});

export default function DbNoteDetailScreen({ navigation, route }: Props) {
  const { note, onPinToggle } = route.params;
  const [pinned, setPinned] = useState(note.pinned);
  const [summarized, setSummarized] = useState(note.summarized);
  const [summary, setSummary] = useState(note.summary ?? '');
  const [summarizing, setSummarizing] = useState(false);

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

  // Perform AI Summarization and persist the summary in Firestore
  const handleSummarize = () => {
    setSummarizing(true);

    setTimeout(async () => {
      const generatedSummary =
        'This document covers key concepts relevant to the subject matter.\n\n' +
        '**Key Topics:**\n' +
        '• Core principles and definitions\n' +
        '• Important theorems and applications\n' +
        '• Summary of key findings\n\n' +
        '**Note:** Connect this button to your AI summarization service in Firebase.';

      try {
        await saveNoteSummary(note.id, generatedSummary);
        setSummary(generatedSummary);
        setSummarized(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to save summary to database.');
      } finally {
        setSummarizing(false);
      }
    }, 1500);
  };

  const handleResummarize = () => {
    Alert.alert('Resummarize', 'Regenerate AI summary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resummarize',
        onPress: () => {
          setSummarized(false);
          setSummary('');
          handleSummarize();
        },
      },
    ]);
  };

  const handleShare = () => Alert.alert('Share', 'Share functionality coming soon.');
  const handleDownload = () => Alert.alert('Download', 'Download functionality coming soon.');
  const handleOpenFile = () => Alert.alert('Open File', 'Open full file viewer coming soon.');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
            onPress={handleShare}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
          >
            <Text style={styles.headerIconText}>⎋</Text>
          </TouchableOpacity>

          {/* Download */}
          <TouchableOpacity
            onPress={handleDownload}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
          >
            <Text style={styles.headerIconText}>⬇</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>{note.title}</Text>

        {/* Original Note card */}
        <View style={styles.card}>
          <View style={styles.fileRow}>
            <View style={styles.fileIconCircle}>
              {note.type === 'document' ? (
                <Image
                  source={require('../assets/icons/pdf-icon.jpg')}
                  style={styles.fileIconImg}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={require('../assets/icons/image-icon.jpg')}
                  style={styles.fileIconImg}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={styles.fileInfo}>
              <Text style={styles.fileLabel}>Original Note</Text>
              <Text style={styles.fileName}>
                {note.title.toLowerCase().replace(/\s+/g, '_')}.
                {note.type === 'document' ? 'pdf' : 'jpg'}
              </Text>
            </View>

            <TouchableOpacity onPress={handleOpenFile} style={styles.openFileBtn}>
              <Text style={styles.openFileIcon}>↗</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                <SummaryContent text={summary} />
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleResummarize}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>Resummarize</Text>
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
                onPress={handleSummarize}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerIconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { fontSize: 22, color: '#374151', fontWeight: '600' },
  headerIconText: { fontSize: 20, color: '#6B7280' },
  headerIconActive: { color: '#7C3AED' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48, gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, gap: 14,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIconCircle: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  fileIconImg: { width: 28, height: 28 },
  fileInfo: { flex: 1 },
  fileLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  fileName: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  openFileBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  openFileIcon: { fontSize: 16, color: '#2563EB', fontWeight: '700' },
  summaryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIconCircle: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  summaryIconText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  summaryBody: { gap: 4 },
  notSummarizedText: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
  actionButton: {
    borderRadius: 12, borderWidth: 1.5, borderColor: '#2563EB',
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: 15, fontWeight: '700', color: '#2563EB' },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { generateQuiz } from '../services/quizService';

import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/colors';

type Props = {
  navigation: any;
  route: {
    params: {
      title: string;
      summary: string; // the note's stored summary (JSON string or legacy text)
    };
  };
};

export default function QuizScreen({ navigation, route }: Props) {
  const { colors, mode } = useTheme();
  const styles = getStyles(colors);

  const { title, summary } = route.params;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState('');

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await generateQuiz(summary, title);
      if (!result.success || !result.questions) {
        const message = result.error || 'Failed to generate quiz.';
        setError(message);
        setQuestions([]);
        Alert.alert('Quiz Generation Failed', message);
      } else {
        setQuestions(result.questions);
      }
    } catch (e: any) {
      const message = e.message || 'Something went wrong while generating the quiz.';
      setError(message);
      Alert.alert('Quiz Generation Failed', message);
    } finally {
      setLoading(false);
    }
  }, [summary, title]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleRegenerate = () => {
    Alert.alert('New Quiz', 'Generate a fresh set of questions?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Generate', onPress: loadQuiz },
    ]);
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

        <Text style={styles.headerTitle} numberOfLines={1}>Quiz</Text>

        <TouchableOpacity
          onPress={handleRegenerate}
          disabled={loading}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerIconBtn}
        >
          <Text style={[styles.headerIconText, loading && { opacity: 0.4 }]}>⟳</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle} numberOfLines={2}>{title}</Text>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.header} />
            <Text style={styles.loadingText}>Generating quiz questions...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadQuiz} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            {questions.map((q, i) => (
              <View key={i} style={styles.questionRow}>
                <Text style={styles.questionNumber}>{i + 1}.</Text>
                <Text style={styles.questionText}>{q}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  backArrow: { fontSize: 22, color: colors.text, fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
  headerIconText: { fontSize: 20, color: colors.header, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48, gap: 14 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, gap: 16,
  },
  questionRow: { flexDirection: 'row', gap: 8 },
  questionNumber: { fontSize: 15, fontWeight: '800', color: colors.header, width: 28, flexShrink: 0 },
  questionText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 14 },
  loadingText: { fontSize: 14, color: colors.textSecondary },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center', paddingHorizontal: 20 },
  retryButton: {
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.header,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  retryButtonText: { fontSize: 14, fontWeight: '700', color: colors.header },
});

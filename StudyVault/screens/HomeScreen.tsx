import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator, // Added ActivityIndicator to show a loading spinner
} from 'react-native';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  fetchNotes,
  addNote,
  deleteNoteFromDb,
  togglePinNoteInDb,
  Note
} from '../services/noteService';

type Props = {
  navigation: any;
};

export default function DbHomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'group'>('list');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoadingNotes(true);
        fetchNotes(user.uid)
          .then((fetchedNotes) => {
            setNotes(fetchedNotes);
          })
          .catch((error) => {
            Alert.alert('Database Error', 'Could not load your notes. Please check connection.');
            console.error(error);
          })
          .finally(() => {
            setLoadingNotes(false);
          });
      } else {
        navigation.replace('Login');
      }
    });

    return unsubscribe;
  }, [navigation]);

  const handlePinToggle = async (id: string, pinned: boolean) => {
    try {
      await togglePinNoteInDb(id, pinned);
      setNotes(prev => prev.map(n => (n.id === id ? { ...n, pinned } : n)));
    } catch (error) {
      Alert.alert('Error', 'Failed to update pin status in Firestore.');
    }
  };

  const deleteNote = (id: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNoteFromDb(id);
            setNotes(prev => prev.filter(n => n.id !== id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete note from database.');
          }
        },
      },
    ]);
  };

  const handleAddNote = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to add notes.');
      return;
    }

    Alert.alert(
      'New Note',
      'Select note format:',
      [
        {
          text: 'PDF Document',
          onPress: async () => {
            try {
              const newNote = await addNote(currentUser.uid, 'Introduction to Calculus', 'document');
              setNotes(prev => [newNote, ...prev]);
            } catch (error) {
              Alert.alert('Error', 'Failed to save note to Firestore.');
            }
          },
        },
        {
          text: 'Image Note',
          onPress: async () => {
            try {
              const newNote = await addNote(currentUser.uid, 'Physics Lab Report', 'image');
              setNotes(prev => [newNote, ...prev]);
            } catch (error) {
              Alert.alert('Error', 'Failed to save note to Firestore.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleProfile = () => {
    navigation.navigate('Profile');
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={styles.noteRow}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('NoteDetail', {
          note: item,
          onPinToggle: (pinned: boolean) => handlePinToggle(item.id, pinned),
        })
      }
    >
      <View style={[styles.fileIconWrapper, item.type === 'image' && styles.fileIconWrapperImage]}>
        {item.type === 'document' ? (
          <Image
            source={require('../assets/icons/pdf-icon.jpg')}
            style={styles.fileIconImage}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={require('../assets/icons/image-icon.jpg')}
            style={styles.fileIconImage}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={styles.noteInfo}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        <Text style={styles.noteDate}>{item.date}</Text>
      </View>

      <View style={styles.noteActions}>
        {item.pinned && <Text style={styles.pinIcon}>📌</Text>}
        <TouchableOpacity
          onPress={() => deleteNote(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={require('../assets/icons/delete-icon.png')}
            style={styles.deleteIconImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderGroupView = () => (
    <View style={styles.groupContainer}>
      <Text style={styles.groupEmptyText}>Group View coming soon...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>StudyVault</Text>
        <TouchableOpacity style={styles.profileButton} onPress={handleProfile}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.tabActive]}
            onPress={() => setActiveTab('list')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
              List View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'group' && styles.tabActive]}
            onPress={() => setActiveTab('group')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'group' && styles.tabTextActive]}>
              Group View
            </Text>
          </TouchableOpacity>
        </View>

        {loadingNotes ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : activeTab === 'list' ? (
          <FlatList
            data={sortedNotes}
            keyExtractor={item => item.id}
            renderItem={renderNote}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          renderGroupView()
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={handleAddNote} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2563EB' },
  header: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20, paddingVertical: 16,
    paddingTop: (StatusBar.currentHeight || 24) + 10,// Add extra top padding to account for status bar height
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  profileButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileIcon: { fontSize: 20 },
  body: { flex: 1, backgroundColor: '#F1F5FB' },
  tabContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 12, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  separator: { height: 1, backgroundColor: '#E5E7EB', marginLeft: 72 },
  noteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 12,
  },
  fileIconWrapper: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  fileIconWrapperImage: { backgroundColor: '#FDF4FF' },
  fileIconImage: { width: 26, height: 26 },
  noteInfo: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  noteDate: { fontSize: 12, color: '#6B7280', fontWeight: '400' },
  noteActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinIcon: { fontSize: 18 },
  deleteIconImage: { width: 20, height: 20 },
  groupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  groupEmptyText: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 28, color: '#FFFFFF', fontWeight: '400', lineHeight: 32 },
});

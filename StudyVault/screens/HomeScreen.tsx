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
  TextInput,
  Modal,
} from 'react-native';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  fetchNotes,
  addNote,
  deleteNoteFromDb,
  togglePinNoteInDb,
  searchNotesByTitle,
  Note
} from '../services/noteService';

import {
  Folder,
  fetchFolders,
  createFolder,
  deleteFolderFromDb,
  removeNoteFromFolderInDb,
  searchFoldersByName,
} from '../services/folderService';

type Props = {
  navigation: any;
};

export default function DbHomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'group'>('list');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderName, setFolderName] = useState('');

  // Search queries: list view searches notes by title, group view searches folders by name.
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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

        // Fetch folders for the authenticated user.
        setLoadingFolders(true);
        fetchFolders(user.uid)
          .then((fetchedFolders) => {
            setFolders(fetchedFolders);
          })
          .catch((error) => {
            console.error('Error fetching folders:', error);
          })
          .finally(() => {
            setLoadingFolders(false);
          });
      } else {
        navigation.replace('Login');
      }
    });

    // Refresh note and folder list from database when screen comes back into focus.
    const unsubscribeFocus = navigation.addListener('focus', () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        fetchNotes(currentUser.uid)
          .then((fetchedNotes) => {
            setNotes(fetchedNotes);
          })
          .catch((error) => console.error(error));

        fetchFolders(currentUser.uid)
          .then((fetchedFolders) => {
            setFolders(fetchedFolders);
          })
          .catch((error) => console.error(error));
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFocus();
    };
  }, [navigation]);

  const handlePinToggle = async (id: string, pinned: boolean) => {
    try {
      await togglePinNoteInDb(id, pinned);
      setNotes(prev => prev.map(n => (n.id === id ? { ...n, pinned } : n)));
    } catch (error) {
      Alert.alert('Error', 'Failed to update pin status in Firestore.');
    }
  };

  // Updated deleteNote handler to accept and pass the storage filePath for dual deletion.
  const deleteNote = (id: string, filePath?: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
          await deleteNoteFromDb(id, filePath);

          // Remove this note's ID from every folder that references it in Firestore.
          const affectedFolders = folders.filter(f => f.noteIds.includes(id));
            await Promise.all(
              affectedFolders.map(f => removeNoteFromFolderInDb(f.id, id))
            );

            setNotes(prev => prev.filter(n => n.id !== id));
            setFolders(prev => prev.map(f => ({
              ...f,
              noteIds: f.noteIds.filter(noteId => noteId !== id),
            })));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete note from database.');
          }
        },
      },
    ]);
  };

  // Modified handleAddNote to navigate to AddNoteScreen instead of showing mock alerts.
  const handleAddNote = () => {
    navigation.navigate('AddNote');
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    Alert.alert('Delete Folder', `Are you sure you want to delete "${folderName}"? Notes inside will not be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFolderFromDb(folderId);
            setFolders(prev => prev.filter(f => f.id !== folderId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete folder.');
          }
        },
      },
    ]);
  };

  const handleProfile = () => {
    navigation.navigate('Profile');
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  // Filter the (already sorted) notes by title using the search service function.
  const displayedNotes = searchNotesByTitle(sortedNotes, noteSearchQuery);

  // Filter folders by name using the search service function.
  const displayedFolders = searchFoldersByName(folders, folderSearchQuery);



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
          onPress={() => deleteNote(item.id, item.filePath)}
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

  // Added folder creation dialog for basic file organization.
  const handleAddFolder = () => {
    setFolderName('');
    setFolderModalVisible(true);
  };

  const handleCreateFolder = async () => {
  const trimmedName = folderName.trim();
  if (!trimmedName) return;
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const isDuplicate = folders.some(
    f => f.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    Alert.alert('Duplicate Folder', 'A folder with this name already exists. Please choose a different name.');
    return;
  }

  try {
    const newFolder = await createFolder(currentUser.uid, trimmedName);
    setFolders(prev => [...prev, newFolder]);
    setFolderModalVisible(false);
  } catch (error) {
    Alert.alert('Error', 'Failed to create folder.');
  }
};

  // Added real Group View containing a list of folders fetched from Firestore.
  const renderGroupView = () => (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
      <TouchableOpacity
        style={{
          backgroundColor: '#2563EB', padding: 12, borderRadius: 10,
          alignItems: 'center', marginBottom: 16
        }}
        onPress={handleAddFolder}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>+ Create Folder</Text>
      </TouchableOpacity>
      {folders.length > 0 && (
        <View style={styles.groupSearchBoxWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search folders by name"
            placeholderTextColor="#9CA3AF"
            value={folderSearchQuery}
            onChangeText={setFolderSearchQuery}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {folderSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setFolderSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.searchClearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loadingFolders ? (
        <ActivityIndicator size="small" color="#2563EB" />
      ) : folders.length === 0 ? (
        <View style={styles.groupContainer}>
          <Text style={styles.groupEmptyText}>No folders created yet.</Text>
        </View>
      ) : displayedFolders.length === 0 ? (
        <View style={styles.groupContainer}>
          <Text style={styles.groupEmptyText}>No folders match "{folderSearchQuery}".</Text>
        </View>
      ) : (
        <FlatList
          data={displayedFolders}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{
                backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8, elevation: 1
              }}
              onPress={() => navigation.navigate('FolderDetail', {
                folder: item,
                allNotes: notes,
                allFolders: folders,
                onUpdate: (updatedFolder: Folder) => {
                  setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
                }
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>📁</Text>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{item.noteIds.length} notes</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  onPress={() => handleDeleteFolder(item.id, item.name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Image
                    source={require('../assets/icons/delete-icon.png')}
                    style={styles.deleteIconImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <Text style={{ color: '#6B7280' }}>→</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
          <View style={{ flex: 1 }}>
            {notes.length > 0 && (
              <View style={styles.searchBoxWrapper}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  placeholder="Search files by name"
                  placeholderTextColor="#9CA3AF"
                  value={noteSearchQuery}
                  onChangeText={setNoteSearchQuery}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {noteSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setNoteSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.searchClearIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {displayedNotes.length === 0 ? (
              <View style={styles.groupContainer}>
                <Text style={styles.groupEmptyText}>
                  {notes.length === 0 ? 'No notes yet.' : `No files match "${noteSearchQuery}".`}
                </Text>
              </View>
            ) : (
              <FlatList
                data={displayedNotes}
                keyExtractor={item => item.id}
                renderItem={renderNote}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </View>
        ) : (
          renderGroupView()
        )}
      </View>

      {activeTab === 'list' && (
        <TouchableOpacity style={styles.fab} onPress={handleAddNote} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={folderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32
        }}>
          <View style={{
            backgroundColor: '#FFFFFF', borderRadius: 16,
            padding: 24, width: '100%',
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>
              Create Folder
            </Text>
            <TextInput
              placeholder="Enter folder name"
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
              style={{
                borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 10,
                fontSize: 15, color: '#111827', marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center' }}
                onPress={() => setFolderModalVisible(false)}
              >
                <Text style={{ fontWeight: '700', color: '#374151' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' }}
                onPress={handleCreateFolder}
              >
                <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2563EB' },
  header: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20, paddingVertical: 16,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
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
  searchBoxWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 12,
    height: 42, borderWidth: 1, borderColor: '#E5E7EB',
  },
  groupSearchBoxWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 12,
    height: 42, borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  searchClearIcon: { fontSize: 14, color: '#9CA3AF', paddingHorizontal: 4 },
  groupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  groupEmptyText: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
  fab: {
    position: 'absolute', bottom: 55, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 28, color: '#FFFFFF', fontWeight: '400', lineHeight: 32 },


});

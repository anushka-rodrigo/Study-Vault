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
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';

import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { resolveFileUri } from '../services/fileStorageService';
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

// Import the theme hook and color type.
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/colors';

type Props = {
  navigation: any;
};

export default function DbHomeScreen({ navigation }: Props) {
  
  const { colors, mode } = useTheme();
  
  const styles = getStyles(colors);

  const [activeTab, setActiveTab] = useState<'list' | 'group'>('list');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(true);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderName, setFolderName] = useState('');

  // Search queries
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [profileImageUri, setProfileImageUri] = useState('');

  // Looks up the user's saved profile picture and resolves it to a URI that
  // still exists on this device, falling back to the default avatar icon.
  const loadProfileImage = async (userId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profileImagePath) {
          const resolvedUri = resolveFileUri(data.profileImagePath);
          const fileInfo = await FileSystem.getInfoAsync(resolvedUri);
          setProfileImageUri(fileInfo.exists ? resolvedUri : '');
        } else {
          setProfileImageUri('');
        }
      }
    } catch (error) {
      console.error('Error loading profile image:', error);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLoadingNotes(true);
        loadProfileImage(user.uid);
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
        loadProfileImage(currentUser.uid);
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

  // Modified handleAddNote to navigate to AddNoteScreen.
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

  // Filter the notes.
  const displayedNotes = searchNotesByTitle(sortedNotes, noteSearchQuery);

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
      <View style={item.type === 'document' ? styles.fileIconWrapper : styles.fileIconWrapperImage}>
        {item.type === 'document' ? (
          <Text style={styles.fileIcon}>📄</Text>
        ) : (
          <Text style={styles.fileIcon}>📝</Text>
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
          <Text style={styles.deleteIcon}>❌</Text>
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
    <View style={styles.groupViewContainer}>
      <TouchableOpacity
        style={styles.createFolderBtn}
        onPress={handleAddFolder}
      >
        <Text style={styles.createFolderBtnText}>+ Create Folder</Text>
      </TouchableOpacity>
      {folders.length > 0 && (
        <View style={styles.groupSearchBoxWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search folders by name"
            placeholderTextColor={colors.placeholder}
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
        <ActivityIndicator size="small" color={colors.header} />
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
              style={styles.folderRow}
              onPress={() => navigation.navigate('FolderDetail', {
                folder: item,
                allNotes: notes,
                allFolders: folders,
                onUpdate: (updatedFolder: Folder) => {
                  setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
                },
                onNotePinToggle: handlePinToggle,
              })}
            >
              <View style={styles.folderRowLeft}>
                <Text style={styles.folderEmoji}>📁</Text>
                <View>
                  <Text style={styles.folderName}>{item.name}</Text>
                  <Text style={styles.folderMeta}>{item.noteIds.length} notes</Text>
                </View>
              </View>
              <View style={styles.folderRowRight}>
                <TouchableOpacity
                  onPress={() => handleDeleteFolder(item.id, item.name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteIcon}>❌</Text>
                </TouchableOpacity>
                <Text style={styles.folderChevron}>→</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>StudyVault</Text>
        <TouchableOpacity style={styles.profileButton} onPress={handleProfile}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
          ) : (
            <Text style={styles.profileIcon}>👤</Text>
          )}
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
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={colors.header} />
          </View>
        ) : activeTab === 'list' ? (
          <View style={{ flex: 1 }}>
            {notes.length > 0 && (
              <View style={styles.searchBoxWrapper}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  placeholder="Search files by name"
                  placeholderTextColor={colors.placeholder}
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
        {/* Inline JSX styles */}
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalCardTitle}>
              Create Folder
            </Text>
            <TextInput
              placeholder="Enter folder name"
              placeholderTextColor={colors.placeholder}
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFolderModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreateBtn}
                onPress={handleCreateFolder}
              >
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.header },
  header: {
    backgroundColor: colors.header,
    paddingHorizontal: 20, paddingVertical: 16,
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.headerText, letterSpacing: 0.3 },
  profileButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  profileIcon: { fontSize: 20 },
  profileImage: { width: 40, height: 40, borderRadius: 20 },
  body: { flex: 1, backgroundColor: colors.background },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: {
    flexDirection: 'row', backgroundColor: colors.surface,
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    borderRadius: 12, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabActive: {
    backgroundColor: colors.header,
    shadowColor: colors.header, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.headerText },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
  noteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 12,
  },
  fileIconWrapper: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: colors.header,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  fileIconWrapperImage: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },

  fileIcon: { fontSize: 24},
  noteInfo: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  noteDate: { fontSize: 12, color: colors.textSecondary, fontWeight: '400' },
  noteActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinIcon: { fontSize: 18 },
  deleteIcon: { fontSize: 15 },
  searchBoxWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBackground, borderRadius: 10,
    paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 12,
    height: 42, borderWidth: 1, borderColor: colors.border,
  },
  groupSearchBoxWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBackground, borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 12,
    height: 42, borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  searchClearIcon: { fontSize: 14, color: colors.placeholder, paddingHorizontal: 4 },
  groupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  groupEmptyText: { fontSize: 16, color: colors.placeholder, fontWeight: '500' },
  fab: {
    position: 'absolute', bottom: 55, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryButton,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primaryButton, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 28, color: colors.primaryButtonText, fontWeight: '400', lineHeight: 32 },

  // Group View
  groupViewContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  createFolderBtn: {
    backgroundColor: colors.primaryButton, padding: 12, borderRadius: 10,
    alignItems: 'center', marginBottom: 16,
  },
  createFolderBtnText: { color: colors.primaryButtonText, fontWeight: '700' },
  folderRow: {
    backgroundColor: colors.surface, padding: 16, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, elevation: 1,
  },
  folderRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  folderRowRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  folderEmoji: { fontSize: 24 },
  folderName: { fontSize: 16, fontWeight: '700', color: colors.text },
  folderMeta: { fontSize: 12, color: colors.textSecondary },
  folderChevron: { color: colors.textSecondary },

  // Create Folder modal 
  modalOverlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 24, width: '100%',
  },
  modalCardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: colors.text, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center',
  },
  modalCancelText: { fontWeight: '700', color: colors.text },
  modalCreateBtn: {
    flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.primaryButton, alignItems: 'center',
  },
  modalCreateText: { fontWeight: '700', color: colors.primaryButtonText },
});

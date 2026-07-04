import React, { useState } from 'react';
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
  Modal,
  TextInput,
} from 'react-native';

import { addNoteToFolderInDb, removeNoteFromFolderInDb, renameFolderInDb } from '../services/folderService';
import { Note } from '../services/noteService';

type Folder = {
  id: string;
  name: string;
  noteIds: string[];
};

type Props = {
  navigation: any;
  route: {
    params: {
      folder: Folder;
      allNotes: Note[];
      allFolders?: Folder[];
      onUpdate: (updated: Folder) => void;
      onNotePinToggle?: (noteId: string, pinned: boolean) => void;
    };
  };
};

export default function FolderDetailScreen({ navigation, route }: Props) {
  const { onUpdate, allFolders = [], onNotePinToggle } = route.params;
  const [folder, setFolder] = useState<Folder>(route.params.folder);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Local copy of notes so pin-status changes made from NoteDetailScreen
  // reflect immediately here without needing a full refetch.
  const [allNotes, setAllNotes] = useState<Note[]>(route.params.allNotes);

  // Rename state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const folderNotes = allNotes.filter(n => folder.noteIds.includes(n.id));

  const availableNotes = allNotes.filter(n => !folder.noteIds.includes(n.id));

  const updateFolder = (updated: Folder) => {
    setFolder(updated);
    onUpdate(updated);
  };

  // Updates the pinned flag locally and forwards the change up to HomeScreen
  // (if a callback was provided) so List View stays in sync too.
  const handlePinToggle = (noteId: string, pinned: boolean) => {
    setAllNotes(prev => prev.map(n => (n.id === noteId ? { ...n, pinned } : n)));
    if (onNotePinToggle) {
      onNotePinToggle(noteId, pinned);
    }
  };

  // Opens the rename modal pre-filled with the current folder name.
  const handleOpenRename = () => {
    setRenameValue(folder.name);
    setRenameModalVisible(true);
  };

  const handleConfirmRename = async () => {
    const trimmed = renameValue.trim();

    if (!trimmed) {
      Alert.alert('Invalid Name', 'Folder name cannot be empty.');
      return;
    }

    if (trimmed === folder.name) {
      setRenameModalVisible(false);
      return;
    }

    const isDuplicate = allFolders.some(
      f => f.id !== folder.id && f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      Alert.alert('Duplicate Folder', 'A folder with this name already exists. Please choose a different name.');
      return;
    }

    setRenaming(true);
    try {
      await renameFolderInDb(folder.id, trimmed);
      const updated = { ...folder, name: trimmed };
      updateFolder(updated);
      setRenameModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to rename folder.');
    } finally {
      setRenaming(false);
    }
  };

  const removeNoteFromFolder = (noteId: string) => {
    Alert.alert('Remove Note', 'Remove this note from the folder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await removeNoteFromFolderInDb(folder.id, noteId);
            const updated = { ...folder, noteIds: folder.noteIds.filter(id => id !== noteId) };
            updateFolder(updated);
          } catch (error) {
            Alert.alert('Error', 'Failed to remove note from folder in database.');
          }
        },
      },
    ]);
  };

  const addNoteToFolder = async (noteId: string) => {
    try {
      await addNoteToFolderInDb(folder.id, noteId);
      const updated = { ...folder, noteIds: [...folder.noteIds, noteId] };
      updateFolder(updated);
    } catch (error) {
      Alert.alert('Error', 'Failed to add note to folder in database.');
    }
  };

  const renderFolderNote = ({ item }: { item: Note }) => (
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
          <Image source={require('../assets/icons/pdf-icon.jpg')} style={styles.fileIconImage} resizeMode="contain" />
        ) : (
          <Image source={require('../assets/icons/image-icon.jpg')} style={styles.fileIconImage} resizeMode="contain" />
        )}
      </View>
      <View style={styles.noteInfo}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        <Text style={styles.noteDate}>{item.date}</Text>
      </View>
      <View style={styles.noteActions}>
        {item.pinned && <Text style={styles.pinIcon}>📌</Text>}
        <TouchableOpacity
          onPress={() => removeNoteFromFolder(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image source={require('../assets/icons/delete-icon.png')} style={styles.deleteIconImage} resizeMode="contain" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderAvailableNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={styles.availableNoteRow}
      onPress={() => addNoteToFolder(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.fileIconWrapperSmall, item.type === 'image' && styles.fileIconWrapperImage]}>
        {item.type === 'document' ? (
          <Image source={require('../assets/icons/pdf-icon.jpg')} style={styles.fileIconImageSmall} resizeMode="contain" />
        ) : (
          <Image source={require('../assets/icons/image-icon.jpg')} style={styles.fileIconImageSmall} resizeMode="contain" />
        )}
      </View>
      <View style={styles.noteInfo}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        <Text style={styles.noteDate}>{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>StudyVault</Text>
        <TouchableOpacity style={styles.profileButton}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Tab bar (cosmetic, group view active) */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text style={styles.tabText}>List View</Text>
          </TouchableOpacity>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabTextActive}>Group View</Text>
          </View>
        </View>

        {/* Back link */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backText}>← Back to Folders</Text>
        </TouchableOpacity>

        {/* Folder title + Add Notes button */}
        <View style={styles.folderHeader}>
          <View style={styles.folderTitleRow}>
            <Text style={styles.folderTitle}>{folder.name}</Text>
            <TouchableOpacity
              onPress={handleOpenRename}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.renameIconBtn}
            >
              <Text style={styles.renameIcon}>✏️</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.addNotesBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.addNotesBtnText}>Add Notes</Text>
          </TouchableOpacity>
        </View>

        {/* Notes in folder */}
        <FlatList
          data={folderNotes}
          keyExtractor={item => item.id}
          renderItem={renderFolderNote}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>No notes in this folder yet. Tap "Add Notes" to add some.</Text>
          )}
        />
      </View>

      {/* Add Notes Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddModalVisible(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => { }}>
            <Text style={styles.modalTitle}>Add Notes to Folder</Text>

            {availableNotes.length === 0 ? (
              <Text style={styles.modalEmptyText}>All notes are already in this folder.</Text>
            ) : (
              <FlatList
                data={availableNotes}
                keyExtractor={item => item.id}
                renderItem={renderAvailableNote}
                style={styles.modalList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setAddModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Rename Folder Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename Folder</Text>
            <Text style={styles.renameSubtitle}>Enter a new name for this folder.</Text>
            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Folder name"
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
                <Text style={styles.renameConfirmText}>{renaming ? 'Saving...' : 'Save'}</Text>
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
    backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 16, paddingTop: (StatusBar.currentHeight || 24) + 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  profileButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  profileIcon: { fontSize: 20 },

  body: { flex: 1, backgroundColor: '#FFFFFF' },

  tabContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    borderRadius: 12, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  backRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  backText: { fontSize: 14, color: '#2563EB', fontWeight: '600' },

  folderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  folderTitleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 12 },
  folderTitle: { fontSize: 20, fontWeight: '800', color: '#111827', flexShrink: 1 },
  renameIconBtn: { marginLeft: 8, padding: 2 },
  renameIcon: { fontSize: 16 },
  addNotesBtn: {
    backgroundColor: '#2563EB', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addNotesBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  separator: { height: 1, backgroundColor: '#E5E7EB', marginLeft: 72 },

  noteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F4FF', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10,
  },
  fileIconWrapper: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  fileIconWrapperImage: { backgroundColor: '#EDE9FE' },
  fileIconImage: { width: 32, height: 32 },
  noteInfo: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  noteDate: { fontSize: 12, color: '#6B7280' },
  noteActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinIcon: { fontSize: 18 },
  deleteIconImage: { width: 26, height: 26 },

  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginTop: 32, paddingHorizontal: 24 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '75%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  modalList: { flexGrow: 0 },
  modalEmptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 20 },
  availableNoteRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  fileIconWrapperSmall: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  fileIconImageSmall: { width: 26, height: 26 },
  modalCloseBtn: {
    marginTop: 16, backgroundColor: '#E5E7EB', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  modalCloseBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },

  // Rename modal
  renameOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  renameCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%',
  },
  renameTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  renameSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 18 },
  renameInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 20,
  },
  renameActions: { flexDirection: 'row', gap: 12 },
  renameCancelBtn: {
    flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center',
  },
  renameCancelText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  renameConfirmBtn: {
    flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center',
  },
  renameConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
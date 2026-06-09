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
} from 'react-native';

type Note = {
  id: string;
  title: string;
  date: string;
  type: 'document' | 'image';
  pinned: boolean;
  summarized: boolean;
  summary?: string;
};

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
      onUpdate: (updated: Folder) => void;
    };
  };
};

export default function FolderDetailScreen({ navigation, route }: Props) {
  const { allNotes, onUpdate } = route.params;
  const [folder, setFolder] = useState<Folder>(route.params.folder);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Notes currently in this folder
  const folderNotes = allNotes.filter(n => folder.noteIds.includes(n.id));

  // Notes NOT yet in this folder (available to add)
  const availableNotes = allNotes.filter(n => !folder.noteIds.includes(n.id));

  const updateFolder = (updated: Folder) => {
    setFolder(updated);
    onUpdate(updated);
  };

  const removeNoteFromFolder = (noteId: string) => {
    Alert.alert('Remove Note', 'Remove this note from the folder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          const updated = { ...folder, noteIds: folder.noteIds.filter(id => id !== noteId) };
          updateFolder(updated);
        },
      },
    ]);
  };

  const addNoteToFolder = (noteId: string) => {
    const updated = { ...folder, noteIds: [...folder.noteIds, noteId] };
    updateFolder(updated);
  };

  const renderFolderNote = ({ item }: { item: Note }) => (
    <View style={styles.noteRow}>
      <View style={[styles.fileIconWrapper, item.type === 'image' && styles.fileIconWrapperImage]}>
        {item.type === 'document' ? (
          <Image source={require('../assets/icons/pdf-icon.png')} style={styles.fileIconImage} resizeMode="contain" />
        ) : (
          <Image source={require('../assets/icons/image-icon.png')} style={styles.fileIconImage} resizeMode="contain" />
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
    </View>
  );

  const renderAvailableNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={styles.availableNoteRow}
      onPress={() => addNoteToFolder(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.fileIconWrapperSmall, item.type === 'image' && styles.fileIconWrapperImage]}>
        {item.type === 'document' ? (
          <Image source={require('../assets/icons/pdf-icon.png')} style={styles.fileIconImageSmall} resizeMode="contain" />
        ) : (
          <Image source={require('../assets/icons/image-icon.png')} style={styles.fileIconImageSmall} resizeMode="contain" />
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

      {/* Header — same blue style as HomeScreen */}
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
          <Text style={styles.folderTitle}>{folder.name}</Text>
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
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2563EB' },
  header: {
    backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 16,
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
  folderTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
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
});
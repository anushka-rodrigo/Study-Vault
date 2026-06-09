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
  TextInput,
  Modal,
} from 'react-native';

export type Note = {
  id: string;
  title: string;
  date: string;
  type: 'document' | 'image';
  pinned: boolean;
  summarized: boolean;
  summary?: string;
};

export type Folder = {
  id: string;
  name: string;
  noteIds: string[];
};

type Props = {
  navigation: any;
};

const initialFolders: Folder[] = [
  { id: 'f1', name: 'Mathematics', noteIds: ['1', '5'] },
  { id: 'f2', name: 'Science',     noteIds: ['3', '4', '6'] },
];

const initialNotes: Note[] = [
  {
    id: '1',
    title: 'Introduction to Calculus',
    date: 'May 8, 2026',
    type: 'document',
    pinned: true,
    summarized: true,
    summary:
      'This chapter introduces fundamental concepts of calculus including limits, derivatives, and integrals. The main focus is on understanding how functions behave as they approach specific values.\n\n**Key Topics:**\n• Definition and properties of limits\n• The derivative as rate of change\n• Fundamental theorem of calculus\n• Chain rule and product rule applications\n• Integration techniques and u-substitution\n\n**Important Formulas:** The derivative of x^n is nx^(n-1), and the integral of x^n is x^(n+1)/(n+1) + C.',
  },
  {
    id: '2',
    title: 'World History - Chapter 5',
    date: 'May 6, 2026',
    type: 'document',
    pinned: true,
    summarized: true,
    summary:
      'Chapter 5 covers the major events of the early 20th century including World War I causes, the rise of nationalism, and the political aftermath of the Treaty of Versailles.',
  },
  { id: '3', title: 'Organic Chemistry Notes',     date: 'May 7, 2026', type: 'image',    pinned: false, summarized: false },
  { id: '4', title: 'Physics Lab Report',          date: 'May 5, 2026', type: 'image',    pinned: false, summarized: false },
  { id: '5', title: 'Computer Science Algorithms', date: 'May 3, 2026', type: 'document', pinned: false, summarized: false },
  { id: '6', title: 'Biology Cell Structure',      date: 'May 2, 2026', type: 'document', pinned: false, summarized: false },
];

export default function HomeScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'list' | 'group'>('list');
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');  

  const handlePinToggle = (id: string, pinned: boolean) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, pinned } : n)));
  };

  const deleteNote = (id: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setNotes(prev => prev.filter(n => n.id !== id)),
      },
    ]);
  };

  const handleAddNote = () => {
    navigation.navigate('AddNote');
  };

  const createFolder = () => {
  const name = newFolderName.trim();
  if (!name) { Alert.alert('Error', 'Please enter a folder name.'); return; }
  const newFolder: Folder = { id: Date.now().toString(), name, noteIds: [] };
  setFolders(prev => [...prev, newFolder]);
  setNewFolderName('');
  setCreateModalVisible(false);
};

const deleteFolder = (id: string) => {
  Alert.alert('Delete Folder', 'Delete this folder? Notes inside will not be deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => setFolders(prev => prev.filter(f => f.id !== id)) },
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
            source={require('../assets/icons/pdf-icon.png')}
            style={styles.fileIconImage}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={require('../assets/icons/image-icon.png')}
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

const renderFolder = ({ item }: { item: Folder }) => (
  <TouchableOpacity
    style={styles.folderRow}
    activeOpacity={0.75}
    onPress={() => navigation.navigate('FolderDetail', {
      folder: item,
      allNotes: notes,
      onUpdate: (updated: Folder) => setFolders(prev => prev.map(f => f.id === updated.id ? updated : f)),
    })}
  >
    <View style={styles.folderIconWrapper}>
      <Text style={styles.folderIconEmoji}>📁</Text>
    </View>
    <View style={styles.folderInfo}>
      <Text style={styles.folderName}>{item.name}</Text>
      <Text style={styles.folderCount}>{item.noteIds.length} {item.noteIds.length === 1 ? 'file' : 'files'}</Text>
    </View>
    <TouchableOpacity onPress={() => deleteFolder(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Image source={require('../assets/icons/delete-icon.png')} style={styles.deleteIconImage} resizeMode="contain" />
    </TouchableOpacity>
  </TouchableOpacity>
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

        {activeTab === 'list' ? (
          <FlatList
            data={sortedNotes}
            keyExtractor={item => item.id}
            renderItem={renderNote}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <FlatList
            data={folders}
            keyExtractor={item => item.id}
            renderItem={renderFolder}
            contentContainerStyle={styles.groupContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={() => (
              <TouchableOpacity style={styles.createFolderBtn} onPress={() => setCreateModalVisible(true)} activeOpacity={0.7}>
                <Text style={styles.createFolderIcon}>＋</Text>
                <Text style={styles.createFolderText}>Create Folder</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {activeTab === 'list' && (
        <TouchableOpacity style={styles.fab} onPress={handleAddNote} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCreateModalVisible(false)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.modalTitle}>Create New Folder</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Folder name"
              placeholderTextColor="#9CA3AF"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createFolder}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setCreateModalVisible(false); setNewFolderName(''); }}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCreate]} onPress={createFolder}>
                <Text style={styles.modalBtnCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2563EB' },
  header: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20, paddingVertical: 16,
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
  fileIconImage: { width: 32, height: 32 },
  noteInfo: { flex: 1 },
  noteTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  noteDate: { fontSize: 12, color: '#6B7280', fontWeight: '400' },
  noteActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinIcon: { fontSize: 18 },
  deleteIconImage: { width: 26, height: 26 },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fabIcon: { fontSize: 28, color: '#FFFFFF', fontWeight: '400', lineHeight: 32 },

  // Group view
  groupContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  folderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEF2FF', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 12,
  },
  folderIconWrapper: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  folderIconEmoji: { fontSize: 24 },
  folderInfo: { flex: 1 },
  folderName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  folderCount: { fontSize: 12, color: '#6B7280' },
  createFolderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 4,
  },
  createFolderIcon: { fontSize: 18, color: '#6B7280' },
  createFolderText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#E5E7EB' },
  modalBtnCreate: { backgroundColor: '#93C5FD' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  modalBtnCreateText: { fontSize: 15, fontWeight: '700', color: '#1D4ED8' },
});
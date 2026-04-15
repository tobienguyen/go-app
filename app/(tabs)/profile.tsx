import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, ScrollView, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const POSITIONS = ['Setter', 'Libero', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Right Side', 'DS'];
const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [positions, setPositions] = useState<string[]>([]);
  const [experience, setExperience] = useState('Intermediate');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem('userProfile');
      if (saved) {
        const p = JSON.parse(saved);
        setName(p.name || '');
        setPhotoUri(p.photoUri || null);
        setPositions(p.positions || []);
        setExperience(p.experience || 'Intermediate');
      }
    } catch (_) {}
  };

  const saveProfile = async () => {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify({ name, photoUri, positions, experience }));
      setEditing(false);
    } catch (_) {
      Alert.alert('Error', 'Could not save profile.');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const togglePosition = (pos: string) => {
    setPositions(prev => {
      if (prev.includes(pos)) return prev.filter(p => p !== pos);
      if (prev.length >= 3) {
        Alert.alert('Max 3 positions', 'Remove one to add another.');
        return prev;
      }
      return [...prev, pos];
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/auth' as any);
    } catch (e) {
      console.error(e);
    }
  };

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => (editing ? saveProfile() : setEditing(true))}>
          <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={editing ? pickImage : undefined}
            style={styles.avatarWrapper}
            activeOpacity={editing ? 0.7 : 1}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={13} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            <Text style={styles.nameText}>{name || 'Tap Edit to set your name'}</Text>
          )}
          <Text style={styles.emailText}>{user?.email}</Text>
        </View>

        {/* Positions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Top Positions{' '}
            <Text style={styles.sectionHint}>(up to 3, ranked by order)</Text>
          </Text>
          <View style={styles.positionGrid}>
            {POSITIONS.map(pos => {
              const active = positions.includes(pos);
              const rank = positions.indexOf(pos) + 1;
              return (
                <TouchableOpacity
                  key={pos}
                  style={[styles.positionChip, active && styles.positionChipActive]}
                  onPress={() => editing && togglePosition(pos)}
                  activeOpacity={editing ? 0.7 : 1}
                >
                  {active && <Text style={styles.positionRank}>#{rank}</Text>}
                  <Text style={[styles.positionText, active && styles.positionTextActive]}>
                    {pos}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience Level</Text>
          <View style={styles.expRow}>
            {EXPERIENCE_LEVELS.map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.expBtn, experience === level && styles.expBtnActive]}
                onPress={() => editing && setExperience(level)}
                activeOpacity={editing ? 0.7 : 1}
              >
                <Text style={[styles.expText, experience === level && styles.expTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Sessions{'\n'}Attended</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Sessions{'\n'}Hosted</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Community{'\n'}Rating</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  editBtn: { fontSize: 15, fontWeight: '700', color: '#000' },
  scroll: { paddingBottom: 50 },
  avatarSection: {
    backgroundColor: '#FFF',
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 12,
  },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { color: '#FFF', fontSize: 30, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#000',
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  nameInput: {
    fontSize: 20, fontWeight: '700', color: '#000',
    borderBottomWidth: 2, borderBottomColor: '#000',
    paddingVertical: 4, paddingHorizontal: 8,
    minWidth: 180, textAlign: 'center',
    marginBottom: 6,
  },
  nameText: { fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 6 },
  emailText: { fontSize: 13, color: '#9CA3AF' },
  section: { backgroundColor: '#FFF', marginBottom: 12, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 14 },
  sectionHint: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  positionChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
    gap: 5,
  },
  positionChipActive: { backgroundColor: '#000', borderColor: '#000' },
  positionRank: { fontSize: 11, fontWeight: '800', color: '#9CA3AF' },
  positionText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  positionTextActive: { color: '#FFF' },
  expRow: { flexDirection: 'row', gap: 8 },
  expBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
    borderColor: '#E5E7EB', alignItems: 'center',
  },
  expBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  expText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  expTextActive: { color: '#FFF' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#F9FAFB',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', color: '#000', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 15 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 8,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FEE2E2',
  },
  signOutText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});

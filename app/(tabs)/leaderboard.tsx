import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebaseConfig';
import { getLeaderboard, LeaderboardEntry } from '../../services/insights';

// Weekly leaderboard: ranked by games played this week (check-ins), with games
// hosted as the tiebreaker. Data comes from the player_activity_weekly
// continuous aggregate in Tiger Cloud and resets every Monday.

const MEDALS = ['🥇', '🥈', '🥉'];
const AVATAR_COLORS = ['#FF6B35', '#6C63FF', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

function avatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function weekRangeLabel(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export default function LeaderboardScreen() {
  const uid = auth.currentUser?.uid ?? '';
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await getLeaderboard());
    } catch {
      // keep whatever we had
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Loads on first view and refreshes whenever the tab comes back into view
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderRow = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.uid === uid;
    return (
      <View style={[styles.row, isMe && styles.rowMe]}>
        <Text style={styles.rank}>{item.rank <= 3 ? MEDALS[item.rank - 1] : item.rank}</Text>
        <View style={[styles.avatar, { backgroundColor: avatarColor(item.uid) }]}>
          <Text style={styles.avatarText}>{initials(item.name)}</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{item.name}{isMe ? ' (you)' : ''}</Text>
          <Text style={styles.meta}>
            {item.position}{item.gamesHosted > 0 ? ` · hosted ${item.gamesHosted}` : ''}
          </Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={styles.score}>{item.gamesPlayed}</Text>
          <Text style={styles.scoreLabel}>games</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <Text style={styles.headerSub}>This week · {weekRangeLabel()}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#000" /></View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.uid}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListHeaderComponent={
            <View style={styles.explainer}>
              <Ionicons name="trophy" size={18} color="#F59E0B" />
              <Text style={styles.explainerText}>
                Ranked by games played this week. Resets every Monday, so get out there!
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏐</Text>
              <Text style={styles.emptyTitle}>No games yet this week</Text>
              <Text style={styles.emptySub}>Join a session to get on the board.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, gap: 8, paddingBottom: 30 },
  explainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 4,
  },
  explainerText: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12,
    borderWidth: 2, borderColor: 'transparent',
  },
  rowMe: { borderColor: '#000' },
  rank: { width: 28, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#374151' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  nameCol: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#000' },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  scoreCol: { alignItems: 'center', minWidth: 48 },
  score: { fontSize: 20, fontWeight: '800', color: '#000' },
  scoreLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#000', marginBottom: 4 },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
});

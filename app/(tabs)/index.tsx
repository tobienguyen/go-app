import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  FlatList, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const POSTS = [
  {
    id: '1',
    name: 'Alex Martinez',
    initials: 'AM',
    avatarColor: '#FF6B35',
    position: 'Outside Hitter',
    time: '2h ago',
    content: 'Just had an incredible session at Santa Monica Beach today! The level of play has been going up every week. Who else is going Saturday? 🏐',
    likes: 47,
    comments: 12,
    liked: false,
  },
  {
    id: '2',
    name: 'Jordan Kim',
    initials: 'JK',
    avatarColor: '#6C63FF',
    position: 'Setter',
    time: '4h ago',
    content: 'Anyone looking for a setting partner to drill this weekend? Trying to clean up my back sets before the tournament next month. DM me 🙌',
    likes: 23,
    comments: 8,
    liked: false,
  },
  {
    id: '3',
    name: 'Coach Rivera',
    initials: 'CR',
    avatarColor: '#10B981',
    position: 'Coach',
    time: '1d ago',
    content: 'Pro tip of the week: 90% of a great defensive play starts with your footwork. Plant your feet BEFORE the ball gets to you, not during. Try this drill — shuffle laterally 5 steps, crossover, shuffle back. 10 reps each direction. Your passing will thank you. 💪',
    likes: 134,
    comments: 31,
    liked: true,
  },
  {
    id: '4',
    name: 'Maya Thompson',
    initials: 'MT',
    avatarColor: '#F59E0B',
    position: 'Libero',
    time: '1d ago',
    content: 'Does anyone else feel like beach volleyball uses completely different muscles than indoor?? Played a beach session after 2 months of indoor and I can barely walk today lol 😭🏖️',
    likes: 89,
    comments: 27,
    liked: false,
  },
  {
    id: '5',
    name: 'Tyler Brooks',
    initials: 'TB',
    avatarColor: '#3B82F6',
    position: 'Middle Blocker',
    time: '2d ago',
    content: "6'4\" and still getting out-blocked by my 5'9\" teammate. Humbling stuff. Anyone got tips for improving block timing? 😅",
    likes: 65,
    comments: 19,
    liked: false,
  },
];

type Post = typeof POSTS[0];

export default function HomeScreen() {
  const [posts, setPosts] = useState(POSTS);

  const toggleLike = (id: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </View>
        <View style={styles.postMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.posterName}>{item.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.position}</Text>
            </View>
          </View>
          <Text style={styles.postTime}>{item.time}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item.id)}>
          <Ionicons
            name={item.liked ? 'heart' : 'heart-outline'}
            size={20}
            color={item.liked ? '#EF4444' : '#6B7280'}
          />
          <Text style={[styles.actionText, item.liked && { color: '#EF4444' }]}>
            {item.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={19} color="#6B7280" />
          <Text style={styles.actionText}>{item.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="arrow-redo-outline" size={20} color="#6B7280" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLogo}>
          Go<Text style={styles.headerLogoAccent}>!</Text>
        </Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.createPostBar}>
            <View style={styles.createAvatar}>
              <Text style={styles.createAvatarText}>Me</Text>
            </View>
            <TouchableOpacity style={styles.createInput} activeOpacity={0.7}>
              <Text style={styles.createInputText}>Share something with the community...</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  headerLogo: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -1 },
  headerLogoAccent: { fontStyle: 'italic' },
  headerIcons: { flexDirection: 'row', gap: 8 },
  headerIcon: { padding: 4 },
  feed: { paddingBottom: 20 },
  createPostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  createAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  createAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  createInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  createInputText: { color: '#9CA3AF', fontSize: 14 },
  postCard: {
    backgroundColor: '#FFF',
    marginBottom: 8,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  postMeta: { flex: 1 },
  nameRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, flexWrap: 'wrap',
  },
  posterName: { fontSize: 15, fontWeight: '700', color: '#000' },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  postTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  postContent: { fontSize: 15, color: '#111827', lineHeight: 22, marginBottom: 14 },
  postActions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
});

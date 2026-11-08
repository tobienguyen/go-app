import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useRouter } from "expo-router";
import { auth, storage } from "../../config/firebaseConfig";
import { getUser } from "../../services/users";
import { subscribeFeed, createPost, toggleLike as toggleLikeApi } from "../../services/posts";
import { Brand } from "../../constants/brand";

const AVATAR_COLORS = ["#111111"];
const TYPE_COLORS: Record<string, string> = { beach: Brand.ink, grass: Brand.ink, indoor: Brand.ink };
const TYPE_ICONS: Record<string, string> = { beach: "🏖️", grass: "🌿", indoor: "🏟️" };

function avatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(ts: string | undefined): string {
  if (!ts) return "just now";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function uploadImage(localUri: string, uid: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `posts/${uid}/${Date.now()}.jpg`);
  await uploadBytesResumable(storageRef, blob);
  return getDownloadURL(storageRef);
}

interface Post {
  id: string;
  type: "text" | "session";
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorPosition: string;
  content: string;
  imageUrl?: string;
  likes: number;
  likedBy: string[];
  comments: number;
  createdAt: string;
  sessionId?: string;
  sessionType?: string;
  sessionLocation?: string;
  sessionPrice?: number;
  sessionSkillLevel?: string;
  sessionDuration?: string;
}

interface MyProfile {
  name: string;
  positions: string[];
  experience: string;
}

interface ComposeBarProps {
  uid: string;
  myInitials: string;
  composing: boolean;
  draft: string;
  draftImageUri: string | null;
  posting: boolean;
  setComposing: (v: boolean) => void;
  setDraft: (v: string) => void;
  setDraftImageUri: (v: string | null) => void;
  pickImage: () => void;
  submitPost: () => void;
}

const ComposeBar = React.memo(function ComposeBar({
  uid, myInitials, composing, draft, draftImageUri, posting,
  setComposing, setDraft, setDraftImageUri, pickImage, submitPost,
}: ComposeBarProps) {
  return (
    <View style={styles.createPostBar}>
      <View style={[styles.createAvatar, { backgroundColor: avatarColor(uid) }]}>
        <Text style={styles.createAvatarText}>{myInitials}</Text>
      </View>
      {composing ? (
        <View style={{ flex: 1, gap: 8 }}>
          <TextInput
            style={styles.composeInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="What's on your mind?"
            placeholderTextColor="#A8A49C"
            multiline
            autoFocus
          />
          {draftImageUri && (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: draftImageUri }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity
                style={styles.imageRemoveBtn}
                onPress={() => setDraftImageUri(null)}
              >
                <Ionicons name="close-circle" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.composeActions}>
            <TouchableOpacity onPress={pickImage} style={styles.imagePickerBtn}>
              <Ionicons name="image-outline" size={22} color="#7D7A73" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setComposing(false); setDraft(""); setDraftImageUri(null); }}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postBtn, ((!draft.trim() && !draftImageUri) || posting) && { opacity: 0.4 }]}
              onPress={submitPost}
              disabled={(!draft.trim() && !draftImageUri) || posting}
            >
              {posting
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.postBtnText}>Post</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.composeRow}>
          <TouchableOpacity style={styles.createInput} onPress={() => setComposing(true)} activeOpacity={0.7}>
            <Text style={styles.createInputText}>Share something with the community...</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} style={styles.inlineImageBtn}>
            <Ionicons name="image-outline" size={22} color="#7D7A73" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

export default function HomeScreen() {
  const uid = auth.currentUser?.uid ?? "";
  const email = auth.currentUser?.email ?? "";
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftImageUri, setDraftImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    getUser(uid).then(p => {
      if (p) setMyProfile({ name: p.name, positions: p.positions, experience: p.skillLevel });
    }).catch(() => {});
  }, [uid]);

  useEffect(() => {
    return subscribeFeed(50, loaded => {
      setPosts(loaded as Post[]);
      setFeedLoading(false);
    }, () => setFeedLoading(false));
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setDraftImageUri(result.assets[0].uri);
      if (!composing) setComposing(true);
    }
  }, [composing]);

  const submitPost = useCallback(async () => {
    if (!draft.trim() && !draftImageUri) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (draftImageUri) {
        imageUrl = await uploadImage(draftImageUri, uid);
      }

      const content = draft.trim();
      const { id } = await createPost({ content, imageUrl });
      // Show the post right away instead of waiting for the next refresh
      const name = myProfile?.name || email.split("@")[0];
      setPosts(prev => [{
        id, type: "text", authorId: uid, authorName: name,
        authorInitials: name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        authorPosition: myProfile?.positions?.[0] || myProfile?.experience || "Player",
        content, imageUrl, likes: 0, likedBy: [], comments: 0,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      setDraft("");
      setDraftImageUri(null);
      setComposing(false);
    } catch {
      Alert.alert("Error", "Could not post. Try again.");
    } finally {
      setPosting(false);
    }
  }, [draft, draftImageUri, myProfile, email, uid]);

  const toggleLike = async (post: Post) => {
    if (!uid) return;
    const liked = post.likedBy?.includes(uid);
    const apply = (p: Post, nowLiked: boolean, likes?: number): Post => ({
      ...p,
      likedBy: nowLiked ? [...(p.likedBy ?? []).filter(x => x !== uid), uid] : (p.likedBy ?? []).filter(x => x !== uid),
      likes: likes ?? Math.max(0, p.likes + (nowLiked ? 1 : -1)),
    });
    // Optimistic update, then reconcile with the server's count
    setPosts(prev => prev.map(p => (p.id === post.id ? apply(p, !liked) : p)));
    try {
      const res = await toggleLikeApi(post.id);
      setPosts(prev => prev.map(p => (p.id === post.id ? apply(p, res.liked, res.likes) : p)));
    } catch {
      setPosts(prev => prev.map(p => (p.id === post.id ? apply(p, !!liked) : p)));
    }
  };

  const myInitials = myProfile?.name
    ? myProfile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : email?.[0]?.toUpperCase() || "?";

  const renderPost = ({ item }: { item: Post }) => {
    const liked = item.likedBy?.includes(uid) ?? false;
    const color = avatarColor(item.authorId);

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => item.authorId !== uid && router.push(`/user/${item.authorId}` as any)}
            activeOpacity={item.authorId !== uid ? 0.7 : 1}
          >
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.avatarText}>{item.authorInitials}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.postMeta}>
            <View style={styles.nameRow}>
              <TouchableOpacity
                onPress={() => item.authorId !== uid && router.push(`/user/${item.authorId}` as any)}
                activeOpacity={item.authorId !== uid ? 0.7 : 1}
              >
                <Text style={styles.posterName}>{item.authorName}</Text>
              </TouchableOpacity>
              {item.authorPosition ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.authorPosition}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.postTime}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>

        {item.type === "session" ? (
          <TouchableOpacity
            style={styles.sessionBanner}
            activeOpacity={0.75}
            onPress={() => item.sessionId && router.push(`/session/${item.sessionId}` as any)}
          >
            <View style={styles.sessionBannerTop}>
              <View style={[
                styles.sessionTypeBadge,
                { backgroundColor: (TYPE_COLORS[item.sessionType ?? ""] ?? "#7D7A73") + "20" }
              ]}>
                <Text style={[styles.sessionTypeText, { color: TYPE_COLORS[item.sessionType ?? ""] ?? "#7D7A73" }]}>
                  {TYPE_ICONS[item.sessionType ?? ""] ?? "🏐"} {(item.sessionType ?? "").toUpperCase()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#A8A49C" />
            </View>
            <Text style={styles.sessionBannerTitle}>{item.content}</Text>
            <View style={styles.sessionMeta}>
              {item.sessionLocation ? (
                <View style={styles.sessionMetaRow}>
                  <Ionicons name="location-outline" size={13} color="#7D7A73" />
                  <Text style={styles.sessionMetaText}>{item.sessionLocation}</Text>
                </View>
              ) : null}
              {item.sessionPrice !== undefined && (
                <View style={styles.sessionMetaRow}>
                  <Ionicons name="cash-outline" size={13} color="#7D7A73" />
                  <Text style={styles.sessionMetaText}>
                    {item.sessionPrice === 0 ? "Free" : `$${item.sessionPrice}/person`}
                    {item.sessionSkillLevel ? ` · ${item.sessionSkillLevel}` : ""}
                    {item.sessionDuration ? ` · ${item.sessionDuration}` : ""}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.sessionTapHint}>Tap to view listing</Text>
          </TouchableOpacity>
        ) : (
          <>
            {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.postImage}
                resizeMode="cover"
              />
            ) : null}
          </>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item)}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={20}
              color={liked ? "#D0341A" : "#7D7A73"}
            />
            <Text style={[styles.actionText, liked && { color: "#D0341A" }]}>
              {item.likes ?? 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={19} color="#7D7A73" />
            <Text style={styles.actionText}>{item.comments ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="arrow-redo-outline" size={20} color="#7D7A73" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/logo-mark.png")}
            style={styles.headerLogo}
            resizeMode="contain"
            accessibilityLabel="GO!"
          />
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {feedLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={renderPost}
            contentContainerStyle={styles.feed}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <ComposeBar
                uid={uid}
                myInitials={myInitials}
                composing={composing}
                draft={draft}
                draftImageUri={draftImageUri}
                posting={posting}
                setComposing={setComposing}
                setDraft={setDraft}
                setDraftImageUri={setDraftImageUri}
                pickImage={pickImage}
                submitPost={submitPost}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏐</Text>
                <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  headerLogo: { width: 44, height: 44 },
  headerIcons: { flexDirection: "row", gap: 8 },
  headerIcon: { padding: 4 },
  feed: { paddingBottom: 20 },
  createPostBar: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#FFF", padding: 16, marginBottom: 8,
    gap: 12, borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  createAvatar: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: "center", alignItems: "center",
  },
  createAvatarText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  composeRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  createInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: "#ECE9E3",
  },
  createInputText: { color: "#A8A49C", fontSize: 14 },
  inlineImageBtn: { padding: 4 },
  composeInput: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#ECE9E3",
    fontSize: 15, color: "#000", minHeight: 60,
  },
  imagePreviewWrapper: { position: "relative", alignSelf: "flex-start" },
  imagePreview: { width: 120, height: 120, borderRadius: 12 },
  imageRemoveBtn: {
    position: "absolute", top: -8, right: -8,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 11,
  },
  composeActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, alignItems: "center" },
  imagePickerBtn: { marginRight: "auto" },
  cancelBtn: { fontSize: 14, color: "#A8A49C", fontWeight: "600" },
  postBtn: {
    backgroundColor: "#000", paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: "center",
  },
  postBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  postCard: { backgroundColor: "#FFF", marginBottom: 8, padding: 16 },
  postHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  postMeta: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  posterName: { fontSize: 15, fontWeight: "700", color: "#000" },
  badge: { backgroundColor: "#F5F3EF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#7D7A73" },
  postTime: { fontSize: 12, color: "#A8A49C", marginTop: 2 },
  postContent: { fontSize: 15, color: "#111111", lineHeight: 22, marginBottom: 10 },
  postImage: { width: "100%", height: 220, borderRadius: 12, marginBottom: 12 },
  sessionBanner: {
    backgroundColor: "#FAF9F6", borderRadius: 12, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: "#ECE9E3",
  },
  sessionBannerTop: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 8,
  },
  sessionTypeBadge: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  sessionTypeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  sessionBannerTitle: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 8 },
  sessionMeta: { gap: 4, marginBottom: 8 },
  sessionMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sessionMetaText: { fontSize: 13, color: "#7D7A73" },
  sessionTapHint: { fontSize: 11, color: "#A8A49C", fontWeight: "500" },
  postActions: {
    flexDirection: "row", gap: 20,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F5F3EF",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 14, color: "#7D7A73", fontWeight: "500" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: "#A8A49C", fontWeight: "500" },
});

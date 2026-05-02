import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, getDoc, updateDoc,
  arrayUnion, arrayRemove, increment,
} from "firebase/firestore";
import { useRouter } from "expo-router";
import { auth, db, storage } from "../../config/firebaseConfig";

const AVATAR_COLORS = ["#FF6B35", "#6C63FF", "#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899"];
const TYPE_COLORS: Record<string, string> = { beach: "#F59E0B", grass: "#10B981", indoor: "#3B82F6" };
const TYPE_ICONS: Record<string, string> = { beach: "🏖️", grass: "🌿", indoor: "🏟️" };

function avatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(ts: any): string {
  if (!ts?.toDate) return "just now";
  const diff = (Date.now() - ts.toDate().getTime()) / 1000;
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
  createdAt: any;
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
            placeholderTextColor="#9CA3AF"
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
              <Ionicons name="image-outline" size={22} color="#6B7280" />
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
            <Ionicons name="image-outline" size={22} color="#6B7280" />
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
    getDoc(doc(db, "users", uid)).then(snap => {
      if (snap.exists()) setMyProfile(snap.data() as MyProfile);
    });
  }, [uid]);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, snapshot => {
      const loaded: Post[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      setPosts(loaded);
      setFeedLoading(false);
    });
    return unsub;
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
      const name = myProfile?.name || email.split("@")[0];
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
      const position = myProfile?.positions?.[0] || myProfile?.experience || "Player";

      let imageUrl: string | undefined;
      if (draftImageUri) {
        imageUrl = await uploadImage(draftImageUri, uid);
      }

      await addDoc(collection(db, "posts"), {
        type: "text",
        authorId: uid,
        authorName: name,
        authorInitials: initials,
        authorPosition: position,
        content: draft.trim(),
        ...(imageUrl ? { imageUrl } : {}),
        likes: 0,
        likedBy: [],
        comments: 0,
        createdAt: serverTimestamp(),
      });
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
    try {
      await updateDoc(doc(db, "posts", post.id), {
        likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
        likes: increment(liked ? -1 : 1),
      });
    } catch {}
  };

  const myInitials = myProfile?.name
    ? myProfile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : email?.[0]?.toUpperCase() || "?";

  const renderPost = ({ item }: { item: Post }) => {
    const liked = item.likedBy?.includes(uid) ?? false;
    const color = avatarColor(item.authorId);

    return (
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <Text style={styles.avatarText}>{item.authorInitials}</Text>
          </View>
          <View style={styles.postMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.posterName}>{item.authorName}</Text>
              {item.authorPosition ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.authorPosition}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.postTime}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>

        {/* Session card — tappable */}
        {item.type === "session" ? (
          <TouchableOpacity
            style={styles.sessionBanner}
            activeOpacity={0.75}
            onPress={() => item.sessionId && router.push(`/session/${item.sessionId}` as any)}
          >
            <View style={styles.sessionBannerTop}>
              <View style={[
                styles.sessionTypeBadge,
                { backgroundColor: (TYPE_COLORS[item.sessionType ?? ""] ?? "#6B7280") + "20" }
              ]}>
                <Text style={[styles.sessionTypeText, { color: TYPE_COLORS[item.sessionType ?? ""] ?? "#6B7280" }]}>
                  {TYPE_ICONS[item.sessionType ?? ""] ?? "🏐"} {(item.sessionType ?? "").toUpperCase()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
            <Text style={styles.sessionBannerTitle}>{item.content}</Text>
            <View style={styles.sessionMeta}>
              {item.sessionLocation ? (
                <View style={styles.sessionMetaRow}>
                  <Ionicons name="location-outline" size={13} color="#6B7280" />
                  <Text style={styles.sessionMetaText}>{item.sessionLocation}</Text>
                </View>
              ) : null}
              {item.sessionPrice !== undefined && (
                <View style={styles.sessionMetaRow}>
                  <Ionicons name="cash-outline" size={13} color="#6B7280" />
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

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item)}>
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={20}
              color={liked ? "#EF4444" : "#6B7280"}
            />
            <Text style={[styles.actionText, liked && { color: "#EF4444" }]}>
              {item.likes ?? 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={19} color="#6B7280" />
            <Text style={styles.actionText}>{item.comments ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="arrow-redo-outline" size={20} color="#6B7280" />
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
          <Text style={styles.headerLogo}>
            Go<Text style={styles.headerLogoAccent}>!</Text>
          </Text>
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
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerLogo: { fontSize: 28, fontWeight: "900", color: "#000", letterSpacing: -1 },
  headerLogoAccent: { fontStyle: "italic" },
  headerIcons: { flexDirection: "row", gap: 8 },
  headerIcon: { padding: 4 },
  feed: { paddingBottom: 20 },
  createPostBar: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#FFF", padding: 16, marginBottom: 8,
    gap: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  createAvatar: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: "center", alignItems: "center",
  },
  createAvatarText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  composeRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  createInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB",
  },
  createInputText: { color: "#9CA3AF", fontSize: 14 },
  inlineImageBtn: { padding: 4 },
  composeInput: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB",
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
  cancelBtn: { fontSize: 14, color: "#9CA3AF", fontWeight: "600" },
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
  badge: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
  postTime: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  postContent: { fontSize: 15, color: "#111827", lineHeight: 22, marginBottom: 10 },
  postImage: { width: "100%", height: 220, borderRadius: 12, marginBottom: 12 },
  sessionBanner: {
    backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: "#E5E7EB",
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
  sessionMetaText: { fontSize: 13, color: "#6B7280" },
  sessionTapHint: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
  postActions: {
    flexDirection: "row", gap: 20,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: "#9CA3AF", fontWeight: "500" },
});

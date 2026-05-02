import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Alert, Image, ActivityIndicator, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { auth } from "../../config/firebaseConfig";
import { getUser, updateUser, uploadAvatar, uploadMediaItem, isLocalUri } from "../../services/users";
import * as ImagePicker from "expo-image-picker";
import { MediaItem, UserProfile, Post } from "../../types";
import { db } from "../../config/firebaseConfig";

const SCREEN_W = Dimensions.get("window").width;
const GRID_W   = SCREEN_W - 32;
const GAP      = 6;
const PORT_W   = (GRID_W - GAP) / 2;
const PORT_H   = PORT_W * 1.25;
const LAND_H   = GRID_W * (9 / 16);

function buildMediaRows(items: MediaItem[]): MediaItem[][] {
  const rows: MediaItem[][] = [];
  let i = 0;
  while (i < items.length) {
    if (items[i].landscape) { rows.push([items[i]]); i++; }
    else if (i + 1 < items.length && !items[i + 1].landscape) { rows.push([items[i], items[i + 1]]); i += 2; }
    else { rows.push([items[i]]); i++; }
  }
  return rows;
}

const POSITIONS = ["Setter", "Libero", "Outside Hitter", "Middle Blocker", "Opposite", "Right Side", "DS"];
const SKILL_LEVELS = ["Social", "Beginner", "Intermediate", "Mid-Intermediate", "Advanced", "Pro"];
const TYPE_ICONS: Record<string, string> = { beach: "🏖️", grass: "🌿", indoor: "🏐" };
const TYPE_COLORS: Record<string, string> = { beach: "#F59E0B", grass: "#10B981", indoor: "#3B82F6" };

const BLANK_PROFILE: UserProfile = {
  uid: "", name: "", email: "", photoURL: "",
  positions: [], skillLevel: "Beginner", description: "",
  mediaItems: [], sessionsHosted: 0, sessionsAttended: 0,
};

export default function ProfileScreen() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;
  const email = auth.currentUser?.email;

  const [profile, setProfile] = useState<UserProfile>(BLANK_PROFILE);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit drafts
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDesc] = useState("");
  const [draftPositions, setDraftPositions] = useState<string[]>([]);
  const [draftSkillLevel, setDraftSkill] = useState("Beginner");
  const [draftMedia, setDraftMedia] = useState<MediaItem[]>([]);
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    loadProfile();
    loadPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const loadProfile = async () => {
    try {
      const p = await getUser(uid!);
      if (p) {
        setProfile(p);
        setMediaItems(p.mediaItems ?? []);
        setDraftName(p.name);
        setDraftDesc(p.description);
        setDraftPositions(p.positions);
        setDraftSkill(p.skillLevel);
        setDraftMedia(p.mediaItems ?? []);
      }
    } catch (e) {
      console.error("loadProfile", e);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const q = query(
        collection(db, "posts"),
        where("authorId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(5),
      );
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    } catch {}
  };

  const saveProfile = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      // Upload avatar if a new local photo was picked
      let photoURL = profile.photoURL;
      if (draftPhotoUri && isLocalUri(draftPhotoUri)) {
        photoURL = await uploadAvatar(uid, draftPhotoUri);
      }

      // Upload any new media items that are still local URIs
      const uploadedMedia: MediaItem[] = await Promise.all(
        draftMedia.map(async (item, i) => {
          if (!isLocalUri(item.uri)) return item;
          const url = await uploadMediaItem(uid, item.uri, i);
          return { ...item, uri: url };
        }),
      );

      await updateUser(uid, {
        name: draftName.trim(),
        photoURL,
        positions: draftPositions,
        skillLevel: draftSkillLevel,
        description: draftDescription.trim(),
        mediaItems: uploadedMedia,
      });

      setProfile(prev => ({
        ...prev,
        name: draftName.trim(),
        photoURL,
        positions: draftPositions,
        skillLevel: draftSkillLevel,
        description: draftDescription.trim(),
        mediaItems: uploadedMedia,
      }));
      setMediaItems(uploadedMedia);
      setDraftPhotoUri(null);
      setEditing(false);
    } catch (e) {
      console.error("saveProfile", e);
      Alert.alert("Error", "Could not save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setDraftName(profile.name);
    setDraftDesc(profile.description);
    setDraftPositions(profile.positions);
    setDraftSkill(profile.skillLevel);
    setDraftMedia(mediaItems);
    setDraftPhotoUri(null);
    setEditing(false);
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      setDraftPhotoUri(result.assets[0].uri);
    }
  };

  const addMedia = async () => {
    if (draftMedia.length >= 9) { Alert.alert("Max 9 photos"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newItems: MediaItem[] = result.assets.map(a => ({
        uri: a.uri,
        landscape: (a.width ?? 1) > (a.height ?? 1),
      }));
      setDraftMedia(prev => [...prev, ...newItems].slice(0, 9));
    }
  };

  const removeMedia = (uri: string) => {
    Alert.alert("Remove photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setDraftMedia(prev => prev.filter(m => m.uri !== uri)) },
    ]);
  };

  const togglePosition = (pos: string) => {
    setDraftPositions(prev => {
      if (prev.includes(pos)) return prev.filter(p => p !== pos);
      if (prev.length >= 3) { Alert.alert("Max 3 positions"); return prev; }
      return [...prev, pos];
    });
  };

  const handleSignOut = async () => {
    try { await signOut(auth); router.replace("/auth" as any); } catch (e) { console.error(e); }
  };

  const displayName = profile.name || email || "Player";
  const initials = profile.name
    ? profile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : (email?.[0] || "?").toUpperCase();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  const positions = editing ? draftPositions : profile.positions;
  const skillLevel = editing ? draftSkillLevel : profile.skillLevel;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        {editing ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={cancelEdit}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveProfile} style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={16} color="#000" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + Info ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <TouchableOpacity
            onPress={editing ? pickAvatar : undefined}
            style={styles.avatarWrapper}
            activeOpacity={editing ? 0.7 : 1}
          >
            {(draftPhotoUri || profile.photoURL) ? (
              <Image source={{ uri: draftPhotoUri ?? profile.photoURL }} style={styles.avatarImage} />
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
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            <Text style={styles.nameText}>{displayName}</Text>
          )}
          <Text style={styles.emailText}>{email}</Text>

          {editing ? (
            <TextInput
              style={styles.descriptionInput}
              value={draftDescription}
              onChangeText={setDraftDesc}
              placeholder="Add a bio..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          ) : profile.description ? (
            <Text style={styles.descriptionText}>{profile.description}</Text>
          ) : null}
        </View>

        {/* ── Positions ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Positions</Text>

          {editing ? (
            <>
              <Text style={styles.sectionHint}>Tap in order of preference (up to 3)</Text>
              <View style={styles.chipGrid}>
                {POSITIONS.map(pos => {
                  const idx = draftPositions.indexOf(pos);
                  const active = idx >= 0;
                  return (
                    <TouchableOpacity
                      key={pos}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => togglePosition(pos)}
                    >
                      {active && <Text style={styles.chipRank}>#{idx + 1}</Text>}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{pos}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : positions.length > 0 ? (
            <View>
              {/* #1 — prominent */}
              <View style={styles.pos1Row}>
                <View style={styles.pos1Chip}>
                  <Text style={styles.pos1Rank}>#1</Text>
                  <Text style={styles.pos1Label}>{positions[0]}</Text>
                </View>
              </View>
              {/* #2 and #3 */}
              {positions.length > 1 && (
                <View style={styles.pos23Row}>
                  {positions.slice(1).map((pos, i) => (
                    <View key={i} style={styles.pos23Chip}>
                      <Text style={styles.pos23Rank}>#{i + 2}</Text>
                      <Text style={styles.pos23Label}>{pos}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyNote}>No positions set — tap Edit to add</Text>
          )}
        </View>

        {/* ── Skill Level + Media ────────────────────────────────────── */}
        <View style={styles.card}>
          {editing ? (
            <>
              <Text style={styles.sectionTitle}>Skill Level</Text>
              <View style={styles.chipGrid}>
                {SKILL_LEVELS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, draftSkillLevel === s && styles.chipActive]}
                    onPress={() => setDraftSkill(s)}
                  >
                    <Text style={[styles.chipText, draftSkillLevel === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.skillLevelTag}>{skillLevel} Player</Text>
          )}

          {/* Media grid — portrait: 2 per row, landscape: full row */}
          {(() => {
            const activeMedia = editing ? draftMedia : mediaItems;
            const rows = buildMediaRows(activeMedia);
            return (
              <View style={{ gap: GAP, marginTop: 4 }}>
                {rows.map((row, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: "row", gap: GAP }}>
                    {row.map((item) => (
                      <TouchableOpacity
                        key={item.uri}
                        onPress={editing ? () => removeMedia(item.uri) : undefined}
                        activeOpacity={editing ? 0.7 : 1}
                        style={{ position: "relative" }}
                      >
                        <Image
                          source={{ uri: item.uri }}
                          style={{
                            width: item.landscape ? GRID_W : PORT_W,
                            height: item.landscape ? LAND_H : PORT_H,
                            borderRadius: 10,
                          }}
                          resizeMode="cover"
                        />
                        {editing && (
                          <View style={styles.mediaRemoveBadge}>
                            <Ionicons name="close" size={12} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                {editing && activeMedia.length < 9 && (
                  <TouchableOpacity
                    style={[styles.mediaAddBtn, { width: PORT_W, height: PORT_H }]}
                    onPress={addMedia}
                  >
                    <Ionicons name="add" size={28} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {!editing && mediaItems.length === 0 && (
            <Text style={styles.emptyNote}>No photos yet — tap Edit to add</Text>
          )}
        </View>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.sessionsAttended}</Text>
              <Text style={styles.statLabel}>Sessions{"\n"}Attended</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.sessionsHosted}</Text>
              <Text style={styles.statLabel}>Sessions{"\n"}Hosted</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>Community{"\n"}Rating</Text>
            </View>
          </View>
        </View>

        {/* ── Recent Posts ───────────────────────────────────────────── */}
        {posts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <View style={{ gap: 10 }}>
              {posts.map(post => {
                const typeColor = TYPE_COLORS[post.sessionType ?? ""] ?? "#6B7280";
                return (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postTop}>
                      <View style={[styles.postTypeBadge, { backgroundColor: typeColor + "20", borderColor: typeColor }]}>
                        <Text style={[styles.postTypeBadgeText, { color: typeColor }]}>
                          {TYPE_ICONS[post.sessionType ?? ""] ?? "🏐"} {post.sessionType?.toUpperCase()}
                        </Text>
                      </View>
                      {(post.sessionPrice ?? 0) > 0 ? (
                        <Text style={styles.postPrice}>${post.sessionPrice}/person</Text>
                      ) : (
                        <Text style={styles.postFree}>Free</Text>
                      )}
                    </View>
                    <Text style={styles.postTitle}>{post.content}</Text>
                    {post.sessionLocation ? (
                      <View style={styles.postRow}>
                        <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.postMeta}>{post.sessionLocation}</Text>
                      </View>
                    ) : null}
                    {(post.sessionTimeRange || post.sessionDuration) ? (
                      <View style={styles.postRow}>
                        <Ionicons name="time-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.postMeta}>
                          {post.sessionTimeRange ?? post.sessionDuration}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Sign Out ───────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
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
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#000" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  cancelBtn: { fontSize: 15, color: "#9CA3AF", fontWeight: "600" },
  saveBtn: { backgroundColor: "#000", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  editBtnText: { fontSize: 14, fontWeight: "600", color: "#000" },
  scroll: { padding: 12, gap: 12, paddingBottom: 40 },

  // Card
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 12 },
  sectionHint: { fontSize: 12, color: "#9CA3AF", marginBottom: 10, marginTop: -6 },
  emptyNote: { fontSize: 13, color: "#9CA3AF", fontStyle: "italic" },

  // Avatar
  avatarWrapper: { alignSelf: "center", position: "relative", marginBottom: 12 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#000", justifyContent: "center", alignItems: "center",
  },
  avatarInitials: { color: "#FFF", fontSize: 30, fontWeight: "800" },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: "#000", width: 26, height: 26, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#FFF",
  },
  nameText: { fontSize: 20, fontWeight: "700", color: "#000", textAlign: "center", marginBottom: 4 },
  emailText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", marginBottom: 8 },
  nameInput: {
    fontSize: 18, fontWeight: "700", color: "#000",
    borderBottomWidth: 2, borderBottomColor: "#000",
    paddingVertical: 4, textAlign: "center", marginBottom: 6,
  },
  descriptionText: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20, marginTop: 4 },
  descriptionInput: {
    marginTop: 8, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, padding: 12, fontSize: 14, color: "#000", minHeight: 72,
  },

  // Positions
  pos1Row: { marginBottom: 10 },
  pos1Chip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#000", borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 12, alignSelf: "flex-start",
  },
  pos1Rank: { fontSize: 11, fontWeight: "800", color: "#9CA3AF" },
  pos1Label: { fontSize: 17, fontWeight: "800", color: "#FFF" },
  pos23Row: { flexDirection: "row", gap: 8 },
  pos23Chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  pos23Rank: { fontSize: 10, fontWeight: "700", color: "#9CA3AF" },
  pos23Label: { fontSize: 14, fontWeight: "600", color: "#374151" },

  // Chips (edit mode)
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  chipActive: { backgroundColor: "#000", borderColor: "#000" },
  chipRank: { fontSize: 10, fontWeight: "800", color: "#9CA3AF" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#FFF" },

  // Skill + Media
  skillLevelTag: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 12 },
  mediaRemoveBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "rgba(0,0,0,0.6)", width: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  mediaAddBtn: {
    borderRadius: 10,
    borderWidth: 1.5, borderColor: "#E5E7EB", borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB",
  },

  // Stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: "#F9FAFB", borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "800", color: "#000", marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 15 },

  // Posts
  postCard: {
    backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#F3F4F6",
  },
  postTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  postTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  postTypeBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  postPrice: { fontSize: 12, fontWeight: "700", color: "#000" },
  postFree: { fontSize: 12, fontWeight: "700", color: "#10B981" },
  postTitle: { fontSize: 14, fontWeight: "700", color: "#000", marginBottom: 5 },
  postRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  postMeta: { fontSize: 12, color: "#9CA3AF", flex: 1 },

  // Sign out
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FEE2E2",
  },
  signOutText: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
});

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Alert, Image, ActivityIndicator, Dimensions, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { getUser, updateUser, uploadAvatar, uploadMediaItem, isLocalUri } from "../../services/users";
import { getPendingRequests, acceptFollowRequest, removeFollow, getFollowerCount, getFollowingCount } from "../../services/follows";
import type { Follow } from "../../services/follows";
import * as ImagePicker from "expo-image-picker";
import { MediaItem, UserProfile, Post } from "../../types";
import { getUserPosts } from "../../services/posts";
import { Brand } from "../../constants/brand";
import { CourtPin } from "../../components/brand-art";
import { F } from "../../constants/fonts";

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
const TYPE_COLORS: Record<string, string> = { beach: Brand.ink, grass: Brand.ink, indoor: Brand.ink };


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

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDesc] = useState("");
  const [draftPositions, setDraftPositions] = useState<string[]>([]);
  const [draftSkillLevel, setDraftSkill] = useState("Beginner");
  const [draftMedia, setDraftMedia] = useState<MediaItem[]>([]);
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);

  const [followerCount, setFollowerCount]   = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<Follow[]>([]);
  const [requesterNames, setRequesterNames]   = useState<Record<string, string>>({});

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
      const [fc, fgc, reqs] = await Promise.all([
        getFollowerCount(uid!),
        getFollowingCount(uid!),
        getPendingRequests(uid!),
      ]);
      setFollowerCount(fc);
      setFollowingCount(fgc);
      setPendingRequests(reqs);
      // Load requester display names
      const names: Record<string, string> = {};
      await Promise.all(reqs.map(async r => {
        const u = await getUser(r.fromUid);
        names[r.fromUid] = u?.name || u?.email || "Someone";
      }));
      setRequesterNames(names);
    } catch (e) {
      console.error("loadProfile", e);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      setPosts(await getUserPosts(uid!, 5));
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
    if (draftMedia.length >= 9) { Alert.alert("Max 9 items"); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const newItems: MediaItem[] = result.assets.map(a => ({
        uri: a.uri,
        landscape: (a.width ?? 1) > (a.height ?? 1),
        type: a.type === "video" ? "video" : "image",
      }));
      setDraftMedia(prev => [...prev, ...newItems].slice(0, 9));
    }
  };

  const removeMedia = (uri: string) => {
    Alert.alert("Remove item?", undefined, [
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
      {editing && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit profile</Text>
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
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {editing ? (
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
                placeholderTextColor="#A8A49C"
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
                placeholderTextColor="#A8A49C"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            ) : profile.description ? (
              <Text style={styles.descriptionText}>{profile.description}</Text>
            ) : null}
          </View>
        ) : (
          <>
            {/* Greeting + avatar */}
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroHello}>Hi,</Text>
                <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.heroMeta}>
                  {[profile.positions?.[0], profile.skillLevel].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <View style={{ alignItems: "center", gap: 8 }}>
                {profile.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.heroAvatar} />
                ) : (
                  <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.editPill}>
                  <Text style={styles.editPillText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
            {profile.description ? <Text style={styles.heroBio}>{profile.description}</Text> : null}

            {/* Player card (HEYTEA-style membership card) */}
            <View style={styles.playerCard}>
              <View style={styles.playerCardTop}>
                <Text style={styles.playerCardLabel}>GO! PLAYER</Text>
                <Image source={require("../../assets/images/logo-mark.png")} style={styles.playerCardLogo} />
              </View>
              <Text style={styles.playerCardTier}>{profile.skillLevel || "Player"}</Text>
              <View style={styles.playerCardDot} />
              <View style={styles.playerStats}>
                <PlayerStat value={profile.sessionsAttended} label="Played" />
                <PlayerStat value={profile.sessionsHosted} label="Hosted" />
                <PlayerStat value={followerCount} label="Followers" />
                <PlayerStat value={followingCount} label="Following" />
              </View>
            </View>

            {/* Shortcuts */}
            <View style={styles.shortcuts}>
              <Shortcut icon={require("../../assets/images/brand/tab-map.png")} label="Find games" onPress={() => router.push("/(tabs)/map" as any)} />
              <Shortcut icon={require("../../assets/images/brand/icon-house.png")} label="Host a game" onPress={() => router.push("/create-session" as any)} />
              <Shortcut icon={require("../../assets/images/brand/tab-leaderboard.png")} label="Leaderboard" onPress={() => router.push("/(tabs)/leaderboard" as any)} />
              <Shortcut icon={require("../../assets/images/brand/icon-stats.png")} label="My stats" onPress={() => router.push("/(tabs)/leaderboard" as any)} />
            </View>
          </>
        )}

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
              <View style={styles.pos1Row}>
                <View style={styles.pos1Chip}>
                  <Text style={styles.pos1Rank}>#1</Text>
                  <Text style={styles.pos1Label}>{positions[0]}</Text>
                </View>
              </View>
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
                    {row.map((item) => {
                      const w = item.landscape ? GRID_W : PORT_W;
                      const h = item.landscape ? LAND_H : PORT_H;
                      const isVideo = item.type === "video";
                      return (
                        <TouchableOpacity
                          key={item.uri}
                          onPress={editing
                            ? () => removeMedia(item.uri)
                            : isVideo ? () => Linking.openURL(item.uri) : undefined}
                          activeOpacity={editing || isVideo ? 0.7 : 1}
                          style={{ position: "relative" }}
                        >
                          {isVideo ? (
                            <View style={[styles.videoTile, { width: w, height: h }]}>
                              <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.9)" />
                            </View>
                          ) : (
                            <Image
                              source={{ uri: item.uri }}
                              style={{ width: w, height: h, borderRadius: 10 }}
                              resizeMode="cover"
                            />
                          )}
                          {editing && (
                            <View style={styles.mediaRemoveBadge}>
                              <Ionicons name="close" size={12} color="#FFF" />
                            </View>
                          )}
                          {!editing && isVideo && (
                            <View style={styles.videoBadge}>
                              <Ionicons name="videocam" size={11} color="#FFF" />
                              <Text style={styles.videoBadgeText}>VIDEO</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                {editing && activeMedia.length < 9 && (
                  <TouchableOpacity
                    style={[styles.mediaAddBtn, { width: PORT_W, height: PORT_H }]}
                    onPress={addMedia}
                  >
                    <Ionicons name="add" size={28} color="#A8A49C" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {!editing && mediaItems.length === 0 && (
            <Text style={styles.emptyNote}>No photos or videos yet — tap Edit to add</Text>
          )}
        </View>

        {pendingRequests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Friend Requests</Text>
            <View style={{ gap: 10 }}>
              {pendingRequests.map(req => (
                <View key={req.id} style={styles.requestRow}>
                  <View style={styles.requestAvatar}>
                    <Text style={styles.requestAvatarText}>
                      {(requesterNames[req.fromUid] || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.requestName} numberOfLines={1}>
                    {requesterNames[req.fromUid] || "Someone"}
                  </Text>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={async () => {
                      await acceptFollowRequest(req.id);
                      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                      setFollowerCount(c => c + 1);
                    }}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={async () => {
                      await removeFollow(req.fromUid, uid!);
                      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                    }}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {posts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent games</Text>
            <View style={{ gap: 10 }}>
              {posts.map(post => {
                const typeColor = TYPE_COLORS[post.sessionType ?? ""] ?? "#7D7A73";
                return (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postTop}>
                      <View style={[styles.postTypeBadge, { backgroundColor: typeColor + "20", borderColor: typeColor }]}>
                        <CourtPin type={post.sessionType ?? ""} size={14} />
                        <Text style={[styles.postTypeBadgeText, { color: typeColor }]}>
                          {post.sessionType?.toUpperCase()}
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
                        <Ionicons name="location-outline" size={12} color="#A8A49C" />
                        <Text style={styles.postMeta}>{post.sessionLocation}</Text>
                      </View>
                    ) : null}
                    {(post.sessionTimeRange || post.sessionDuration) ? (
                      <View style={styles.postRow}>
                        <Ionicons name="time-outline" size={12} color="#A8A49C" />
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

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#D0341A" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

    </SafeAreaView>
  );
}

function PlayerStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={styles.playerStatValue}>{value ?? 0}</Text>
      <Text style={styles.playerStatLabel}>{label}</Text>
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.7}>
      <Image source={icon} style={styles.shortcutIcon} resizeMode="contain" />
      <Text style={styles.shortcutLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  headerTitle: { fontFamily: F.w800, fontSize: 22, color: "#000" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  cancelBtn: { fontFamily: F.w600, fontSize: 17, color: "#A8A49C", },
  saveBtn: { backgroundColor: "#000", paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveBtnText: { fontFamily: F.w700, color: "#FFF", fontSize: 16 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#ECE9E3" },
  editBtnText: { fontFamily: F.w600, fontSize: 16, color: "#000" },
  scroll: { padding: 16, gap: 14, paddingBottom: 48 },

  hero: { flexDirection: "row", alignItems: "flex-start", paddingTop: 12 },
  heroHello: { fontFamily: F.w600, fontSize: 18, color: "#7D7A73", },
  heroName: { fontFamily: F.w900, fontSize: 34, color: "#111111", marginTop: 2 },
  heroMeta: { fontFamily: F.w600, fontSize: 16, color: "#7D7A73", marginTop: 4, },
  heroBio: { fontFamily: F.w400, fontSize: 16, color: "#3A3833", lineHeight: 22, marginTop: -4 },
  heroAvatar: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: "#111111" },
  heroAvatarFallback: { backgroundColor: "#111111", justifyContent: "center", alignItems: "center" },
  editPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: "#111111" },
  editPillText: { fontFamily: F.w700, fontSize: 13, color: "#111111" },

  playerCard: { backgroundColor: "#111111", borderRadius: 20, padding: 18, overflow: "hidden" },
  playerCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  playerCardLabel: { fontFamily: F.w800, color: "#FFF", fontSize: 13, letterSpacing: 2.5, opacity: 0.8 },
  playerCardLogo: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFF" },
  playerCardTier: { fontFamily: F.w900, color: "#FFF", fontSize: 29, marginTop: 14 },
  playerCardDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: "#D0341A", marginTop: 8, marginBottom: 18 },
  playerStats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 14 },
  playerStatValue: { fontFamily: F.w800, color: "#FFF", fontSize: 22, },
  playerStatLabel: { fontFamily: F.w600, color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },

  shortcuts: { flexDirection: "row", backgroundColor: "#FFF", borderRadius: 18, paddingVertical: 14 },
  shortcut: { flex: 1, alignItems: "center", gap: 6 },
  shortcutIcon: { width: 40, height: 40 },
  shortcutLabel: { fontFamily: F.w600, fontSize: 13, color: "#3A3833" },

  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 16 },
  sectionTitle: { fontFamily: F.w700, fontSize: 17, color: "#000", marginBottom: 12 },
  sectionHint: { fontFamily: F.w400, fontSize: 13, color: "#A8A49C", marginBottom: 10, marginTop: -6 },
  emptyNote: { fontFamily: F.w400, fontSize: 15, color: "#A8A49C", fontStyle: "italic" },

  avatarWrapper: { alignSelf: "center", position: "relative", marginBottom: 12 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#000", justifyContent: "center", alignItems: "center",
  },
  avatarInitials: { fontFamily: F.w800, color: "#FFF", fontSize: 34, },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: "#000", width: 26, height: 26, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#FFF",
  },
  nameText: { fontFamily: F.w700, fontSize: 22, color: "#000", textAlign: "center", marginBottom: 4 },
  emailText: { fontFamily: F.w400, fontSize: 15, color: "#A8A49C", textAlign: "center", marginBottom: 8 },
  nameInput: {
    fontFamily: F.w700,
    fontSize: 20, color: "#000",
    borderBottomWidth: 2, borderBottomColor: "#000",
    paddingVertical: 4, textAlign: "center", marginBottom: 6,
  },
  descriptionText: { fontFamily: F.w400, fontSize: 16, color: "#7D7A73", textAlign: "center", lineHeight: 22, marginTop: 4 },
  descriptionInput: {
    fontFamily: F.w400,
    marginTop: 8, backgroundColor: "#FAF9F6", borderWidth: 1, borderColor: "#ECE9E3",
    borderRadius: 12, padding: 12, fontSize: 16, color: "#000", minHeight: 72,
  },

  pos1Row: { marginBottom: 10 },
  pos1Chip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#000", borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 12, alignSelf: "flex-start",
  },
  pos1Rank: { fontFamily: F.w800, fontSize: 12, color: "#A8A49C" },
  pos1Label: { fontFamily: F.w800, fontSize: 19, color: "#FFF" },
  pos23Row: { flexDirection: "row", gap: 8 },
  pos23Chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#ECE9E3", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  pos23Rank: { fontFamily: F.w700, fontSize: 11, color: "#A8A49C" },
  pos23Label: { fontFamily: F.w600, fontSize: 16, color: "#3A3833" },

  // Chips (edit mode)
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: "#ECE9E3", backgroundColor: "#FAF9F6",
  },
  chipActive: { backgroundColor: "#000", borderColor: "#000" },
  chipRank: { fontFamily: F.w800, fontSize: 11, color: "#A8A49C" },
  chipText: { fontFamily: F.w600, fontSize: 15, color: "#3A3833" },
  chipTextActive: { color: "#FFF" },

  skillLevelTag: { fontFamily: F.w600, fontSize: 15, color: "#7D7A73", marginBottom: 12 },
  mediaRemoveBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "rgba(0,0,0,0.6)", width: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  mediaAddBtn: {
    borderRadius: 10,
    borderWidth: 1.5, borderColor: "#ECE9E3", borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", backgroundColor: "#FAF9F6",
  },
  videoTile: {
    borderRadius: 10, backgroundColor: "#1F1E1B",
    justifyContent: "center", alignItems: "center",
  },
  videoBadge: {
    position: "absolute", bottom: 6, left: 6,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  videoBadgeText: { fontFamily: F.w700, color: "#FFF", fontSize: 10, letterSpacing: 0.5 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: "#FAF9F6", borderRadius: 12,
    padding: 14, alignItems: "center",
  },
  statValue: { fontFamily: F.w800, fontSize: 27, color: "#000", marginBottom: 4 },
  statLabel: { fontFamily: F.w400, fontSize: 12, color: "#A8A49C", textAlign: "center", lineHeight: 17 },

  postCard: {
    backgroundColor: "#FAF9F6", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#F5F3EF",
  },
  postTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  postTypeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  postTypeBadgeText: { fontFamily: F.w700, fontSize: 11, letterSpacing: 0.5 },
  postPrice: { fontFamily: F.w700, fontSize: 13, color: "#000" },
  postFree: { fontFamily: F.w700, fontSize: 13, color: "#111111" },
  postTitle: { fontFamily: F.w700, fontSize: 16, color: "#000", marginBottom: 5 },
  postRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  postMeta: { fontFamily: F.w400, fontSize: 13, color: "#A8A49C", flex: 1 },

  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F6DDD7",
  },
  signOutText: { fontFamily: F.w700, color: "#D0341A", fontSize: 17 },

  followStatsRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: 12, marginBottom: 4,
  },
  followStat: { flex: 1, alignItems: "center" },
  followStatValue: { fontFamily: F.w800, fontSize: 22, color: "#000" },
  followStatLabel: { fontFamily: F.w400, fontSize: 12, color: "#A8A49C", marginTop: 2 },
  followStatDivider: { width: 1, height: 32, backgroundColor: "#ECE9E3", marginHorizontal: 8 },
  requestRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  requestAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#000", justifyContent: "center", alignItems: "center",
  },
  requestAvatarText: { fontFamily: F.w700, color: "#FFF", fontSize: 16 },
  requestName: { fontFamily: F.w600, flex: 1, fontSize: 16, color: "#000" },
  acceptBtn: {
    backgroundColor: "#000", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
  },
  acceptBtnText: { fontFamily: F.w700, color: "#FFF", fontSize: 15 },
  declineBtn: {
    borderWidth: 1, borderColor: "#ECE9E3", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
  },
  declineBtnText: { fontFamily: F.w600, color: "#7D7A73", fontSize: 15 },
});

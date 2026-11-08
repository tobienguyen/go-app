import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "../../config/firebaseConfig";
import { getUser } from "../../services/users";
import {
  sendFollowRequest, removeFollow, getFollowStatus,
  getFollowerCount, getFollowingCount,
} from "../../services/follows";
import { UserProfile, MediaItem } from "../../types";

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

const TYPE_ICONS: Record<string, string> = { beach: "🏖️", grass: "🌿", indoor: "🏐" };

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myUid = auth.currentUser?.uid ?? "";

  const [profile, setProfile]         = useState<UserProfile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted">("none");
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!id || id === myUid) { router.replace("/profile" as any); return; }
    loadAll();
  }, [id]);

  const loadAll = useCallback(async () => {
    try {
      const [p, status, fc, fgc] = await Promise.all([
        getUser(id),
        getFollowStatus(myUid, id),
        getFollowerCount(id),
        getFollowingCount(id),
      ]);
      setProfile(p);
      setFollowStatus(status);
      setFollowerCount(fc);
      setFollowingCount(fgc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, myUid]);

  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (followStatus === "none") {
        await sendFollowRequest(myUid, id);
        setFollowStatus("pending");
      } else {
        await removeFollow(myUid, id);
        setFollowStatus("none");
        if (followStatus === "accepted") setFollowerCount(c => Math.max(0, c - 1));
      }
    } catch {
      Alert.alert("Error", "Could not update follow status.");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ color: "#A8A49C" }}>User not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = profile.name
    ? profile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile.email?.[0] || "?").toUpperCase();

  const followBtnLabel =
    followStatus === "accepted" ? "Following" :
    followStatus === "pending"  ? "Requested" : "Follow";
  const followBtnStyle = followStatus === "none" ? styles.followBtn : styles.followBtnActive;
  const followBtnTextStyle = followStatus === "none" ? styles.followBtnText : styles.followBtnTextActive;

  const rows = buildMediaRows(profile.mediaItems ?? []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.name || "Player"}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.topInfo}>
              <Text style={styles.nameText}>{profile.name || "Player"}</Text>
              <Text style={styles.skillText}>{profile.skillLevel} Player</Text>
              {profile.positions?.length > 0 && (
                <Text style={styles.posText}>{profile.positions.join(" · ")}</Text>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.sessionsAttended ?? 0}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[followBtnStyle, followLoading && { opacity: 0.6 }]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading
              ? <ActivityIndicator size="small" color={followStatus === "none" ? "#FFF" : "#000"} />
              : <Text style={followBtnTextStyle}>{followBtnLabel}</Text>
            }
          </TouchableOpacity>

          {profile.description ? (
            <Text style={styles.descText}>{profile.description}</Text>
          ) : null}
        </View>

        {rows.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Media</Text>
            <View style={{ gap: GAP }}>
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: "row", gap: GAP }}>
                  {row.map(item => {
                    const w = item.landscape ? GRID_W : PORT_W;
                    const h = item.landscape ? LAND_H : PORT_H;
                    const isVideo = item.type === "video";
                    return (
                      <View key={item.uri} style={{ position: "relative" }}>
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
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#000" },
  backBtn: { padding: 4 },
  scroll: { padding: 12, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 12 },

  topRow: { flexDirection: "row", gap: 16, marginBottom: 16 },
  avatarImage: { width: 76, height: 76, borderRadius: 38 },
  avatarFallback: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "#000", justifyContent: "center", alignItems: "center",
  },
  avatarInitials: { color: "#FFF", fontSize: 26, fontWeight: "800" },
  topInfo: { flex: 1, justifyContent: "center", gap: 3 },
  nameText: { fontSize: 18, fontWeight: "700", color: "#000" },
  skillText: { fontSize: 13, color: "#7D7A73", fontWeight: "600" },
  posText: { fontSize: 12, color: "#A8A49C" },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FAF9F6", borderRadius: 12, padding: 14,
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#000" },
  statLabel: { fontSize: 11, color: "#A8A49C", marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "#ECE9E3" },

  followBtn: {
    backgroundColor: "#000", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginBottom: 12,
  },
  followBtnActive: {
    backgroundColor: "#F5F3EF", borderRadius: 12, borderWidth: 1, borderColor: "#ECE9E3",
    paddingVertical: 14, alignItems: "center", marginBottom: 12,
  },
  followBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  followBtnTextActive: { color: "#3A3833", fontWeight: "700", fontSize: 15 },

  descText: { fontSize: 14, color: "#7D7A73", lineHeight: 20 },

  videoTile: {
    borderRadius: 10, backgroundColor: "#1F1E1B",
    justifyContent: "center", alignItems: "center",
  },
});

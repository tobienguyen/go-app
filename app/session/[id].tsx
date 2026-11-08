import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth } from "../../config/firebaseConfig";
import { Session } from "../../types";
import { getSession, joinSession, leaveSession } from "../../services/sessions";
import { CourtPulseCard } from "../../components/court-pulse";
import { Brand } from "../../constants/brand";
import { CourtPin, CourtScene, SpotsBlobs } from "../../components/brand-art";

const TYPE_COLORS: Record<string, string> = { beach: Brand.ink, grass: Brand.ink, indoor: Brand.ink };

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const uid = auth.currentUser?.uid ?? "";

  useEffect(() => {
    if (!id) return;
    getSession(id)
      .then(s => setSession(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const isHost = session?.hostId === uid;
  const joined = !!session?.attendees?.includes(uid);

  const handleJoinToggle = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const updated = joined ? await leaveSession(session.id) : await joinSession(session.id);
      if (updated) setSession(updated);
      setPulseKey(k => k + 1); // Court Pulse picks up the new event right away
      if (!joined) Alert.alert("You're in! 🏐", "See you on the court.");
    } catch (e: any) {
      Alert.alert("Couldn't update", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#A8A49C", fontSize: 16 }}>Session not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeColor = TYPE_COLORS[session.type] ?? "#7D7A73";
  const spotsLeft = session.maxPlayers - (session.spotsFilled ?? 0);
  const spotsRatio = (session.spotsFilled ?? 0) / session.maxPlayers;
  const spotsColor = spotsRatio >= 0.9 ? Brand.red : Brand.ink;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: session.coordinate.latitude,
              longitude: session.coordinate.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={session.coordinate} pinColor={Brand.red} />
          </MapView>
          <View style={styles.typeBadgeOverlay}>
            <CourtPin type={session.type} size={18} />
            <Text style={styles.typeBadgeText}>{session.type?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <CourtScene type={session.type} height={130} style={styles.scene} />
          <Text style={styles.title}>{session.title}</Text>
          <View style={styles.hostRow}>
            <Ionicons name="person-circle-outline" size={18} color="#A8A49C" />
            <Text style={styles.hostText}>Hosted by {session.hostName}</Text>
          </View>

          <View style={styles.spotsCard}>
            <View style={styles.spotsRow}>
              <Text style={[styles.spotsLeft, { color: spotsColor }]}>
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </Text>
              <Text style={styles.spotsFraction}>
                {session.spotsFilled ?? 0} / {session.maxPlayers} filled
              </Text>
            </View>
            <SpotsBlobs filled={session.spotsFilled ?? 0} total={session.maxPlayers} size={26} max={16} />
          </View>

          <View style={styles.detailsCard}>
            {session.sessionDate && (
              <DetailRow
                icon="calendar-outline"
                label="Date"
                value={new Date(session.sessionDate).toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                }) + (session.timeRange ? ` · ${session.timeRange}` : "")}
              />
            )}
            <DetailRow icon="location-outline" label="Location" value={session.address} />
            <DetailRow
              icon="cash-outline"
              label="Price"
              value={session.price > 0 ? `$${session.price} / person` : "Free"}
            />
            <DetailRow icon="fitness-outline" label="Skill Level" value={session.skillLevel} />
            <DetailRow icon="time-outline" label="Duration" value={session.duration} />
            <DetailRow icon="people-outline" label="Max Players" value={`${session.maxPlayers} players`} />
          </View>

          {/* Court Pulse (Tiger continuous aggregate) */}
          <CourtPulseCard
            courtName={session.courtName ?? session.address}
            color={typeColor}
            refreshKey={pulseKey}
          />

          {session.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>About this session</Text>
              <Text style={styles.descriptionText}>{session.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceValue}>
            {session.price > 0 ? `$${session.price}` : "Free"}
          </Text>
          {session.price > 0 && <Text style={styles.footerPriceSub}>per person</Text>}
        </View>
        <TouchableOpacity
          style={[
            styles.joinBtn,
            joined && styles.joinBtnJoined,
            ((spotsLeft === 0 && !joined) || isHost) && styles.joinBtnFull,
          ]}
          onPress={handleJoinToggle}
          disabled={busy || isHost || (spotsLeft === 0 && !joined)}
        >
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.joinBtnText}>
              {isHost ? "You're hosting" : joined ? "Leave Session" : spotsLeft === 0 ? "Full" : "Join Session"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color="#7D7A73" style={styles.detailIcon} />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#000" },
  scroll: { paddingBottom: 100 },
  mapWrapper: { height: 220, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  typeBadgeOverlay: {
    position: "absolute", top: 16, left: 16,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: "#FFF",
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  scene: { marginBottom: 12 },
  typeBadgeText: { color: "#111111", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: "800", color: "#000", lineHeight: 30 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hostText: { fontSize: 14, color: "#7D7A73", fontWeight: "500" },
  spotsCard: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  spotsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  spotsLeft: { fontSize: 16, fontWeight: "700" },
  spotsFraction: { fontSize: 13, color: "#A8A49C", fontWeight: "500" },
  progressTrack: {
    height: 8, backgroundColor: "#F5F3EF", borderRadius: 4, overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  detailsCard: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    gap: 14,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailIcon: { marginTop: 2 },
  detailLabel: { fontSize: 11, color: "#A8A49C", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 15, color: "#111111", fontWeight: "600" },
  descriptionCard: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  descriptionLabel: { fontSize: 13, fontWeight: "700", color: "#000", marginBottom: 8 },
  descriptionText: { fontSize: 15, color: "#3A3833", lineHeight: 22 },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#ECE9E3",
  },
  footerPrice: {},
  footerPriceValue: { fontSize: 22, fontWeight: "800", color: "#000" },
  footerPriceSub: { fontSize: 12, color: "#A8A49C", fontWeight: "500" },
  joinBtn: {
    backgroundColor: "#000", paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14,
  },
  joinBtnFull: { backgroundColor: "#A8A49C" },
  joinBtnJoined: { backgroundColor: "#D0341A" },
  joinBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
});

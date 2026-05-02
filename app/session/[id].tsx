import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebaseConfig";

const TYPE_COLORS: Record<string, string> = { beach: "#F59E0B", grass: "#10B981", indoor: "#3B82F6" };
const TYPE_ICONS: Record<string, string> = { beach: "🏖️", grass: "🌿", indoor: "🏟️" };

interface Session {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  description?: string;
  type: string;
  price: number;
  skillLevel: string;
  duration: string;
  maxPlayers: number;
  spotsFilled: number;
  coordinate: { latitude: number; longitude: number };
  address: string;
  sessionDate?: any;
  createdAt: any;
  active: boolean;
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "sessions", id)).then(snap => {
      if (snap.exists()) {
        setSession({ id: snap.id, ...snap.data() } as Session);
      }
      setLoading(false);
    });
  }, [id]);

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
          <Text style={{ color: "#9CA3AF", fontSize: 16 }}>Session not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeColor = TYPE_COLORS[session.type] ?? "#6B7280";
  const spotsLeft = session.maxPlayers - (session.spotsFilled ?? 0);
  const spotsRatio = (session.spotsFilled ?? 0) / session.maxPlayers;
  const spotsColor = spotsRatio >= 0.9 ? "#EF4444" : spotsRatio >= 0.6 ? "#F59E0B" : "#10B981";

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
        {/* Map snippet */}
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
            <Marker coordinate={session.coordinate} pinColor={typeColor} />
          </MapView>
          {/* Type badge overlay */}
          <View style={[styles.typeBadgeOverlay, { backgroundColor: typeColor }]}>
            <Text style={styles.typeBadgeText}>
              {TYPE_ICONS[session.type] ?? "🏐"}  {session.type?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Title + host */}
          <Text style={styles.title}>{session.title}</Text>
          <View style={styles.hostRow}>
            <Ionicons name="person-circle-outline" size={18} color="#9CA3AF" />
            <Text style={styles.hostText}>Hosted by {session.hostName}</Text>
          </View>

          {/* Spots bar */}
          <View style={styles.spotsCard}>
            <View style={styles.spotsRow}>
              <Text style={[styles.spotsLeft, { color: spotsColor }]}>
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </Text>
              <Text style={styles.spotsFraction}>
                {session.spotsFilled ?? 0} / {session.maxPlayers} filled
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(((session.spotsFilled ?? 0) / session.maxPlayers) * 100, 100)}%`,
                  backgroundColor: spotsColor,
                }
              ]} />
            </View>
          </View>

          {/* Detail rows */}
          <View style={styles.detailsCard}>
            {session.sessionDate && (
              <DetailRow
                icon="calendar-outline"
                label="Date"
                value={session.sessionDate.toDate().toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                })}
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

          {/* Description */}
          {session.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>About this session</Text>
              <Text style={styles.descriptionText}>{session.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Join footer */}
      <View style={styles.footer}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceValue}>
            {session.price > 0 ? `$${session.price}` : "Free"}
          </Text>
          {session.price > 0 && <Text style={styles.footerPriceSub}>per person</Text>}
        </View>
        <TouchableOpacity
          style={[styles.joinBtn, spotsLeft === 0 && styles.joinBtnFull]}
          onPress={() => Alert.alert("Join Session", "Joining sessions coming soon!")}
          disabled={spotsLeft === 0}
        >
          <Text style={styles.joinBtnText}>{spotsLeft === 0 ? "Full" : "Join Session"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color="#6B7280" style={styles.detailIcon} />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#000" },
  scroll: { paddingBottom: 100 },
  mapWrapper: { height: 220, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  typeBadgeOverlay: {
    position: "absolute", top: 16, left: 16,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  typeBadgeText: { color: "#FFF", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  content: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontWeight: "800", color: "#000", lineHeight: 30 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hostText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  spotsCard: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  spotsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  spotsLeft: { fontSize: 16, fontWeight: "700" },
  spotsFraction: { fontSize: 13, color: "#9CA3AF", fontWeight: "500" },
  progressTrack: {
    height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden",
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
  detailLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 15, color: "#111827", fontWeight: "600" },
  descriptionCard: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  descriptionLabel: { fontSize: 13, fontWeight: "700", color: "#000", marginBottom: 8 },
  descriptionText: { fontSize: 15, color: "#374151", lineHeight: 22 },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E5E7EB",
  },
  footerPrice: {},
  footerPriceValue: { fontSize: 22, fontWeight: "800", color: "#000" },
  footerPriceSub: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  joinBtn: {
    backgroundColor: "#000", paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14,
  },
  joinBtnFull: { backgroundColor: "#9CA3AF" },
  joinBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
});

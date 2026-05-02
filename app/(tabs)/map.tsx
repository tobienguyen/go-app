import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  FlatList, TouchableOpacity, Dimensions, Alert, ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  collection, query, where, orderBy, onSnapshot,
  Timestamp, writeBatch, getDocs, doc,
} from "firebase/firestore";
import { db } from "../../config/firebaseConfig";

const { height } = Dimensions.get("window");

const TYPE_COLORS: Record<string, string> = { beach: "#F59E0B", grass: "#10B981", indoor: "#3B82F6" };
const TYPE_ICONS: Record<string, string> = { beach: "🏖️", grass: "🌿", indoor: "🏐" };
type SessionType = "beach" | "grass" | "indoor";
type CourtFilter = "all" | SessionType;

const DEFAULT_REGION = {
  latitude: 34.0522,
  longitude: -118.3790,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

interface Session {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  type: SessionType;
  price: number;
  skillLevel: string;
  duration: string;
  maxPlayers: number;
  spotsFilled: number;
  coordinate: { latitude: number; longitude: number };
  address: string;
  sessionDate: any;
  createdAt: any;
  active: boolean;
}

function spotsLeftColor(filled: number, total: number) {
  const ratio = filled / total;
  if (ratio >= 0.9) return "#EF4444";
  if (ratio >= 0.6) return "#F59E0B";
  return "#10B981";
}

function getNextSevenDays(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function dayLabel(d: Date, i: number): string {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courtFilter, setCourtFilter] = useState<CourtFilter>("all");
  const [dayFilter, setDayFilter] = useState<Date | null>(null);
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const [courtDropdownOpen, setCourtDropdownOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [, setLoadingLocation] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const nextSevenDays = useMemo(() => getNextSevenDays(), []);

  // Recompute days once per day so labels stay fresh
  const [today, setToday] = useState(() => new Date().toDateString());
  useEffect(() => {
    const id = setInterval(() => {
      const t = new Date().toDateString();
      if (t !== today) setToday(t);
    }, 60_000);
    return () => clearInterval(id);
  }, [today]);

  // Get user's live location
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLoadingLocation(false); return; }
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
      setUserLocation(coord);
      setLoadingLocation(false);
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.1, longitudeDelta: 0.1 }, 800);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
        loc => setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      );
    })();
    return () => { sub?.remove(); };
  }, []);

  // Clean up expired sessions on mount
  useEffect(() => {
    const cleanup = async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      try {
        const expiredQ = query(
          collection(db, "sessions"),
          where("active", "==", true),
          where("sessionDate", "<", Timestamp.fromDate(startOfToday))
        );
        const snap = await getDocs(expiredQ);
        if (snap.empty) return;
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.update(doc(db, "sessions", d.id), { active: false }));
        await batch.commit();
      } catch {}
    };
    cleanup();
  }, []);

  // Live sessions from Firestore
  useEffect(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "sessions"),
      where("active", "==", true),
      where("sessionDate", ">=", Timestamp.fromDate(startOfToday)),
      orderBy("sessionDate", "asc")
    );
    const unsub = onSnapshot(q, snapshot => {
      const data: Session[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Session));
      setSessions(data);
      setSessionsLoading(false);
    }, () => setSessionsLoading(false));
    return unsub;
  }, []);

  const filtered = useMemo(() => sessions.filter(s => {
    const courtMatch = courtFilter === "all" || s.type === courtFilter;
    let dayMatch = true;
    if (dayFilter) {
      const sd = s.sessionDate?.toDate ? s.sessionDate.toDate() : new Date(s.sessionDate);
      dayMatch = sd.toDateString() === dayFilter.toDateString();
    }
    return courtMatch && dayMatch;
  }), [sessions, courtFilter, dayFilter]);

  const selectedDayLabel = dayFilter
    ? dayLabel(dayFilter, nextSevenDays.findIndex(d => d.toDateString() === dayFilter.toDateString()))
    : "All Days";

  const selectedCourtLabel = courtFilter === "all" ? "All Courts" :
    `${TYPE_ICONS[courtFilter]} ${courtFilter.charAt(0).toUpperCase() + courtFilter.slice(1)}`;

  const handleMarkerPress = (session: Session) => {
    setSelectedId(session.id);
    const index = filtered.findIndex(s => s.id === session.id);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  };

  const handleCardPress = (session: Session) => {
    setSelectedId(session.id);
    mapRef.current?.animateToRegion(
      { ...session.coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600
    );
  };

  const closeDropdowns = () => {
    setDayDropdownOpen(false);
    setCourtDropdownOpen(false);
  };

  const renderCard = ({ item }: { item: Session }) => {
    const isSelected = selectedId === item.id;
    const spotsLeft = item.maxPlayers - (item.spotsFilled ?? 0);
    const typeColor = TYPE_COLORS[item.type] ?? "#6B7280";
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "20", borderColor: typeColor }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {TYPE_ICONS[item.type] ?? "🏐"} {item.type?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.cardPrice}>{item.price > 0 ? `$${item.price}/person` : "Free"}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.address ? (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={13} color="#6B7280" />
            <Text style={styles.cardMeta}>{item.address}</Text>
          </View>
        ) : null}
        <View style={styles.cardRow}>
          <Ionicons name="time-outline" size={13} color="#6B7280" />
          <Text style={styles.cardMeta}>
            {(item as any).timeRange ?? item.duration}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="person-outline" size={13} color="#6B7280" />
          <Text style={styles.cardMeta}>Hosted by {item.hostName} · {item.skillLevel}</Text>
        </View>
        <View style={styles.cardBottom}>
          <View>
            <Text style={[styles.spotsText, { color: spotsLeftColor(item.spotsFilled ?? 0, item.maxPlayers) }]}>
              {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
            </Text>
            <Text style={styles.spotsTotal}>{item.spotsFilled ?? 0}/{item.maxPlayers} filled</Text>
          </View>
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => Alert.alert("Join Session", "Joining sessions coming soon!")}
          >
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const initialRegion = userLocation
    ? { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 }
    : DEFAULT_REGION;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find a Session</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/create-session" as any)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={closeDropdowns}
      >
        {filtered.map(session => (
          <Marker key={session.id} coordinate={session.coordinate} onPress={() => handleMarkerPress(session)}>
            <View style={[
              styles.pin,
              { backgroundColor: TYPE_COLORS[session.type] ?? "#6B7280" },
              selectedId === session.id && styles.pinSelected,
            ]}>
              <Text style={styles.pinText}>{TYPE_ICONS[session.type] ?? "🏐"}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {/* Day dropdown */}
        <View style={[styles.dropdownWrapper, dayDropdownOpen && { zIndex: 20 }]}>
          <TouchableOpacity
            style={[styles.dropdownTrigger, dayFilter && styles.dropdownTriggerActive]}
            onPress={() => { setDayDropdownOpen(o => !o); setCourtDropdownOpen(false); }}
          >
            <Text style={[styles.dropdownTriggerText, dayFilter && styles.dropdownTriggerTextActive]}>
              {selectedDayLabel}
            </Text>
            <Ionicons
              name={dayDropdownOpen ? "chevron-up" : "chevron-down"}
              size={13}
              color={dayFilter ? "#FFF" : "#374151"}
            />
          </TouchableOpacity>
          {dayDropdownOpen && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity
                style={[styles.dropdownItem, !dayFilter && styles.dropdownItemActive]}
                onPress={() => { setDayFilter(null); setDayDropdownOpen(false); }}
              >
                <Text style={[styles.dropdownItemText, !dayFilter && styles.dropdownItemTextActive]}>
                  All Days
                </Text>
              </TouchableOpacity>
              {nextSevenDays.map((d, i) => {
                const isActive = dayFilter?.toDateString() === d.toDateString();
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => { setDayFilter(d); setDayDropdownOpen(false); }}
                  >
                    <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                      {dayLabel(d, i)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Court dropdown */}
        <View style={[styles.dropdownWrapper, courtDropdownOpen && { zIndex: 20 }]}>
          <TouchableOpacity
            style={[styles.dropdownTrigger, courtFilter !== "all" && styles.dropdownTriggerActive]}
            onPress={() => { setCourtDropdownOpen(o => !o); setDayDropdownOpen(false); }}
          >
            <Text style={[styles.dropdownTriggerText, courtFilter !== "all" && styles.dropdownTriggerTextActive]}>
              {selectedCourtLabel}
            </Text>
            <Ionicons
              name={courtDropdownOpen ? "chevron-up" : "chevron-down"}
              size={13}
              color={courtFilter !== "all" ? "#FFF" : "#374151"}
            />
          </TouchableOpacity>
          {courtDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {(["all", "indoor", "grass", "beach"] as CourtFilter[]).map(c => {
                const isActive = courtFilter === c;
                const label = c === "all" ? "All Courts" :
                  `${TYPE_ICONS[c]} ${c.charAt(0).toUpperCase() + c.slice(1)}`;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => { setCourtFilter(c); setCourtDropdownOpen(false); }}
                  >
                    <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.filterCount}>
          {sessionsLoading ? "..." : `${filtered.length} session${filtered.length !== 1 ? "s" : ""}`}
        </Text>
      </View>

      {sessionsLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#000" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
          onScrollBeginDrag={closeDropdowns}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏐</Text>
              <Text style={styles.emptyTitle}>No sessions nearby</Text>
              <Text style={styles.emptySubtitle}>Be the first to host one!</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/create-session" as any)}>
                <Text style={styles.emptyBtnText}>+ Create Session</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
  addBtn: {
    backgroundColor: "#000", width: 34, height: 34, borderRadius: 17,
    justifyContent: "center", alignItems: "center",
  },
  map: { height: height * 0.36 },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  pinSelected: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: "#000" },
  pinText: { fontSize: 16 },

  // Filter bar
  filterBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
    gap: 8, zIndex: 10,
  },
  dropdownWrapper: {
    position: "relative", zIndex: 1,
  },
  dropdownTrigger: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  dropdownTriggerActive: { backgroundColor: "#000", borderColor: "#000" },
  dropdownTriggerText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  dropdownTriggerTextActive: { color: "#FFF" },
  dropdownMenu: {
    position: "absolute", top: 38, left: 0,
    backgroundColor: "#FFF", borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 12,
    minWidth: 150, overflow: "hidden", zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  dropdownItemActive: { backgroundColor: "#F3F4F6" },
  dropdownItemText: { fontSize: 14, fontWeight: "500", color: "#374151" },
  dropdownItemTextActive: { fontWeight: "700", color: "#000" },
  filterCount: { marginLeft: "auto", fontSize: 12, color: "#9CA3AF", fontWeight: "500" },

  // Cards
  list: { padding: 12, gap: 10, paddingBottom: 30 },
  card: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 2, borderColor: "transparent",
  },
  cardSelected: { borderColor: "#000" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  typeBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  cardPrice: { fontSize: 14, fontWeight: "700", color: "#000" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  cardMeta: { fontSize: 13, color: "#6B7280", flex: 1 },
  cardBottom: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6",
  },
  spotsText: { fontSize: 13, fontWeight: "700" },
  spotsTotal: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  joinBtn: { backgroundColor: "#000", paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  joinBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#000", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#9CA3AF", marginBottom: 20 },
  emptyBtn: { backgroundColor: "#000", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TextInput, Keyboard, Image, Platform,
  FlatList, TouchableOpacity, Dimensions, Alert, ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Session } from "../../types";
import { subscribeSessions } from "../../services/sessions";
import { askGo } from "../../services/insights";
import { Brand } from "../../constants/brand";
import { CourtPin, SpotsBlobs } from "../../components/brand-art";
import { F } from "../../constants/fonts";

const MAP_FRAME = require("../../assets/images/brand/map-frame.png");

const TYPE_COLORS: Record<string, string> = { beach: Brand.ink, grass: Brand.ink, indoor: Brand.ink };
type SessionType = "beach" | "grass" | "indoor";
type CourtFilter = "all" | SessionType;

// Buffalo / UB, used until the user's location is known
const DEFAULT_REGION = {
  latitude: 42.95,
  longitude: -78.82,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

const ASK_EXAMPLES = [
  "Free beach games tonight",
  "Indoor game tomorrow evening, intermediate",
  "Anything near me this weekend with open spots",
];

function spotsLeftColor(filled: number, total: number) {
  const ratio = filled / total;
  if (ratio >= 0.9) return Brand.red;
  return Brand.ink;
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
  const params = useLocalSearchParams<{ courtType?: string }>();
  useEffect(() => {
    if (params.courtType && ["beach", "grass", "indoor"].includes(params.courtType)) {
      setCourtFilter(params.courtType as CourtFilter);
    }
  }, [params.courtType]);
  const [dayFilter, setDayFilter] = useState<Date | null>(null);
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const [courtDropdownOpen, setCourtDropdownOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [, setLoadingLocation] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Ask GO! (Gemini search)
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);
  const [aiResult, setAiResult] = useState<{ reply: string; sessions: Session[] } | null>(null);
  const [askFocused, setAskFocused] = useState(false);

  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => { locationRef.current = userLocation; }, [userLocation]);

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

  // Upcoming games from Tiger Cloud, refreshed every 10s (expired games are
  // filtered out by the server, so no client-side cleanup is needed)
  useEffect(() => {
    return subscribeSessions(
      () => ({ lat: locationRef.current?.latitude, lng: locationRef.current?.longitude }),
      data => { setSessions(data); setSessionsLoading(false); },
      () => setSessionsLoading(false),
    );
  }, []);

  const runAsk = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    Keyboard.dismiss();
    setAskText(q);
    setAsking(true);
    try {
      const res = await askGo(q, userLocation);
      setAiResult({ reply: res.reply, sessions: res.sessions });
      setDayFilter(null);
      setCourtFilter("all");
      setSelectedId(null);
    } catch (e: any) {
      Alert.alert("Ask GO!", e?.message ?? "Search is unavailable right now.");
    } finally {
      setAsking(false);
    }
  };

  const clearAsk = () => { setAiResult(null); setAskText(""); };

  const baseSessions = aiResult ? aiResult.sessions : sessions;
  const filtered = useMemo(() => baseSessions.filter(s => {
    const courtMatch = courtFilter === "all" || s.type === courtFilter;
    let dayMatch = true;
    if (dayFilter) {
      const sd = new Date(s.sessionDate);
      dayMatch = sd.toDateString() === dayFilter.toDateString();
    }
    return courtMatch && dayMatch;
  }), [baseSessions, courtFilter, dayFilter]);

  const selectedDayLabel = dayFilter
    ? dayLabel(dayFilter, nextSevenDays.findIndex(d => d.toDateString() === dayFilter.toDateString()))
    : "All Days";

  const selectedCourtLabel = courtFilter === "all" ? "All Courts" :
    `${courtFilter.charAt(0).toUpperCase() + courtFilter.slice(1)}`;

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
    const typeColor = TYPE_COLORS[item.type] ?? "#7D7A73";
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "10", borderColor: typeColor }]}>
            <CourtPin type={item.type} size={16} />
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {item.type?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.cardPrice}>{item.price > 0 ? `$${item.price}/person` : "Free"}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.address ? (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={13} color="#7D7A73" />
            <Text style={styles.cardMeta}>
              {item.address}{item.distanceKm !== undefined ? ` · ${item.distanceKm} km` : ""}
            </Text>
          </View>
        ) : null}
        <View style={styles.cardRow}>
          <Ionicons name="time-outline" size={13} color="#7D7A73" />
          <Text style={styles.cardMeta}>
            {new Date(item.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            {" · "}{item.timeRange ?? item.duration}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="person-outline" size={13} color="#7D7A73" />
          <Text style={styles.cardMeta}>Hosted by {item.hostName} · {item.skillLevel}</Text>
        </View>
        <View style={styles.cardBottom}>
          <View>
            <Text style={[styles.spotsText, { color: spotsLeftColor(item.spotsFilled ?? 0, item.maxPlayers) }]}>
              {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
            </Text>
            <View style={{ marginTop: 4 }}>
              <SpotsBlobs filled={item.spotsFilled ?? 0} total={item.maxPlayers} size={16} max={10} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => router.push(`/session/${item.id}` as any)}
          >
            <Text style={styles.joinBtnText}>{spotsLeft > 0 ? "Join" : "View"}</Text>
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

      {/* Ask GO!: natural-language search (Gemini) */}
      <View style={styles.askBar}>
        <Ionicons name="sparkles" size={16} color="#7D7A73" />
        <TextInput
          style={styles.askInput}
          placeholder="Ask GO! e.g. free beach games tonight"
          placeholderTextColor="#A8A49C"
          value={askText}
          onChangeText={setAskText}
          onSubmitEditing={() => runAsk(askText)}
          onFocus={() => setAskFocused(true)}
          onBlur={() => setAskFocused(false)}
          returnKeyType="search"
        />
        {asking ? (
          <ActivityIndicator size="small" color="#000" />
        ) : aiResult || askText ? (
          <TouchableOpacity onPress={clearAsk} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#A8A49C" />
          </TouchableOpacity>
        ) : null}
      </View>
      {askFocused && !askText && !aiResult && (
        <View style={styles.askExamples}>
          {ASK_EXAMPLES.map(ex => (
            <TouchableOpacity key={ex} style={styles.askChip} onPress={() => runAsk(ex)}>
              <Text style={styles.askChipText}>{ex}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {aiResult && (
        <View style={styles.aiBanner}>
          <Text style={styles.aiBannerText}>{aiResult.reply}</Text>
          <TouchableOpacity onPress={clearAsk}>
            <Text style={styles.aiBannerClear}>Show all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* The map sits inside the hand-drawn window frame */}
      <View style={styles.mapFrame}>
        <View style={styles.mapWindow}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton={false}
            onPress={closeDropdowns}
          >
            {filtered.map(session => (
              <Marker key={session.id} coordinate={session.coordinate} onPress={() => handleMarkerPress(session)}>
                <View style={[styles.pin, selectedId === session.id && styles.pinSelected]}>
                  <CourtPin type={session.type} size={selectedId === session.id ? 30 : 24} />
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={MAP_FRAME} style={styles.mapFrameArt} resizeMode="stretch" />
        </View>
      </View>

      <View style={styles.filterBar}>
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
              color={dayFilter ? "#FFF" : "#3A3833"}
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
              color={courtFilter !== "all" ? "#FFF" : "#3A3833"}
            />
          </TouchableOpacity>
          {courtDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {(["all", "indoor", "grass", "beach"] as CourtFilter[]).map(c => {
                const isActive = courtFilter === c;
                const label = c === "all" ? "All Courts" :
                  `${c.charAt(0).toUpperCase() + c.slice(1)}`;
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
              <Text style={styles.emptyTitle}>{aiResult ? "No matching games" : "No sessions nearby"}</Text>
              <Text style={styles.emptySubtitle}>
                {aiResult ? "Try a different search, or host one yourself!" : "Be the first to host one!"}
              </Text>
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
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  headerTitle: { fontFamily: F.w800, fontSize: 22, color: "#000" },
  addBtn: {
    backgroundColor: "#000", width: 34, height: 34, borderRadius: 17,
    justifyContent: "center", alignItems: "center",
  },
  mapFrame: { marginHorizontal: 12, marginTop: 4, aspectRatio: 1.156 },
  // Inner window of the drawing (below the header bar, inside the side lines)
  mapWindow: {
    position: "absolute", top: "11.5%", left: "2.1%", right: "2.6%", bottom: "1.5%",
    overflow: "hidden", backgroundColor: "#F5F3EF",
  },
  mapFrameArt: { width: "100%", height: "100%" },

  askBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginVertical: 8, paddingHorizontal: 12,
    backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "#ECE9E3",
  },
  askInput: { fontFamily: F.w400, flex: 1, paddingVertical: 10, fontSize: 16, color: "#000" },
  askExamples: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  askChip: { backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1, borderColor: "#ECE9E3", paddingHorizontal: 10, paddingVertical: 6 },
  askChipText: { fontFamily: F.w400, fontSize: 13, color: "#3A3833" },
  aiBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 12, marginBottom: 8, padding: 10,
    backgroundColor: "#000", borderRadius: 10,
  },
  aiBannerText: { fontFamily: F.w600, flex: 1, color: "#FFF", fontSize: 15, },
  aiBannerClear: { fontFamily: F.w700, color: "#A8A49C", fontSize: 13, },
  pin: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "#FFF", borderWidth: 2, borderColor: "#111111",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  pinSelected: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: "#D0341A" },
  pinText: { fontFamily: F.w400, fontSize: 18 },

  filterBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
    gap: 8, zIndex: 10,
  },
  dropdownWrapper: {
    position: "relative", zIndex: 1,
  },
  dropdownTrigger: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: "#ECE9E3",
    backgroundColor: "#FFF",
  },
  dropdownTriggerActive: { backgroundColor: "#000", borderColor: "#000" },
  dropdownTriggerText: { fontFamily: F.w600, fontSize: 15, color: "#3A3833" },
  dropdownTriggerTextActive: { color: "#FFF" },
  dropdownMenu: {
    position: "absolute", top: 38, left: 0,
    backgroundColor: "#FFF", borderRadius: 12,
    borderWidth: 1, borderColor: "#ECE9E3",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 12,
    minWidth: 150, overflow: "hidden", zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: "#F5F3EF",
  },
  dropdownItemActive: { backgroundColor: "#F5F3EF" },
  dropdownItemText: { fontFamily: F.w500, fontSize: 16, color: "#3A3833" },
  dropdownItemTextActive: { fontFamily: F.w700, color: "#000" },
  filterCount: { fontFamily: F.w500, marginLeft: "auto", fontSize: 13, color: "#A8A49C", },

  list: { padding: 12, gap: 10, paddingBottom: 30 },
  card: {
    backgroundColor: "#FFF", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 2, borderColor: "transparent",
  },
  cardSelected: { borderColor: "#000" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  typeBadgeText: { fontFamily: F.w700, fontSize: 12, letterSpacing: 0.5 },
  cardPrice: { fontFamily: F.w700, fontSize: 16, color: "#000" },
  cardTitle: { fontFamily: F.w700, fontSize: 18, color: "#000", marginBottom: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  cardMeta: { fontFamily: F.w400, fontSize: 15, color: "#7D7A73", flex: 1 },
  cardBottom: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F5F3EF",
  },
  spotsText: { fontFamily: F.w700, fontSize: 15, },
  spotsTotal: { fontFamily: F.w400, fontSize: 12, color: "#A8A49C", marginTop: 2 },
  joinBtn: { backgroundColor: "#000", paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  joinBtnText: { fontFamily: F.w700, color: "#FFF", fontSize: 16 },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyEmoji: { fontFamily: F.w400, fontSize: 54, marginBottom: 12 },
  emptyTitle: { fontFamily: F.w700, fontSize: 20, color: "#000", marginBottom: 6 },
  emptySubtitle: { fontFamily: F.w400, fontSize: 16, color: "#A8A49C", marginBottom: 20 },
  emptyBtn: { backgroundColor: "#000", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontFamily: F.w700, color: "#FFF", fontSize: 17 },
});

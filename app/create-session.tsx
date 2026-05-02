import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions, Modal,
} from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  collection, doc, serverTimestamp, Timestamp,
  writeBatch, increment, getDoc,
} from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";

const { height } = Dimensions.get("window");

const COURT_TYPES = [
  { value: "beach",  label: "Beach",  icon: "🏖️" },
  { value: "grass",  label: "Grass",  icon: "🌿" },
  { value: "indoor", label: "Indoor", icon: "🏐" },
] as const;

const SKILL_LEVELS = ["Social", "Beginner", "Intermediate", "Mid-Intermediate", "Advanced", "Pro"];

const HOURS   = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];
const AMPM    = ["AM","PM"];

const ITEM_H = 52;

function buildDateOptions(): { label: string; date: Date }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow"
      : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return { label, date: d };
  });
}
const DATE_OPTIONS = buildDateOptions();

type CourtType = "beach" | "grass" | "indoor";

const DEFAULT_REGION = {
  latitude: 34.0522, longitude: -118.3790,
  latitudeDelta: 0.05, longitudeDelta: 0.05,
};

function timeToMinutes(t: string): number {
  const [time, ampm] = t.split(" ");
  const [h, m] = time.split(":").map(Number);
  let hours = h;
  if (ampm === "PM" && h !== 12) hours += 12;
  if (ampm === "AM" && h === 12) hours = 0;
  return hours * 60 + m;
}

function computeDuration(start: string, end: string): string {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60), m = diff % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Drum-roll wheel picker ────────────────────────────────────────────────────
function WheelPicker({ items, value, onChange, width = 72 }: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  width?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const initIdx = Math.max(0, items.indexOf(value));
  const [activeIdx, setActiveIdx] = useState(initIdx);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.scrollTo({ y: initIdx * ITEM_H, animated: false });
    }, 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snap = (y: number) => {
    const idx = Math.max(0, Math.min(Math.round(y / ITEM_H), items.length - 1));
    setActiveIdx(idx);
    onChange(items[idx]);
  };

  return (
    <View style={{ width, height: ITEM_H * 5, overflow: "hidden" }}>
      {/* selection band */}
      <View pointerEvents="none" style={[
        StyleSheet.absoluteFill,
        {
          top: ITEM_H * 2, bottom: ITEM_H * 2,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D1D5DB",
          height: ITEM_H, position: "absolute",
        },
      ]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        scrollEventThrottle={16}
        onScroll={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          setActiveIdx(Math.max(0, Math.min(idx, items.length - 1)));
        }}
        onMomentumScrollEnd={e => snap(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => snap(e.nativeEvent.contentOffset.y)}
      >
        {items.map((item, i) => (
          <View key={i} style={{ height: ITEM_H, justifyContent: "center", alignItems: "center" }}>
            <Text style={{
              fontSize: i === activeIdx ? 22 : 18,
              fontWeight: i === activeIdx ? "700" : "400",
              color: i === activeIdx ? "#000" : "#9CA3AF",
            }}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Time picker modal ─────────────────────────────────────────────────────────
function TimePickerModal({ visible, initial, label, onConfirm, onCancel }: {
  visible: boolean;
  initial: string | null;
  label: string;
  onConfirm: (time: string) => void;
  onCancel: () => void;
}) {
  const parseInitial = () => {
    if (!initial) return { h: "6", m: "00", ap: "PM" };
    const [time, ap] = initial.split(" ");
    const [h, m] = time.split(":");
    return { h, m, ap };
  };

  const init = parseInitial();
  const [hour, setHour]   = useState(init.h);
  const [minute, setMin]  = useState(init.m);
  const [ampm, setAmPm]   = useState(init.ap);

  useEffect(() => {
    if (visible) {
      const p = parseInitial();
      setHour(p.h); setMin(p.m); setAmPm(p.ap);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modal.overlay}>
        <View style={modal.card}>
          <Text style={modal.title}>{label}</Text>

          <View style={modal.wheelRow}>
            <WheelPicker items={HOURS}   value={hour}   onChange={setHour}   width={64} />
            <Text style={modal.colon}>:</Text>
            <WheelPicker items={MINUTES} value={minute} onChange={setMin}    width={64} />
            <WheelPicker items={AMPM}    value={ampm}   onChange={setAmPm}   width={64} />
          </View>

          <TouchableOpacity
            style={modal.confirmBtn}
            onPress={() => onConfirm(`${hour}:${minute} ${ampm}`)}
          >
            <Text style={modal.confirmText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={modal.cancelTouch}>
            <Text style={modal.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Dropdown modal ─────────────────────────────────────────────────────────────
function DropdownModal<T extends string>({ visible, options, selected, onSelect, onClose }: {
  visible: boolean;
  options: { label: string; value: T }[];
  selected: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose}>
        <View style={modal.dropdownCard}>
          {options.map(opt => {
            const active = opt.value === selected;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[modal.dropdownItem, active && modal.dropdownItemActive]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                <Text style={[modal.dropdownItemText, active && modal.dropdownItemTextActive]}>
                  {opt.label}
                </Text>
                {active && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CreateSessionScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = auth.currentUser?.uid ?? "";

  const [pin, setPin]           = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress]   = useState("");
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [locationReady, setLocationReady] = useState(false);

  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [price, setPrice]         = useState("");
  const [courtType, setCourtType] = useState<CourtType>("beach");
  const [skillLevel, setSkill]    = useState("Social");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime]     = useState<string | null>(null);
  const [maxPlayers, setMax]      = useState(6);
  const [dateIdx, setDateIdx]     = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Dropdown / modal visibility
  const [dateOpen, setDateOpen]   = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        const region = { ...coord, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setMapRegion(region);
        setPin(coord);
        setLocationReady(true);
        mapRef.current?.animateToRegion(region, 500);
        reverseGeocode(coord);
      } else {
        setLocationReady(true);
      }
    })();
    return () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); };
  }, []);

  const reverseGeocode = (coord: { latitude: number; longitude: number }) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync(coord);
        if (results[0]) {
          const { street, city, region } = results[0];
          setAddress([street, city, region].filter(Boolean).join(", "));
        }
      } catch {}
    }, 300);
  };

  const handleMapPress = (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    setPin(coord);
    reverseGeocode(coord);
  };

  const handleDragEnd = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setPin(coord);
    reverseGeocode(coord);
  };

  const duration = startTime && endTime ? computeDuration(startTime, endTime) : null;
  const timeValid = startTime && endTime && timeToMinutes(endTime) > timeToMinutes(startTime);

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert("Missing Info", "Please enter a session name."); return; }
    if (!pin)          { Alert.alert("Pin Required", "Tap the map to drop a pin."); return; }
    if (!startTime || !endTime) { Alert.alert("Missing Time", "Please set a start and end time."); return; }
    if (!timeValid)    { Alert.alert("Invalid Time", "End time must be after start time."); return; }

    const parsedPrice = parseFloat(price) || 0;
    const sessionDate = Timestamp.fromDate(DATE_OPTIONS[dateIdx].date);
    const durationStr = computeDuration(startTime, endTime);
    const timeRange   = `${startTime} – ${endTime}`;

    setSubmitting(true);
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      const userData = userSnap.data();
      const hostName = userData?.name || auth.currentUser?.email?.split("@")[0] || "Anonymous";
      const hostInitials = hostName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

      const batch = writeBatch(db);

      const sessionRef = doc(collection(db, "sessions"));
      batch.set(sessionRef, {
        hostId: uid, hostName, hostInitials,
        title: title.trim(), description: description.trim(),
        type: courtType, price: parsedPrice, skillLevel,
        startTime, endTime, duration: durationStr, timeRange,
        maxPlayers, spotsFilled: 0,
        coordinate: { latitude: pin.latitude, longitude: pin.longitude },
        address: address || "See map",
        sessionDate, createdAt: serverTimestamp(), active: true,
      });

      const postRef = doc(collection(db, "posts"));
      batch.set(postRef, {
        type: "session", authorId: uid, authorName: hostName, authorInitials: hostInitials,
        authorPosition: userData?.positions?.[0] || userData?.experience || "Player",
        content: title.trim(), likes: 0, likedBy: [], comments: 0,
        createdAt: serverTimestamp(), sessionId: sessionRef.id,
        sessionType: courtType, sessionLocation: address || "See map",
        sessionPrice: parsedPrice, sessionSkillLevel: skillLevel,
        sessionDuration: durationStr, sessionTimeRange: timeRange,
      });

      batch.update(doc(db, "users", uid), { sessionsHosted: increment(1) });
      await batch.commit();
      router.replace("/(tabs)/map" as any);
    } catch (e: any) {
      Alert.alert("Error", "Could not create session. Try again.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const dateOptions = DATE_OPTIONS.map((o, i) => ({ label: o.label, value: String(i) }));
  const skillOptions = SKILL_LEVELS.map(s => ({ label: s, value: s }));

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Session</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Map */}
          <View style={styles.mapSection}>
            <Text style={styles.mapLabel}>Tap to place pin · Drag to fine-tune</Text>
            <View style={styles.mapWrapper}>
              {!locationReady && (
                <View style={styles.mapOverlay}><ActivityIndicator color="#000" /></View>
              )}
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={mapRegion}
                onPress={handleMapPress}
                showsUserLocation
              >
                {pin && (
                  <Marker coordinate={pin} draggable onDragEnd={handleDragEnd} pinColor="#000" />
                )}
              </MapView>
            </View>
            {address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color="#6B7280" />
                <Text style={styles.addressText}>{address}</Text>
              </View>
            ) : (
              <Text style={styles.addressHint}>Tap the map to place your pin</Text>
            )}
          </View>

          <View style={styles.formSection}>
            {/* Date */}
            <View style={styles.field}>
              <Text style={styles.label}>Session Date</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setDateOpen(true)}>
                <Text style={styles.dropdownBtnText}>{DATE_OPTIONS[dateIdx].label}</Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Time */}
            <View style={styles.field}>
              <View style={styles.timeLabelRow}>
                <Text style={styles.label}>Time</Text>
                {duration && timeValid ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationBadgeText}>{duration}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.timeRow}>
                <TouchableOpacity
                  style={[styles.timeTrigger, startTime && styles.timeTriggerFilled]}
                  onPress={() => setTimePicker("start")}
                >
                  <Ionicons name="time-outline" size={15} color={startTime ? "#000" : "#9CA3AF"} />
                  <Text style={[styles.timeTriggerText, startTime && styles.timeTriggerTextFilled]}>
                    {startTime ?? "Start time"}
                  </Text>
                </TouchableOpacity>

                <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />

                <TouchableOpacity
                  style={[styles.timeTrigger, endTime && styles.timeTriggerFilled]}
                  onPress={() => setTimePicker("end")}
                >
                  <Ionicons name="time-outline" size={15} color={endTime ? "#000" : "#9CA3AF"} />
                  <Text style={[styles.timeTriggerText, endTime && styles.timeTriggerTextFilled]}>
                    {endTime ?? "End time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {startTime && endTime && !timeValid && (
                <Text style={styles.timeError}>End time must be after start time</Text>
              )}
            </View>

            {/* Session Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Session Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sunset Beach 4v4"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Description <Text style={styles.labelOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any extra details — skill expectations, what to bring, parking..."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Court Type */}
            <View style={styles.field}>
              <Text style={styles.label}>Court Type</Text>
              <View style={styles.chipRow}>
                {COURT_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.value}
                    style={[styles.chip, courtType === ct.value && styles.chipActive]}
                    onPress={() => setCourtType(ct.value)}
                  >
                    <Text style={styles.chipIcon}>{ct.icon}</Text>
                    <Text style={[styles.chipText, courtType === ct.value && styles.chipTextActive]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Skill Level */}
            <View style={styles.field}>
              <Text style={styles.label}>Skill Level</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSkillOpen(true)}>
                <Text style={styles.dropdownBtnText}>{skillLevel}</Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Max Players */}
            <View style={styles.field}>
              <View style={styles.sliderLabelRow}>
                <Text style={styles.label}>Max Players</Text>
                <View style={styles.sliderValueBadge}>
                  <Text style={styles.sliderValueText}>{maxPlayers}</Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={2} maximumValue={24} step={1}
                value={maxPlayers}
                onValueChange={v => setMax(Math.round(v))}
                minimumTrackTintColor="#000"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#000"
              />
              <View style={styles.sliderTicks}>
                {["2", "8", "16", "24"].map(t => (
                  <Text key={t} style={styles.sliderTick}>{t}</Text>
                ))}
              </View>
            </View>

            {/* Price */}
            <View style={styles.field}>
              <Text style={styles.label}>Price per Person</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceDollar}>$</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0 for free"
                  placeholderTextColor="#9CA3AF"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity onPress={() => setPrice("0")} style={styles.freeBtn}>
                <Text style={styles.freeBtnText}>Set as Free</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.submitBtnText}>Create Session</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Date dropdown */}
      <DropdownModal
        visible={dateOpen}
        options={dateOptions}
        selected={String(dateIdx)}
        onSelect={v => setDateIdx(Number(v))}
        onClose={() => setDateOpen(false)}
      />

      {/* Skill dropdown */}
      <DropdownModal
        visible={skillOpen}
        options={skillOptions}
        selected={skillLevel}
        onSelect={setSkill}
        onClose={() => setSkillOpen(false)}
      />

      {/* Time picker */}
      <TimePickerModal
        visible={timePicker !== null}
        initial={timePicker === "start" ? startTime : endTime}
        label={timePicker === "start" ? "Start Time" : "End Time"}
        onConfirm={t => {
          if (timePicker === "start") setStartTime(t);
          else setEndTime(t);
          setTimePicker(null);
        }}
        onCancel={() => setTimePicker(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#000" },
  scroll: { paddingBottom: 20 },
  mapSection: { backgroundColor: "#FFF", marginBottom: 12, padding: 16 },
  mapLabel: { fontSize: 14, fontWeight: "600", color: "#000", marginBottom: 10 },
  mapWrapper: { borderRadius: 14, overflow: "hidden", height: height * 0.28 },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  addressText: { fontSize: 13, color: "#6B7280", flex: 1 },
  addressHint: { fontSize: 13, color: "#9CA3AF", marginTop: 10, textAlign: "center" },
  formSection: { backgroundColor: "#FFF", padding: 16 },
  field: { marginBottom: 22 },
  label: { fontSize: 14, fontWeight: "700", color: "#000", marginBottom: 10 },
  labelOptional: { fontSize: 12, color: "#9CA3AF", fontWeight: "400" },
  input: {
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, padding: 14, fontSize: 15, color: "#000",
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  chipActive: { backgroundColor: "#000", borderColor: "#000" },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#FFF" },

  // Dropdown button
  dropdownBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  dropdownBtnText: { fontSize: 15, fontWeight: "600", color: "#000" },

  // Time row
  timeLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  durationBadge: { backgroundColor: "#000", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  durationBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeTrigger: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13,
  },
  timeTriggerFilled: { borderColor: "#000", backgroundColor: "#FFF" },
  timeTriggerText: { fontSize: 14, fontWeight: "500", color: "#9CA3AF" },
  timeTriggerTextFilled: { color: "#000", fontWeight: "600" },
  timeError: { fontSize: 12, color: "#EF4444", marginTop: 6 },

  // Slider
  sliderLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sliderValueBadge: { backgroundColor: "#000", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  sliderValueText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  slider: { width: "100%", height: 40 },
  sliderTicks: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: -4 },
  sliderTick: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },

  // Price
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceDollar: { fontSize: 18, fontWeight: "700", color: "#000" },
  freeBtn: { marginTop: 8 },
  freeBtnText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },

  footer: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E5E7EB",
  },
  submitBtn: { backgroundColor: "#000", paddingVertical: 18, borderRadius: 14, alignItems: "center" },
  submitBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    backgroundColor: "#FFF", borderRadius: 20,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20,
    width: "100%", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#000", marginBottom: 20 },
  wheelRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginBottom: 24,
  },
  colon: { fontSize: 28, fontWeight: "700", color: "#000", marginBottom: 4, paddingHorizontal: 2 },
  confirmBtn: {
    backgroundColor: "#000", width: "100%", paddingVertical: 15,
    borderRadius: 14, alignItems: "center", marginBottom: 10,
  },
  confirmText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  cancelTouch: { paddingVertical: 6 },
  cancelText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600" },

  // Dropdown modal
  dropdownCard: {
    backgroundColor: "#FFF", borderRadius: 16,
    width: "100%", overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  dropdownItemActive: { backgroundColor: "#000" },
  dropdownItemText: { fontSize: 15, fontWeight: "500", color: "#374151" },
  dropdownItemTextActive: { color: "#FFF", fontWeight: "700" },
});

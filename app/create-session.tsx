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
import { createSession, localDateString } from "../services/sessions";
import { CourtScene } from "../components/brand-art";
import { F } from "../constants/fonts";

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

// Buffalo / UB, used until the user's location is known
const DEFAULT_REGION = {
  latitude: 42.95, longitude: -78.82,
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
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Drum-roll wheel picker
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
      <View pointerEvents="none" style={[
        StyleSheet.absoluteFill,
        {
          top: ITEM_H * 2, bottom: ITEM_H * 2,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D9D5CD",
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
              fontFamily: i === activeIdx ? F.w700 : F.w400,
              color: i === activeIdx ? "#000" : "#A8A49C",
            }}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Time picker modal
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

// Dropdown modal
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

// Main screen
export default function CreateSessionScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    setSubmitting(true);
    try {
      await createSession({
        title: title.trim(),
        description: description.trim(),
        type: courtType,
        price: parseFloat(price) || 0,
        skillLevel,
        date: localDateString(DATE_OPTIONS[dateIdx].date),
        startTime,
        endTime,
        maxPlayers,
        coordinate: { latitude: pin.latitude, longitude: pin.longitude },
        address: address || "See map",
      });
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
                <Ionicons name="location" size={14} color="#7D7A73" />
                <Text style={styles.addressText}>{address}</Text>
              </View>
            ) : (
              <Text style={styles.addressHint}>Tap the map to place your pin</Text>
            )}
          </View>

          <View style={styles.formSection}>
            <View style={styles.field}>
              <Text style={styles.label}>Session Date</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setDateOpen(true)}>
                <Text style={styles.dropdownBtnText}>{DATE_OPTIONS[dateIdx].label}</Text>
                <Ionicons name="chevron-down" size={16} color="#7D7A73" />
              </TouchableOpacity>
            </View>

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
                  <Ionicons name="time-outline" size={15} color={startTime ? "#000" : "#A8A49C"} />
                  <Text style={[styles.timeTriggerText, startTime && styles.timeTriggerTextFilled]}>
                    {startTime ?? "Start time"}
                  </Text>
                </TouchableOpacity>

                <Ionicons name="arrow-forward" size={14} color="#A8A49C" />

                <TouchableOpacity
                  style={[styles.timeTrigger, endTime && styles.timeTriggerFilled]}
                  onPress={() => setTimePicker("end")}
                >
                  <Ionicons name="time-outline" size={15} color={endTime ? "#000" : "#A8A49C"} />
                  <Text style={[styles.timeTriggerText, endTime && styles.timeTriggerTextFilled]}>
                    {endTime ?? "End time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {startTime && endTime && !timeValid && (
                <Text style={styles.timeError}>End time must be after start time</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Session Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sunset Beach 4v4"
                placeholderTextColor="#A8A49C"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Description <Text style={styles.labelOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any extra details — skill expectations, what to bring, parking..."
                placeholderTextColor="#A8A49C"
                value={description}
                onChangeText={setDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Court Type</Text>
              <View style={styles.chipRow}>
                {COURT_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct.value}
                    style={[styles.courtTile, courtType === ct.value && styles.courtTileActive]}
                    onPress={() => setCourtType(ct.value)}
                  >
                    <CourtScene type={ct.value} height={56} />
                    <Text style={[styles.chipText, courtType === ct.value && styles.courtTileTextActive]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Skill Level</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSkillOpen(true)}>
                <Text style={styles.dropdownBtnText}>{skillLevel}</Text>
                <Ionicons name="chevron-down" size={16} color="#7D7A73" />
              </TouchableOpacity>
            </View>

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
                maximumTrackTintColor="#ECE9E3"
                thumbTintColor="#000"
              />
              <View style={styles.sliderTicks}>
                {["2", "8", "16", "24"].map(t => (
                  <Text key={t} style={styles.sliderTick}>{t}</Text>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Price per Person</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceDollar}>$</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0 for free"
                  placeholderTextColor="#A8A49C"
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

      <DropdownModal
        visible={dateOpen}
        options={dateOptions}
        selected={String(dateIdx)}
        onSelect={v => setDateIdx(Number(v))}
        onClose={() => setDateOpen(false)}
      />

      <DropdownModal
        visible={skillOpen}
        options={skillOptions}
        selected={skillLevel}
        onSelect={setSkill}
        onClose={() => setSkillOpen(false)}
      />

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

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#ECE9E3",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: F.w800, fontSize: 20, color: "#000" },
  scroll: { paddingBottom: 20 },
  mapSection: { backgroundColor: "#FFF", marginBottom: 12, padding: 16 },
  mapLabel: { fontFamily: F.w600, fontSize: 16, color: "#000", marginBottom: 10 },
  mapWrapper: { borderRadius: 14, overflow: "hidden", height: height * 0.28 },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F5F3EF", justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  addressText: { fontFamily: F.w400, fontSize: 15, color: "#7D7A73", flex: 1 },
  addressHint: { fontFamily: F.w400, fontSize: 15, color: "#A8A49C", marginTop: 10, textAlign: "center" },
  formSection: { backgroundColor: "#FFF", padding: 16 },
  field: { marginBottom: 22 },
  label: { fontFamily: F.w700, fontSize: 16, color: "#000", marginBottom: 10 },
  labelOptional: { fontFamily: F.w400, fontSize: 13, color: "#A8A49C", },
  input: {
    fontFamily: F.w400,
    backgroundColor: "#FAF9F6", borderWidth: 1, borderColor: "#ECE9E3",
    borderRadius: 12, padding: 14, fontSize: 17, color: "#000",
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: "#ECE9E3", backgroundColor: "#FAF9F6",
  },
  courtTile: {
    flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 14, borderWidth: 1.5, borderColor: "#ECE9E3", backgroundColor: "#FFF",
  },
  courtTileActive: { borderColor: "#D0341A", borderWidth: 2 },
  courtTileTextActive: { fontFamily: F.w800, color: "#111111", },
  chipActive: { backgroundColor: "#000", borderColor: "#000" },
  chipIcon: { fontFamily: F.w400, fontSize: 16 },
  chipText: { fontFamily: F.w600, fontSize: 15, color: "#3A3833" },
  chipTextActive: { color: "#FFF" },

  dropdownBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FAF9F6", borderWidth: 1, borderColor: "#ECE9E3",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  dropdownBtnText: { fontFamily: F.w600, fontSize: 17, color: "#000" },

  timeLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  durationBadge: { backgroundColor: "#000", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  durationBadgeText: { fontFamily: F.w700, color: "#FFF", fontSize: 13, },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeTrigger: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FAF9F6", borderWidth: 1, borderColor: "#ECE9E3",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13,
  },
  timeTriggerFilled: { borderColor: "#000", backgroundColor: "#FFF" },
  timeTriggerText: { fontFamily: F.w500, fontSize: 16, color: "#A8A49C" },
  timeTriggerTextFilled: { fontFamily: F.w600, color: "#000", },
  timeError: { fontFamily: F.w400, fontSize: 13, color: "#D0341A", marginTop: 6 },

  sliderLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sliderValueBadge: { backgroundColor: "#000", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  sliderValueText: { fontFamily: F.w800, color: "#FFF", fontSize: 16 },
  slider: { width: "100%", height: 40 },
  sliderTicks: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: -4 },
  sliderTick: { fontFamily: F.w500, fontSize: 12, color: "#A8A49C", },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceDollar: { fontFamily: F.w700, fontSize: 20, color: "#000" },
  freeBtn: { marginTop: 8 },
  freeBtnText: { fontFamily: F.w600, fontSize: 15, color: "#7D7A73", },

  footer: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#ECE9E3",
  },
  submitBtn: { backgroundColor: "#000", paddingVertical: 18, borderRadius: 14, alignItems: "center" },
  submitBtnText: { fontFamily: F.w800, color: "#FFF", fontSize: 18, letterSpacing: 0.5 },
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
  title: { fontFamily: F.w800, fontSize: 19, color: "#000", marginBottom: 20 },
  wheelRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginBottom: 24,
  },
  colon: { fontFamily: F.w700, fontSize: 31, color: "#000", marginBottom: 4, paddingHorizontal: 2 },
  confirmBtn: {
    backgroundColor: "#000", width: "100%", paddingVertical: 15,
    borderRadius: 14, alignItems: "center", marginBottom: 10,
  },
  confirmText: { fontFamily: F.w800, color: "#FFF", fontSize: 18 },
  cancelTouch: { paddingVertical: 6 },
  cancelText: { fontFamily: F.w600, color: "#A8A49C", fontSize: 16, },

  dropdownCard: {
    backgroundColor: "#FFF", borderRadius: 16,
    width: "100%", overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: "#F5F3EF",
  },
  dropdownItemActive: { backgroundColor: "#000" },
  dropdownItemText: { fontFamily: F.w500, fontSize: 17, color: "#3A3833" },
  dropdownItemTextActive: { fontFamily: F.w700, color: "#FFF", },
});

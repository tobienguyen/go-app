import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Session } from "../types";
import { CourtScene } from "./brand-art";
import { F } from "../constants/fonts";

// Ticket-style pass for a game the player has joined.

const LOGO = require("../assets/images/logo-mark.png");
const BACKDROP = "#F5F3EF";
const RED = "#D0341A", INK = "#111111", CANVAS = "#F5F3EF", LINE = "#ECE9E3", MUTED = "#7D7A73";

// Deterministic "barcode" so each game's pass looks unique
function stripes(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: 34 }, () => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return 1 + (Math.abs(h) % 3);
  });
}

export function GamePass({ session, playerName, uid, notchColor = CANVAS }: {
  session: Session;
  playerName: string;
  uid: string;
  notchColor?: string;
}) {
  const start = new Date(session.sessionDate);
  const day = start.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const date = start.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const attendees = session.attendees ?? [];
  const spot = attendees.indexOf(uid) >= 0 ? attendees.indexOf(uid) + 1 : attendees.length;
  const bars = useMemo(() => stripes(session.id), [session.id]);

  return (
    <View style={styles.pass}>
      <View style={styles.band}>
        <Image source={LOGO} style={styles.bandLogo} />
        <Text style={styles.bandText}>GAME PASS</Text>
        <Text style={styles.bandType}>{session.type?.toUpperCase()}</Text>
      </View>

      <View style={styles.top}>
        <CourtScene type={session.type} height={100} />
        <Text style={styles.title} numberOfLines={2}>{session.title}</Text>
        <View style={styles.dateRow}>
          <Text style={styles.day}>{day}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <Text style={styles.time}>{session.timeRange}</Text>
        <Text style={styles.place} numberOfLines={1}>{session.courtName ?? session.address}</Text>
      </View>

      <View style={styles.perfRow}>
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: notchColor }]} />
        <View style={styles.perfLine} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: notchColor }]} />
      </View>

      <View style={styles.stub}>
        <View style={styles.stubGrid}>
          <Field label="PLAYER" value={playerName} />
          <Field label="SPOT" value={`${Math.max(spot, 1)} of ${session.maxPlayers}`} />
          <Field label="HOST" value={session.hostName} />
          <Field label="PRICE" value={session.price > 0 ? `$${session.price}` : "Free"} />
        </View>
        <View style={styles.barcode}>
          {bars.map((w, i) => (
            <View key={i} style={{ width: w * 2, height: 34, backgroundColor: i % 2 ? "transparent" : INK }} />
          ))}
        </View>
        <Text style={styles.hint}>Show this at the court · see you there!</Text>
      </View>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Slides up right after the player joins. */
export function GamePassModal({ visible, session, playerName, uid, onClose }: {
  visible: boolean;
  session: Session | null;
  playerName: string;
  uid: string;
  onClose: () => void;
}) {
  if (!session) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Text style={styles.youreIn}>You're in!</Text>
        <GamePass session={session} playerName={playerName} uid={uid} notchColor={BACKDROP} />
        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pass: { backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1, borderColor: LINE, overflow: "hidden", marginBottom: 14 },
  band: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: RED, paddingHorizontal: 14, paddingVertical: 8 },
  bandLogo: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFF" },
  bandText: { fontFamily: F.w800, flex: 1, color: "#FFF", fontSize: 15, letterSpacing: 2 },
  bandType: { fontFamily: F.w700, color: "#FFF", fontSize: 12, letterSpacing: 1, opacity: 0.85 },
  top: { padding: 16, paddingBottom: 12, alignItems: "center" },
  title: { fontFamily: F.w800, fontSize: 20, color: INK, textAlign: "center", marginTop: 8 },
  dateRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  day: { fontFamily: F.w800, fontSize: 16, color: RED, letterSpacing: 1 },
  date: { fontFamily: F.w900, fontSize: 34, color: INK, letterSpacing: 0.5 },
  time: { fontFamily: F.w600, fontSize: 17, color: INK, marginTop: 2 },
  place: { fontFamily: F.w400, fontSize: 15, color: MUTED, marginTop: 4 },
  perfRow: { flexDirection: "row", alignItems: "center", height: 24 },
  notch: { width: 24, height: 24, borderRadius: 12, position: "absolute" },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  perfLine: { flex: 1, marginHorizontal: 18, borderTopWidth: 2, borderColor: LINE, borderStyle: "dashed" },
  stub: { padding: 16, paddingTop: 10, alignItems: "center" },
  stubGrid: { flexDirection: "row", flexWrap: "wrap", width: "100%", rowGap: 10 },
  field: { width: "50%" },
  fieldLabel: { fontFamily: F.w800, fontSize: 11, color: MUTED, letterSpacing: 1.5 },
  fieldValue: { fontFamily: F.w700, fontSize: 17, color: INK, marginTop: 2 },
  barcode: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 14 },
  hint: { fontFamily: F.w400, fontSize: 12, color: MUTED, marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: BACKDROP, justifyContent: "center", padding: 22 },
  youreIn: { fontFamily: F.w900, color: "#111111", fontSize: 29, textAlign: "center", marginBottom: 14 },
  doneBtn: { backgroundColor: "#111111", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  doneText: { fontFamily: F.w800, fontSize: 18, color: "#FFF" },
});

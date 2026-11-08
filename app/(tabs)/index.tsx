import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { listSessions } from "../../services/sessions";
import { getTopCourts } from "../../services/insights";
import { COURT_SCENES, CourtPin } from "../../components/brand-art";
import { F } from "../../constants/fonts";

// Home: what GO! is about, the three kinds of courts, and what's busy right now.

const COURTS = [
  { type: "beach", label: "Beach", blurb: "Sand between your toes, sun on the court." },
  { type: "grass", label: "Grass", blurb: "Park games under the trees, all summer long." },
  { type: "indoor", label: "Indoor", blurb: "Gym runs, any weather, any season." },
] as const;

type TopCourt = { courtName: string; courtType: string; activity: number };

export default function HomeScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [topCourts, setTopCourts] = useState<TopCourt[]>([]);

  // Refresh the live numbers whenever Home comes into view
  useFocusEffect(useCallback(() => {
    listSessions().then(sessions => {
      const c: Record<string, number> = {};
      sessions.forEach(s => { c[s.type] = (c[s.type] ?? 0) + 1; });
      setCounts(c);
    }).catch(() => {});
    getTopCourts().then(r => setTopCourts(r.topCourts.slice(0, 3))).catch(() => {});
  }, []));

  const openMap = (courtType?: string) =>
    router.navigate({ pathname: "/(tabs)/map", params: courtType ? { courtType } : {} } as any);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={require("../../assets/images/logo-mark.png")} style={styles.logo} />
          <Text style={styles.tagline}>Find your next{"\n"}pickup game.</Text>
          <View style={styles.redDot} />
        </View>

        <Text style={styles.mission}>
          Pickup volleyball, made accessible and affordable. GO! puts every game on one map, so you
          can see who's playing, where, and when, and just show up.
        </Text>

        {COURTS.map(c => (
          <TouchableOpacity key={c.type} style={styles.courtCard} activeOpacity={0.85} onPress={() => openMap(c.type)}>
            <Image source={COURT_SCENES[c.type]} style={styles.courtArt} resizeMode="contain" />
            <View style={styles.courtFooter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.courtLabel}>{c.label}</Text>
                <Text style={styles.courtBlurb}>{c.blurb}</Text>
              </View>
              <View style={styles.courtCount}>
                <Text style={styles.courtCountNum}>{counts[c.type] ?? 0}</Text>
                <Text style={styles.courtCountLabel}>games{"\n"}coming up</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {topCourts.length > 0 && (
          <View style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <Text style={styles.pulseTitle}>Busiest courts this week</Text>
              <View style={styles.liveDot} />
            </View>
            {topCourts.map((t, i) => (
              <View key={t.courtName} style={[styles.pulseRow, i > 0 && styles.pulseRowBorder]}>
                <Text style={styles.pulseRank}>{i + 1}</Text>
                <CourtPin type={t.courtType} size={22} />
                <Text style={styles.pulseName} numberOfLines={1}>{t.courtName}</Text>
                <Text style={styles.pulseCount}>{t.activity}</Text>
              </View>
            ))}
            <Text style={styles.pulseNote}>joins and check-ins, updated live</Text>
          </View>
        )}

        <TouchableOpacity style={styles.hostBtn} onPress={() => router.push("/create-session" as any)}>
          <Text style={styles.hostBtnText}>Host a game</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openMap()}>
          <Text style={styles.browseLink}>or see every game on the map</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F3EF" },
  scroll: { padding: 20, paddingBottom: 48, gap: 16 },

  hero: { alignItems: "center", paddingTop: 12 },
  logo: { width: 112, height: 112 },
  tagline: { fontFamily: F.w700, fontSize: 38, lineHeight: 40, color: "#111111", textAlign: "center", marginTop: 12 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#D0341A", marginTop: 10 },
  mission: { fontFamily: F.w400, fontSize: 19, lineHeight: 25, color: "#3A3833", textAlign: "center", paddingHorizontal: 6 },

  courtCard: { backgroundColor: "#FFF", borderRadius: 22, borderWidth: 1, borderColor: "#ECE9E3", overflow: "hidden" },
  courtArt: { width: "100%", height: 190, backgroundColor: "#FFF" },
  courtFooter: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#ECE9E3",
  },
  courtLabel: { fontFamily: F.w700, fontSize: 26, color: "#111111" },
  courtBlurb: { fontFamily: F.w400, fontSize: 16, color: "#7D7A73", marginTop: 2 },
  courtCount: { alignItems: "center" },
  courtCountNum: { fontFamily: F.w700, fontSize: 28, color: "#D0341A" },
  courtCountLabel: { fontFamily: F.w400, fontSize: 12, color: "#7D7A73", textAlign: "center", lineHeight: 13 },

  pulseCard: { backgroundColor: "#FFF", borderRadius: 22, borderWidth: 1, borderColor: "#ECE9E3", padding: 18 },
  pulseHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  pulseTitle: { fontFamily: F.w700, fontSize: 22, color: "#111111" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D0341A" },
  pulseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  pulseRowBorder: { borderTopWidth: 1, borderTopColor: "#ECE9E3" },
  pulseRank: { fontFamily: F.w700, fontSize: 20, color: "#D0341A", width: 18 },
  pulseName: { flex: 1, fontFamily: F.w700, fontSize: 18, color: "#111111" },
  pulseCount: { fontFamily: F.w700, fontSize: 18, color: "#111111" },
  pulseNote: { fontFamily: F.w400, fontSize: 13, color: "#7D7A73", marginTop: 6 },

  hostBtn: { backgroundColor: "#111111", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  hostBtnText: { fontFamily: F.w700, fontSize: 20, color: "#FFF" },
  browseLink: { fontFamily: F.w400, fontSize: 16, color: "#7D7A73", textAlign: "center", textDecorationLine: "underline" },
});

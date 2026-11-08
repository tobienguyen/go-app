import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCourtPulse, CourtPulse } from "../services/insights";
import { F } from "../constants/fonts";

// Court Pulse: when this court is busiest, from the TimescaleDB continuous
// aggregate over every join and check-in. `refreshKey` reloads it (e.g. right
// after the user joins, so the live count visibly ticks up).

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FIRST_HOUR = 8, LAST_HOUR = 22;

function hourLabel(h: number): string {
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

export function CourtPulseCard({ courtName, color, refreshKey = 0 }: {
  courtName: string;
  color: string;
  refreshKey?: number;
}) {
  const [pulse, setPulse] = useState<CourtPulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCourtPulse(courtName)
      .then(p => { if (!cancelled) setPulse(p); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courtName, refreshKey]);

  if (loading && !pulse) {
    return <View style={styles.card}><ActivityIndicator color="#000" /></View>;
  }

  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const byHour = new Map((pulse?.byHour ?? []).map(h => [h.hour, h.activity]));
  const max = Math.max(1, ...hours.map(h => byHour.get(h) ?? 0));
  const total = hours.reduce((sum, h) => sum + (byHour.get(h) ?? 0), 0);

  if (!pulse || total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Court Pulse</Text>
        <Text style={styles.empty}>New court! Activity shows up here as people play.</Text>
      </View>
    );
  }

  const peakHour = hours.reduce((best, h) => ((byHour.get(h) ?? 0) > (byHour.get(best) ?? 0) ? h : best), hours[0]);
  const peakDay = [...pulse.byDay].sort((a, b) => b.activity - a.activity)[0];
  const change = pulse.lastWeek > 0 ? Math.round(((pulse.thisWeek - pulse.lastWeek) / pulse.lastWeek) * 100) : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Court Pulse</Text>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>live</Text>
      </View>
      <Text style={styles.subtitle}>
        Busiest around <Text style={styles.bold}>{hourLabel(peakHour)}</Text>
        {peakDay ? <> · best day <Text style={styles.bold}>{DAYS[peakDay.dayOfWeek - 1]}</Text></> : null}
      </Text>

      <View style={styles.chart}>
        {hours.map(h => {
          const v = byHour.get(h) ?? 0;
          return (
            <View key={h} style={styles.barSlot}>
              <View style={[styles.bar, {
                height: `${Math.max(4, (v / max) * 100)}%`,
                backgroundColor: h === peakHour ? color : color + "55",
              }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {[8, 12, 16, 20].map(h => <Text key={h} style={styles.axisLabel}>{hourLabel(h)}</Text>)}
      </View>

      <View style={styles.statsRow}>
        <Ionicons name="pulse" size={14} color="#7D7A73" />
        <Text style={styles.stat}>
          <Text style={styles.bold}>{pulse.thisWeek}</Text> joins & check-ins this week
        </Text>
        {change !== null && (
          <Text style={[styles.change, { color: change >= 0 ? "#111111" : "#7D7A73" }]}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: F.w800, fontSize: 17, color: "#000" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D0341A", marginLeft: 4 },
  liveText: { fontFamily: F.w700, fontSize: 12, color: "#D0341A", textTransform: "uppercase" },
  subtitle: { fontFamily: F.w400, fontSize: 15, color: "#7D7A73", marginTop: 4, marginBottom: 12 },
  bold: { fontFamily: F.w700, color: "#000" },
  empty: { fontFamily: F.w400, fontSize: 15, color: "#A8A49C", marginTop: 6 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 72, gap: 3 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3 },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisLabel: { fontFamily: F.w400, fontSize: 11, color: "#A8A49C" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  stat: { fontFamily: F.w400, fontSize: 13, color: "#7D7A73", flex: 1 },
  change: { fontFamily: F.w700, fontSize: 13, },
});

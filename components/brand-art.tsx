import React, { useEffect, useRef, useState } from "react";
import { View, Image, Animated, Text, StyleSheet, ImageStyle, StyleProp } from "react-native";
import { F } from "../constants/fonts";

// Hand-drawn GO! artwork and the small components built from it.

export const COURT_SCENES: Record<string, any> = {
  beach: require("../assets/images/brand/court-beach.png"),
  grass: require("../assets/images/brand/court-grass.png"),
  indoor: require("../assets/images/brand/court-indoor.png"),
};

export const COURT_PINS: Record<string, any> = {
  beach: require("../assets/images/brand/pin-beach.png"),
  grass: require("../assets/images/brand/pin-grass.png"),
  indoor: require("../assets/images/brand/pin-indoor.png"),
};

export const TAB_ICONS = {
  home: require("../assets/images/brand/tab-home.png"),
  map: require("../assets/images/brand/tab-map.png"),
  browse: require("../assets/images/brand/tab-browse.png"),
  leaderboard: require("../assets/images/brand/tab-leaderboard.png"),
  profile: require("../assets/images/brand/tab-profile.png"),
};

const SPOT_BLOB = require("../assets/images/brand/spot-blob.png");

export function CourtScene({ type, height = 120, style }: {
  type: string;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const src = COURT_SCENES[type];
  if (!src) return null;
  return <Image source={src} style={[{ width: "100%", height }, style]} resizeMode="contain" />;
}

export function CourtPin({ type, size = 20 }: { type: string; size?: number }) {
  const src = COURT_PINS[type];
  if (!src) return null;
  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}

export function TabIcon({ source, focused }: { source: any; focused: boolean }) {
  return (
    <View style={styles.tabIconWrap}>
      <Image source={source} style={[styles.tabIcon, !focused && styles.tabIconIdle]} resizeMode="contain" />
      <View style={[styles.tabDot, !focused && { opacity: 0 }]} />
    </View>
  );
}

/**
 * One blob per spot: solid for taken, faded for open. When the filled count
 * goes up (someone joins), the newest blob pops in.
 */
export function SpotsBlobs({ filled, total, size = 22, max = 12 }: {
  filled: number;
  total: number;
  size?: number;
  max?: number;
}) {
  const shown = Math.min(total, max);
  const prevFilled = useRef(filled);
  const pop = useRef(new Animated.Value(1)).current;
  const [popIndex, setPopIndex] = useState(-1);

  useEffect(() => {
    if (filled > prevFilled.current) {
      setPopIndex(filled - 1);
      pop.setValue(0.3);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    }
    prevFilled.current = filled;
  }, [filled, pop]);

  return (
    <View style={styles.spotsRow}>
      {Array.from({ length: shown }, (_, i) => {
        const taken = i < filled;
        const img = (
          <Image
            source={SPOT_BLOB}
            style={{ width: size, height: size, opacity: taken ? 1 : 0.2 }}
            resizeMode="contain"
          />
        );
        return i === popIndex ? (
          <Animated.View key={i} style={{ transform: [{ scale: pop }] }}>{img}</Animated.View>
        ) : (
          <View key={i}>{img}</View>
        );
      })}
      {total > max && <Text style={styles.more}>+{total - max}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: { alignItems: "center", justifyContent: "center", paddingTop: 4 },
  tabIcon: { width: 30, height: 30 },
  tabIconIdle: { opacity: 0.35 },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#D0341A", marginTop: 3 },
  spotsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 3 },
  more: { fontFamily: F.w700, fontSize: 13, color: "#7D7A73", marginLeft: 4 },
});

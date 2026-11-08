import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

// The logo fox, animated. The logo is split into two layers (ball + fox) that
// line up exactly when both are drawn at the same size and position.

const FOX = require("../assets/images/brand/logo-fox.png");
const BALL = require("../assets/images/brand/logo-ball.png");

// t runs 0 -> 1; these turn it into a jump arc (x moves steadily, y rises then falls)
const ARC_T = [0, 0.25, 0.5, 0.75, 1];
const ARC_Y = [0, -0.75, -1, -0.75, 0];

/** Launch animation: the ball drops in, the fox leaps onto it, then it fades into the app. */
export function FoxIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.6, 260);

  const ballY = useRef(new Animated.Value(-height * 0.6)).current;
  const ballSquash = useRef(new Animated.Value(1)).current;
  const leap = useRef(new Animated.Value(0)).current;
  const foxOpacity = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    Animated.sequence([
      // ball drops and bounces
      Animated.timing(ballY, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(ballSquash, { toValue: 0.82, duration: 80, useNativeDriver: true }),
        Animated.spring(ballSquash, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
      ]),
      // fox leaps in from the left and lands on the ball
      Animated.parallel([
        Animated.timing(foxOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(leap, { toValue: 1, duration: 620, easing: Easing.linear, useNativeDriver: true }),
      ]),
      // little "landed" bounce of the whole logo
      Animated.sequence([
        Animated.timing(settle, { toValue: 1.06, duration: 110, useNativeDriver: true }),
        Animated.spring(settle, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      ]),
      Animated.delay(350),
    ]).start(() => finish());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const foxX = leap.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.9, 0] });
  const foxY = leap.interpolate({ inputRange: ARC_T, outputRange: ARC_Y.map(v => v * size * 0.9) });
  const foxRotate = leap.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-22deg", "0deg", "10deg"] });
  const ballScaleX = ballSquash.interpolate({ inputRange: [0.82, 1], outputRange: [1.12, 1] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.introBg, { opacity: fade }]}>
      <Pressable style={styles.center} onPress={finish}>
        <Animated.View style={{ width: size, height: size, transform: [{ scale: settle }] }}>
          <Animated.Image
            source={BALL}
            style={[styles.layer, { transform: [{ translateY: ballY }, { scaleX: ballScaleX }, { scaleY: ballSquash }] }]}
          />
          <Animated.Image
            source={FOX}
            style={[styles.layer, {
              opacity: foxOpacity,
              transform: [{ translateX: foxX }, { translateY: foxY }, { rotate: foxRotate }],
            }]}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** A small fox that leaps across `width` and lands on the right. Plays when `play` turns true. */
export function FoxHop({ play, width, size = 72 }: { play: boolean; width: number; size?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const land = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!play) { t.setValue(0); return; }
    t.setValue(0);
    Animated.sequence([
      Animated.delay(250), // let the pass slide up first
      Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(land, { toValue: 0.85, duration: 70, useNativeDriver: true }),
        Animated.spring(land, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
      ]),
    ]).start();
  }, [play, t, land]);

  const x = t.interpolate({ inputRange: [0, 1], outputRange: [-size, width - size * 0.95] });
  const y = t.interpolate({ inputRange: ARC_T, outputRange: ARC_Y.map(v => v * size * 1.1) });
  const rotate = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-25deg", "0deg", "12deg"] });

  return (
    <View style={{ height: size * 0.75, width }} pointerEvents="none">
      <Animated.Image
        source={FOX}
        style={{
          position: "absolute", bottom: -size * 0.12, width: size, height: size,
          transform: [{ translateX: x }, { translateY: y }, { rotate }, { scaleY: land }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  introBg: { backgroundColor: "#F5F3EF", zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", width: "100%", height: "100%" },
});

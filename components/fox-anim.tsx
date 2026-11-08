import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions } from "react-native";

// The logo fox, animated. The logo is split into layers (ball, letters, and
// three hand-drawn jump poses) that line up exactly at the same size/position.

const BALL = require("../assets/images/brand/intro/ball.png");
const LETTERS = [
  require("../assets/images/brand/intro/g.png"),
  require("../assets/images/brand/intro/o.png"),
  require("../assets/images/brand/intro/bang.png"),
];
// Jump poses: tails streaming back -> mid -> landing (the logo pose)
const POSES = [
  require("../assets/images/brand/intro/fox-1.png"),
  require("../assets/images/brand/intro/fox-2.png"),
  require("../assets/images/brand/intro/fox-3.png"),
];
// Which pose shows at each point of the leap (0 = takeoff, 1 = landed)
const POSE_WINDOWS: [number, number][] = [[0, 0.45], [0.45, 0.8], [0.8, 1.01]];
// The intro canvas is a bit larger than the logo's (room for the tails), so
// scale it up to keep the ball the same size on screen.
const CANVAS_SCALE = 555 / 489;
// Nudge right so the logo reads as centered on screen
const SHIFT_RIGHT = 0.1;

// t runs 0 -> 1; these turn it into a jump arc (x moves steadily, y rises then falls)
const ARC_T = [0, 0.25, 0.5, 0.75, 1];
const ARC_Y = [0, -0.75, -1, -0.75, 0];

/** Launch animation: the ball drops in, the fox leaps onto it, then it fades into the app. */
export function FoxIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.6, 260) * CANVAS_SCALE;

  const ballY = useRef(new Animated.Value(-height * 0.6)).current;
  const ballSquash = useRef(new Animated.Value(1)).current;
  const leap = useRef(new Animated.Value(0)).current;
  const foxOpacity = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const letters = useRef(LETTERS.map(() => new Animated.Value(0))).current;
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
        Animated.timing(foxOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(leap, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
      ]),
      // little "landed" bounce of the whole logo
      Animated.sequence([
        Animated.timing(settle, { toValue: 1.06, duration: 110, useNativeDriver: true }),
        Animated.spring(settle, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      ]),
      // G, then O, then !
      Animated.stagger(170, letters.map(v =>
        Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      )),
      Animated.delay(450),
    ]).start(() => finish());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // start with the whole fox (tails included) just inside the left edge of the screen
  const startX = -((width - size) / 2 + size * SHIFT_RIGHT) + size * 0.02;
  const foxX = leap.interpolate({ inputRange: [0, 1], outputRange: [startX, 0] });
  const foxY = leap.interpolate({ inputRange: ARC_T, outputRange: ARC_Y.map(v => v * size * 0.9) });
  const foxRotate = leap.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-22deg", "0deg", "10deg"] });
  const ballScaleX = ballSquash.interpolate({ inputRange: [0.82, 1], outputRange: [1.12, 1] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.introBg, { opacity: fade }]}>
      <Pressable style={styles.center} onPress={finish}>
        <Animated.View style={{ width: size, height: size, transform: [{ translateX: size * SHIFT_RIGHT }, { scale: settle }] }}>
          <Animated.Image
            source={BALL}
            style={[styles.layer, { transform: [{ translateY: ballY }, { scaleX: ballScaleX }, { scaleY: ballSquash }] }]}
          />
          {LETTERS.map((src, i) => (
            <Animated.Image
              key={i}
              source={src}
              style={[styles.layer, {
                opacity: letters[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
                transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [size * 0.05, 0] }) }],
              }]}
            />
          ))}
          {POSES.map((src, i) => {
            const [from, to] = POSE_WINDOWS[i];
            // hard cut between poses, like a flipbook
            const visible = leap.interpolate({
              inputRange: [-1, from - 0.0001, from, to - 0.0001, to, 2],
              outputRange: [0, 0, 1, 1, 0, 0],
              extrapolate: "clamp",
            });
            return (
              <Animated.Image
                key={i}
                source={src}
                style={[styles.layer, {
                  opacity: Animated.multiply(foxOpacity, visible),
                  transform: [{ translateX: foxX }, { translateY: foxY }, { rotate: foxRotate }],
                }]}
              />
            );
          })}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  introBg: { backgroundColor: "#F5F3EF", zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", width: "100%", height: "100%" },
});

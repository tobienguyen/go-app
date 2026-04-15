import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FEATURES = [
  { icon: 'flash-outline' as const, text: 'Instant spike & serve form analysis' },
  { icon: 'trending-up-outline' as const, text: 'Track improvement over time' },
  { icon: 'school-outline' as const, text: 'Personalized drills based on your weaknesses' },
  { icon: 'share-outline' as const, text: 'Share clips with your team' },
];

export default function AnalyzeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analyze</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="camera" size={64} color="#000" />
        </View>

        <Text style={styles.title}>AI Spike Analyzer</Text>
        <Text style={styles.subtitle}>
          Record your spikes, serves, and digs. Get instant AI feedback on your form, timing, and technique.
        </Text>

        <View style={styles.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={styles.featureIconWrapper}>
                <Ionicons name={f.icon} size={20} color="#000" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>COMING SOON</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120, height: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#000', textAlign: 'center', marginBottom: 12 },
  subtitle: {
    fontSize: 15, color: '#6B7280',
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  featureList: { width: '100%', gap: 16, marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconWrapper: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  featureText: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
  comingSoonBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 24, paddingVertical: 11,
    borderRadius: 20,
  },
  comingSoonText: { color: '#FFF', fontWeight: '800', fontSize: 12, letterSpacing: 2 },
});

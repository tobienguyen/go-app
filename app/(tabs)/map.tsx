import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  FlatList, TouchableOpacity, Dimensions, Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

const TYPE_COLORS = { beach: '#F59E0B', grass: '#10B981', indoor: '#3B82F6' };
const TYPE_ICONS = { beach: '🏖️', grass: '🌿', indoor: '🏟️' };
type SessionType = 'beach' | 'grass' | 'indoor';
type Filter = 'all' | SessionType;

const SESSIONS = [
  {
    id: '1',
    type: 'beach' as SessionType,
    host: 'Alex M.',
    title: 'Sunset Beach 4v4',
    location: 'Santa Monica Beach',
    coordinate: { latitude: 34.0052, longitude: -118.4974 },
    time: 'Today, 4:00 PM',
    spotsTotal: 8,
    spotsFilled: 5,
    price: 5,
    description: 'Casual 4v4 beach volleyball. All levels welcome!',
  },
  {
    id: '2',
    type: 'grass' as SessionType,
    host: 'Jordan K.',
    title: 'Griffith Park Pick-up',
    location: 'Griffith Park, LA',
    coordinate: { latitude: 34.1185, longitude: -118.3004 },
    time: 'Today, 6:00 PM',
    spotsTotal: 6,
    spotsFilled: 2,
    price: 5,
    description: 'Competitive grass volleyball. Intermediate+ preferred.',
  },
  {
    id: '3',
    type: 'indoor' as SessionType,
    host: 'YMCA Downtown',
    title: 'Indoor Night Session',
    location: 'YMCA Downtown LA',
    coordinate: { latitude: 34.0407, longitude: -118.2468 },
    time: 'Tomorrow, 7:00 PM',
    spotsTotal: 12,
    spotsFilled: 8,
    price: 12,
    description: 'Organized indoor volleyball. Intermediate level.',
  },
  {
    id: '4',
    type: 'beach' as SessionType,
    host: 'Maya T.',
    title: 'Venice Beach Sunset Sesh',
    location: 'Venice Beach',
    coordinate: { latitude: 33.9850, longitude: -118.4695 },
    time: 'Today, 5:30 PM',
    spotsTotal: 6,
    spotsFilled: 3,
    price: 5,
    description: 'Chill evening beach session. Beginners welcome!',
  },
  {
    id: '5',
    type: 'grass' as SessionType,
    host: 'Team Spike',
    title: 'Exposition Park Drill',
    location: 'Exposition Park, LA',
    coordinate: { latitude: 34.0165, longitude: -118.2890 },
    time: 'Saturday, 9:00 AM',
    spotsTotal: 10,
    spotsFilled: 6,
    price: 5,
    description: 'Skills practice & pick-up. All welcome.',
  },
];

const INITIAL_REGION = {
  latitude: 34.0522,
  longitude: -118.3790,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

type Session = typeof SESSIONS[0];

export default function MapScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);

  const filtered = filter === 'all' ? SESSIONS : SESSIONS.filter(s => s.type === filter);

  const handleMarkerPress = (session: Session) => {
    setSelectedId(session.id);
    const index = filtered.findIndex(s => s.id === session.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }
  };

  const handleCardPress = (session: Session) => {
    setSelectedId(session.id);
    mapRef.current?.animateToRegion(
      {
        latitude: session.coordinate.latitude,
        longitude: session.coordinate.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      600
    );
  };

  const spotsLeftColor = (filled: number, total: number) => {
    const ratio = filled / total;
    if (ratio >= 0.9) return '#EF4444';
    if (ratio >= 0.6) return '#F59E0B';
    return '#10B981';
  };

  const renderCard = ({ item }: { item: Session }) => {
    const isSelected = selectedId === item.id;
    const spotsLeft = item.spotsTotal - item.spotsFilled;
    const typeColor = TYPE_COLORS[item.type];

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20', borderColor: typeColor }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {TYPE_ICONS[item.type]} {item.type.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.cardPrice}>
            {item.price > 0 ? `$${item.price}/person` : 'Free'}
          </Text>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>

        <View style={styles.cardRow}>
          <Ionicons name="location-outline" size={13} color="#6B7280" />
          <Text style={styles.cardMeta}>{item.location}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="time-outline" size={13} color="#6B7280" />
          <Text style={styles.cardMeta}>{item.time}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="person-outline" size={13} color="#6B7280" />
          <Text style={styles.cardMeta}>Hosted by {item.host}</Text>
        </View>

        <View style={styles.cardBottom}>
          <View>
            <Text style={[styles.spotsText, { color: spotsLeftColor(item.spotsFilled, item.spotsTotal) }]}>
              {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
            </Text>
            <Text style={styles.spotsTotal}>{item.spotsFilled}/{item.spotsTotal} filled</Text>
          </View>
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => Alert.alert('Join Session', 'Joining sessions is coming soon!')}
          >
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find a Session</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => Alert.alert('Host a Session', 'Drop a pin and create a session — coming soon!')}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {filtered.map(session => (
          <Marker
            key={session.id}
            coordinate={session.coordinate}
            onPress={() => handleMarkerPress(session)}
          >
            <View style={[
              styles.pin,
              { backgroundColor: TYPE_COLORS[session.type] },
              selectedId === session.id && styles.pinSelected,
            ]}>
              <Text style={styles.pinText}>{TYPE_ICONS[session.type]}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.filterBar}>
        {(['all', 'beach', 'grass', 'indoor'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.filterCount}>{filtered.length} sessions</Text>
      </View>

      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000' },
  addBtn: {
    backgroundColor: '#000',
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  map: { height: height * 0.36 },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinSelected: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 3, borderColor: '#000',
  },
  pinText: { fontSize: 16 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#E5E7EB', backgroundColor: '#FFF',
  },
  filterBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#FFF' },
  filterCount: { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  list: { padding: 12, gap: 10, paddingBottom: 30 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#000' },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#000' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  cardMeta: { fontSize: 13, color: '#6B7280' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  spotsText: { fontSize: 13, fontWeight: '700' },
  spotsTotal: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  joinBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 10,
  },
  joinBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

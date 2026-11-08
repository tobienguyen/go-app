import { Tabs } from 'expo-router';
import { TabIcon, TAB_ICONS } from '../../components/brand-art';
import { F } from '../../constants/fonts';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#A8A49C',
        tabBarLabelStyle: { fontSize: 12, fontFamily: F.w700 },
        tabBarStyle: {
          height: 88,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: '#ECE9E3',
          backgroundColor: '#FFF',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.browse} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.map} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.leaderboard} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.profile} focused={focused} />,
        }}
      />
      {/* Hide files not used as tabs */}
      <Tabs.Screen name="home" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

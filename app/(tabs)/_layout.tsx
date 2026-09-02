import { useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import AjoutRapideModal from '../../components/AjoutRapideModal';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_LABELS: Record<string, { fr: string; pt: string }> = {
  accueil: { fr: "Aujourd'hui", pt: 'Hoje' },
  calendrier: { fr: 'Agenda', pt: 'Agenda' },
  decisions: { fr: 'Décisions', pt: 'Decisões' },
  messagerie: { fr: 'Messagerie', pt: 'Mensagens' },
  journal: { fr: 'Journal', pt: 'Diário' },
  finances: { fr: 'Finances', pt: 'Finanças' },
  documents: { fr: 'Documents', pt: 'Documentos' },
  enfants: { fr: 'Enfants', pt: 'Filhos' },
  caf: { fr: 'CAF', pt: 'CAF' },
  echanges: { fr: 'Échanges', pt: 'Mensagens' },
  famille: { fr: 'Famille', pt: 'Família' },
};

const ONGLETS_VISIBLES = ['accueil', 'calendrier', 'echanges', 'famille'];

function ScrollableTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const langue = useStore((state) => state.langue);
  const [ajoutVisible, setAjoutVisible] = useState(false);

  const routesVisibles = ONGLETS_VISIBLES
    .map((nom) => state.routes.find((r) => r.name === nom))
    .filter((r): r is (typeof state.routes)[number] => !!r);

  return (
    <View
      style={{
        backgroundColor: COLORS.vert,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
        paddingBottom: insets.bottom,
      }}
    >
      <View style={{ flexDirection: 'row', height: 60, alignItems: 'center' }}>
        {routesVisibles.slice(0, 2).map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index]?.name === route.name;
          const color = isFocused ? COLORS.or : COLORS.ardoise;
          const label = TAB_LABELS[route.name]?.[langue] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6, paddingBottom: 10, height: 60 }}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              <Text style={{ fontSize: TYPOGRAPHY.xs, color, fontWeight: TYPOGRAPHY.medium, marginTop: 2, textAlign: 'center' }}>
                {String(label)}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={() => setAjoutVisible(true)}
          activeOpacity={0.85}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: COLORS.vertProfond,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: COLORS.or,
            }}
          >
            <Ionicons name="add" size={24} color={COLORS.or} />
          </View>
        </TouchableOpacity>

        {routesVisibles.slice(2).map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index]?.name === route.name;
          const color = isFocused ? COLORS.or : COLORS.ardoise;
          const label = TAB_LABELS[route.name]?.[langue] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6, paddingBottom: 10, height: 60 }}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              <Text style={{ fontSize: TYPOGRAPHY.xs, color, fontWeight: TYPOGRAPHY.medium, marginTop: 2, textAlign: 'center' }}>
                {String(label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AjoutRapideModal visible={ajoutVisible} onClose={() => setAjoutVisible(false)} />
    </View>
  );
}

export default function TabLayout() {
  const langue = useStore((state) => state.langue);
  const titre = (key: keyof typeof TAB_LABELS) => TAB_LABELS[key][langue];

  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerBackground: () => (
          <LinearGradient
            colors={[COLORS.vert, '#3D8B6A']}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        ),
        headerShadowVisible: false,
        headerTintColor: COLORS.blanc,
        headerTitleStyle: {
          fontWeight: TYPOGRAPHY.semibold,
          fontSize: TYPOGRAPHY.lg,
          color: COLORS.blanc,
        },
      }}
    >
      <Tabs.Screen
        name="accueil"
        options={{
          title: titre('accueil'),
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : ('home-outline' as IoniconName)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendrier"
        options={{
          title: titre('calendrier'),
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : ('calendar-outline' as IoniconName)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="echanges"
        options={{
          title: titre('echanges'),
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubbles' : ('chatbubbles-outline' as IoniconName)} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="famille"
        options={{
          title: titre('famille'),
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'people' : ('people-outline' as IoniconName)} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen name="decisions" options={{ title: titre('decisions'), href: null }} />
      <Tabs.Screen name="messagerie" options={{ title: titre('messagerie'), href: null }} />
      <Tabs.Screen name="journal" options={{ title: titre('journal'), headerShown: false, href: null }} />
      <Tabs.Screen name="finances" options={{ title: titre('finances'), headerShown: false, href: null }} />
      <Tabs.Screen name="documents" options={{ title: titre('documents'), headerShown: false, href: null }} />
      <Tabs.Screen name="enfants" options={{ title: titre('enfants'), headerShown: false, href: null }} />
      <Tabs.Screen name="caf" options={{ title: titre('caf'), headerShown: false, href: null }} />
    </Tabs>
  );
}
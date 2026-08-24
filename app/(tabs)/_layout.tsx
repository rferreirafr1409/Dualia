import { TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';
import { useStore } from '../../store/useStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_LABELS: Record<string, { fr: string; pt: string }> = {
  accueil: { fr: 'Accueil', pt: 'Início' },
  calendrier: { fr: 'Calendrier', pt: 'Calendário' },
  decisions: { fr: 'Décisions', pt: 'Decisões' },
  messagerie: { fr: 'Messagerie', pt: 'Mensagens' },
  journal: { fr: 'Journal', pt: 'Diário' },
  finances: { fr: 'Finances', pt: 'Finanças' },
  documents: { fr: 'Documents', pt: 'Documentos' },
  caf: { fr: 'CAF', pt: 'CAF' },
};

function ScrollableTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const numTabs = state.routes.length;
  const tabWidth = Math.max(72, Math.floor(width / numTabs));
  const langue = useStore((state) => state.langue);

  return (
    <View
      style={{
        backgroundColor: COLORS.vert,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
        paddingBottom: insets.bottom,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 60 }}
        contentContainerStyle={{ paddingHorizontal: 0 }}
      >
        {state.routes.map((route: { key: string; name: string }, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? COLORS.or : COLORS.ardoise;
          const label =
            TAB_LABELS[route.name]?.[langue] ??
            (typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name));

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={{
                width: tabWidth,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 6,
                paddingBottom: 10,
                height: 60,
              }}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              <Text
                style={{
                  fontSize: TYPOGRAPHY.xs,
                  color,
                  fontWeight: TYPOGRAPHY.medium,
                  marginTop: 2,
                  textAlign: 'center',
                }}
              >
                {String(label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function TabLayout() {
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
          title: 'Accueil',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'home' : ('home-outline' as IoniconName)}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendrier"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'calendar' : ('calendar-outline' as IoniconName)}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="decisions"
        options={{
          title: 'Décisions',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={
                focused
                  ? 'document-text'
                  : ('document-text-outline' as IoniconName)
              }
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messagerie"
        options={{
          title: 'Messagerie',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={
                focused ? 'chatbubbles' : ('chatbubbles-outline' as IoniconName)
              }
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'book' : ('book-outline' as IoniconName)}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'wallet' : ('wallet-outline' as IoniconName)}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'folder' : ('folder-outline' as IoniconName)}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="caf"
        options={{
          title: 'CAF',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'business' : ('business-outline' as IoniconName)}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
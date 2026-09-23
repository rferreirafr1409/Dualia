import { useState } from 'react';
import { TouchableOpacity, View, Text, useWindowDimensions, StyleSheet, Pressable } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, TYPOGRAPHY, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import { useStore } from '../../store/useStore';
import AjoutRapideModal from '../../components/AjoutRapideModal';
import RetourBetaBouton from '../../components/RetourBetaBouton';
import { BrandMark } from '../../components/icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const DESKTOP_BREAKPOINT = 1100;
const SIDEBAR_WIDTH = 208;

const TAB_LABELS: Record<string, { fr: string; pt: string; es: string; en: string }> = {
  accueil: { fr: "Aujourd'hui", pt: 'Hoje', es: 'Hoy', en: 'Today' },
  calendrier: { fr: 'Agenda', pt: 'Agenda', es: 'Agenda', en: 'Calendar' },
  decisions: { fr: 'Décisions', pt: 'Decisões', es: 'Decisiones', en: 'Decisions' },
  messagerie: { fr: 'Messages', pt: 'Mensagens', es: 'Mensajes', en: 'Messages' },
  journal: { fr: 'Journal', pt: 'Diário', es: 'Diario', en: 'Journal' },
  finances: { fr: 'Finances', pt: 'Finanças', es: 'Finanzas', en: 'Finances' },
  documents: { fr: 'Documents', pt: 'Documentos', es: 'Documentos', en: 'Documents' },
  enfants: { fr: 'Enfants', pt: 'Filhos', es: 'Hijos', en: 'Children' },
  caf: { fr: 'CAF', pt: 'CAF', es: 'Juzgado', en: 'Benefits' },
  echanges: { fr: 'Échanges', pt: 'Mensagens', es: 'Intercambios', en: 'Exchanges' },
  famille: { fr: 'Famille', pt: 'Família', es: 'Familia', en: 'Family' },
};

const ONGLETS_VISIBLES = ['accueil', 'calendrier', 'messagerie', 'famille'];

const SIDEBAR_ITEMS: { route: string; iconOn: IoniconName; iconOff: IoniconName }[] = [
  { route: 'accueil', iconOn: 'home', iconOff: 'home-outline' },
  { route: 'calendrier', iconOn: 'calendar', iconOff: 'calendar-outline' },
  { route: 'decisions', iconOn: 'checkmark-circle', iconOff: 'checkmark-circle-outline' },
  { route: 'finances', iconOn: 'wallet', iconOff: 'wallet-outline' },
  { route: 'documents', iconOn: 'folder', iconOff: 'folder-outline' },
  { route: 'journal', iconOn: 'book', iconOff: 'book-outline' },
  { route: 'caf', iconOn: 'business', iconOff: 'business-outline' },
  { route: 'messagerie', iconOn: 'chatbubbles', iconOff: 'chatbubbles-outline' },
  { route: 'famille', iconOn: 'people', iconOff: 'people-outline' },
];

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

function SidebarDesktop() {
  const router = useRouter();
  const pathname = usePathname();
  const langue = useStore((state) => state.langue);
  const t = TRADUCTIONS[langue];
  const espacesFamiliaux = useStore((state) => state.espacesFamiliaux);
  const familleId = useStore((state) => state.familleId);
  const changerEspaceFamilial = useStore((state) => state.changerEspaceFamilial);
  const [switcherOuvert, setSwitcherOuvert] = useState(false);

  const espaceActif = espacesFamiliaux.find((e) => e.familleId === familleId);
  const plusieursEspaces = espacesFamiliaux.length > 1;

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <View style={styles.sidebarBrandIcon}>
          <BrandMark size={13} color={COLORS.ivoire} />
        </View>
        <Text style={styles.sidebarBrandLabel}>Dualia</Text>
      </View>

      {espacesFamiliaux.length > 0 ? (
        <View style={styles.spaceSwitcherWrap}>
          <Pressable
            style={styles.spaceSwitcher}
            onPress={() => plusieursEspaces && setSwitcherOuvert((v) => !v)}
          >
            <Text style={styles.spaceSwitcherLabel}>Espace familial</Text>
            <Text style={styles.spaceSwitcherValue} numberOfLines={1}>
              {espaceActif?.label ?? 'Espace familial'}
              {plusieursEspaces ? '  ▾' : ''}
            </Text>
          </Pressable>

          {switcherOuvert && plusieursEspaces ? (
            <View style={styles.spaceSwitcherMenu}>
              {espacesFamiliaux.map((espace) => {
                const actif = espace.familleId === familleId;
                return (
                  <Pressable
                    key={espace.familleId}
                    style={[styles.spaceSwitcherOption, actif && styles.spaceSwitcherOptionActive]}
                    onPress={() => {
                      setSwitcherOuvert(false);
                      if (!actif) changerEspaceFamilial(espace.familleId);
                    }}
                  >
                    <Text
                      style={[
                        styles.spaceSwitcherOptionLabel,
                        actif && styles.spaceSwitcherOptionLabelActive,
                      ]}
                    >
                      {espace.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sidebarNav}>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = pathname === `/${item.route}` || pathname.startsWith(`/${item.route}/`);
          const label = TAB_LABELS[item.route]?.[langue] ?? item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => router.push(`/${item.route}` as any)}
              style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
            >
              <Ionicons
                name={isActive ? item.iconOn : item.iconOff}
                size={17}
                color={isActive ? COLORS.or : 'rgba(255,255,255,0.65)'}
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sidebarQuote}>
        <Text style={styles.sidebarQuoteTexte}>
          « {t.citation} »
        </Text>
      </View>
    </View>
  );
}

function TabsInterieur({ isDesktop }: { isDesktop: boolean }) {
  const langue = useStore((state) => state.langue);
  const titre = (key: keyof typeof TAB_LABELS) => TAB_LABELS[key][langue];

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {isDesktop ? <SidebarDesktop /> : null}
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => (isDesktop ? <View style={{ height: 0 }} /> : <ScrollableTabBar {...props} />)}
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
            name="messagerie"
            options={{
              title: titre('messagerie'),
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
          <Tabs.Screen name="echanges" options={{ title: titre('echanges'), headerShown: false, href: null }} />
          <Tabs.Screen name="journal" options={{ title: titre('journal'), headerShown: false, href: null }} />
          <Tabs.Screen name="finances" options={{ title: titre('finances'), headerShown: false, href: null }} />
          <Tabs.Screen name="documents" options={{ title: titre('documents'), headerShown: false, href: null }} />
          <Tabs.Screen name="enfants" options={{ title: titre('enfants'), headerShown: false, href: null }} />
          <Tabs.Screen name="caf" options={{ title: titre('caf'), headerShown: false, href: null }} />
        </Tabs>
      </View>
      <RetourBetaBouton />
    </View>
  );
}

export default function TabLayout() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  if (!isDesktop) {
    return <TabsInterieur isDesktop={false} />;
  }

  const fenetreHeight = Math.min(height - 48, 920);
  const fenetreWidth = Math.min(width - 64, 1560);

  return (
    <View style={styles.stage}>
      <View style={styles.stageRow}>
        <View style={[styles.fenetre, { height: fenetreHeight, width: fenetreWidth }]}>
          <TabsInterieur isDesktop />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  fenetre: {
    flexDirection: 'row',
    backgroundColor: COLORS.ivoire,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.16,
    shadowRadius: 50,
    elevation: 20,
  },

  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.vertProfond,
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
    marginLeft: 6,
  },
  sidebarBrandIcon: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: COLORS.vert,
    alignItems: 'center', justifyContent: 'center',
  },
  sidebarBrandLabel: {
    fontFamily: FONTS.displaySemibold,
    fontSize: 15,
    color: COLORS.ivoire,
  },

  spaceSwitcherWrap: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 20,
  },
  spaceSwitcher: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  spaceSwitcherLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 3,
  },
  spaceSwitcherValue: {
    fontFamily: FONTS.displaySemibold,
    fontSize: 12.5,
    color: COLORS.ivoire,
  },
  spaceSwitcherMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: COLORS.ivoire,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  spaceSwitcherOption: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  spaceSwitcherOptionActive: {
    backgroundColor: 'rgba(28,43,37,0.08)',
  },
  spaceSwitcherOptionLabel: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: COLORS.texte,
  },
  spaceSwitcherOptionLabelActive: {
    fontFamily: FONTS.bodySemibold,
    color: COLORS.vertProfond,
  },

  sidebarNav: { gap: 2, flex: 1 },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: 8,
  },
  sidebarItemActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  sidebarIcon: { width: 20, textAlign: 'center' },
  sidebarLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.65)',
    marginLeft: 10,
  },
  sidebarLabelActive: { color: COLORS.blanc },

  sidebarQuote: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 13,
  },
  sidebarQuoteTexte: {
    fontFamily: FONTS.display,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.75)',
  },
});
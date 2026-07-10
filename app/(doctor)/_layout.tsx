// Doctor persona — bottom tabs. Feature directories own their inner Stack
// (`<feature>/_layout.tsx`); this layout only declares the tab bar and hides
// non-tab routes. Icons are monochrome text glyphs (no icon-font dependency;
// glyph polish is a Phase-4 item).

import { Tabs } from 'expo-router';
import * as React from 'react';
import { type ColorValue, Text } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/ui/theme';

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }): React.ReactElement {
  return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
}

export default function DoctorLayout(): React.ReactElement {
  const theme = useTheme();
  const { t } = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.fgMuted,
        tabBarStyle: {
          backgroundColor: theme.bgElevated,
          borderTopColor: theme.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t({ en: 'Today', bn: 'আজ' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="◷" color={color} />,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: t({ en: 'Queue', bn: 'সিরিয়াল' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="☰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: t({ en: 'Patients', bn: 'রোগী' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="⚕" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t({ en: 'Orders', bn: 'অর্ডার' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="▤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t({ en: 'More', bn: 'আরও' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="⋯" color={color} />,
        }}
      />

      {/* Stack-only routes — reachable by navigation, hidden from the bar. */}
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="prescribe" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
      <Tabs.Screen name="certificates" options={{ href: null }} />
    </Tabs>
  );
}

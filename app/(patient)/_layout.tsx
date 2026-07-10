// Patient persona — bottom tabs. Feature directories own their inner Stack
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

export default function PatientLayout(): React.ReactElement {
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
          title: t({ en: 'Home', bn: 'হোম' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t({ en: 'Appointments', bn: 'অ্যাপয়েন্টমেন্ট' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="◷" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: t({ en: 'Meds', bn: 'ওষুধ' }),
          tabBarIcon: ({ color }) => <TabGlyph glyph="℞" color={color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: t({ en: 'Records', bn: 'রেকর্ড' }),
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
      <Tabs.Screen name="labs" options={{ href: null }} />
      <Tabs.Screen name="vitals" options={{ href: null }} />
      <Tabs.Screen name="queue" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="billing" options={{ href: null }} />
    </Tabs>
  );
}

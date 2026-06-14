// Branch switcher — shown ONLY when the user has more than one assignable
// branch (mirrors the web rule: single-branch / branch-pinned staff never
// see it). Switching re-issues tokens with the new branch claim.

import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type BranchOption, fetchMyBranches, switchBranch } from '@/auth/context';
import { useSession } from '@/auth/sessionStore';
import { useT } from '@/i18n';

import { MIN_TOUCH_TARGET, radius, spacing } from './tokens';
import { useTheme } from './theme';

export function BranchSwitcher(): React.ReactElement | null {
  const theme = useTheme();
  const { t } = useT();
  const activeBranchId = useSession((s) => s.activeBranchId);
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void fetchMyBranches().then((res) => {
      if (active && res.ok) setBranches(res.value.branches ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  // Hidden for single-branch / branch-pinned users.
  if (branches.length <= 1) return null;

  const current = branches.find((b) => b.id === activeBranchId);

  async function choose(id: string) {
    if (id === activeBranchId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    await switchBranch(id);
    setBusy(false);
    setOpen(false);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t({ en: 'Switch branch', bn: 'শাখা পরিবর্তন' })}
        onPress={() => setOpen((v) => !v)}
        style={[styles.chip, { borderColor: theme.line, backgroundColor: theme.bgMuted }]}
      >
        <Text style={[styles.chipText, { color: theme.fg }]} numberOfLines={1}>
          {current?.name ?? t({ en: 'Select branch', bn: 'শাখা নির্বাচন' })}
        </Text>
        <Text style={{ color: theme.fgSubtle }}>▾</Text>
      </Pressable>

      {open ? (
        <View style={[styles.menu, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected: b.id === activeBranchId }}
              onPress={() => void choose(b.id)}
              style={styles.menuItem}
            >
              <Text
                style={{
                  color: b.id === activeBranchId ? theme.accent : theme.fg,
                  fontWeight: b.id === activeBranchId ? '700' : '400',
                }}
              >
                {b.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    maxWidth: 200,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  menu: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  menuItem: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: spacing.md },
});

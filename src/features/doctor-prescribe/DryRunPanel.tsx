// Dry-run result rendering — every interaction / allergy / dose finding
// returned by POST /clinical/prescription-dry-run is rendered faithfully:
// ABSOLUTE + BLOCKING in the locked danger treatment, ADVISORY as
// warnings. Advisories demand an explicit acknowledgement; blocking
// findings render with NO dismissal affordance (the mobile client has no
// override path). Server-side 409 SAFETY_BLOCK refusals render here too.

import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, MIN_TOUCH_TARGET, radius, spacing } from '@/ui/tokens';

import { type DryRunSummary, joinParts, tierTone } from './logic';
import { STR } from './strings';
import type { ItemDryRun, ServerBlock } from './types';

export interface DryRunPanelProps {
  perItem: ItemDryRun[];
  summary: DryRunSummary;
  /** Items changed since this run — results shown as historical only. */
  stale: boolean;
  acknowledged: boolean;
  onToggleAck: () => void;
  serverBlock: ServerBlock | null;
}

export function DryRunPanel({
  perItem,
  summary,
  stale,
  acknowledged,
  onToggleAck,
  serverBlock,
}: DryRunPanelProps): React.ReactElement {
  const { t } = useT();
  const theme = useTheme();

  const showAck =
    !stale &&
    summary.ran &&
    !summary.hasAbsolute &&
    !summary.hasBlocking &&
    summary.advisoryCount > 0;

  return (
    <View style={styles.wrap}>
      {stale ? (
        <View
          style={[styles.notice, { backgroundColor: theme.status.warningSoft }]}
        >
          <Text style={[styles.noticeText, { color: theme.status.warning }]}>
            {t(STR.dryRunStale)}
          </Text>
        </View>
      ) : null}

      {perItem.map((rec) => {
        const r = rec.result;
        const assessments = r?.assessments ?? [];
        const failed = r === null || rec.errorMessage !== null;
        const cleanPass = !failed && r?.clear === true && assessments.length === 0;
        return (
          <View
            key={`${rec.itemIndex}-${rec.drugName}`}
            style={[
              styles.card,
              { borderColor: theme.line, backgroundColor: theme.bgElevated },
            ]}
          >
            <Text style={[styles.drug, { color: theme.fg }]}>
              {rec.drugName}
            </Text>

            {failed ? (
              <Text style={[styles.reason, { color: theme.status.danger }]}>
                {t(STR.dryRunItemFailed)}
              </Text>
            ) : cleanPass ? (
              <StatusPill label={t(STR.noFindings)} tone="success" />
            ) : (
              <>
                {assessments.map((a, i) => (
                  <View key={`${a.primitive ?? 'p'}-${i}`} style={styles.finding}>
                    <StatusPill
                      label={t(
                        a.tier === 'ADVISORY'
                          ? STR.tierAdvisory
                          : a.tier === 'ABSOLUTE'
                            ? STR.tierAbsolute
                            : STR.tierBlocking,
                      )}
                      tone={tierTone(a.tier)}
                    />
                    <Text style={[styles.reason, { color: theme.fg }]}>
                      {joinParts([a.primitive, a.reason]) ||
                        t(STR.tierBlocking)}
                    </Text>
                  </View>
                ))}
                {r?.structuredAllergySourceUnavailable === true ? (
                  <Text style={[styles.honesty, { color: theme.status.warningText }]}>
                    {t(STR.allergySourceUnavailable)}
                  </Text>
                ) : null}
                {r?.structuredMedicationSourceUnavailable === true ? (
                  <Text style={[styles.honesty, { color: theme.status.warningText }]}>
                    {t(STR.medSourceUnavailable)}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        );
      })}

      {serverBlock !== null ? (
        <View
          style={[
            styles.card,
            styles.serverBlock,
            { borderColor: theme.status.danger, backgroundColor: theme.status.dangerSoft },
          ]}
          accessibilityRole="alert"
        >
          <Text style={[styles.drug, { color: theme.status.danger }]}>
            {t(STR.serverBlockTitle)}
          </Text>
          {serverBlock.message !== null ? (
            <Text style={[styles.reason, { color: theme.status.danger }]}>
              {serverBlock.message}
            </Text>
          ) : null}
          {serverBlock.findings.map((f, i) => (
            <Text
              key={`${f.itemIndex ?? i}-${i}`}
              style={[styles.reason, { color: theme.status.danger }]}
            >
              {joinParts([
                f.drugName,
                [
                  ...(f.absolutePrimitives ?? []),
                  ...(f.overridablePrimitives ?? []),
                  ...(f.flaggedPrimitives ?? []),
                ].join(', '),
              ])}
            </Text>
          ))}
          <Text style={[styles.reason, { color: theme.status.danger }]}>
            {t(STR.blockedNote)}
          </Text>
        </View>
      ) : null}

      {!stale && summary.ran && (summary.hasAbsolute || summary.hasBlocking) ? (
        <View
          style={[styles.notice, { backgroundColor: theme.status.dangerSoft }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.noticeText, { color: theme.status.danger }]}>
            {t(STR.blockedNote)}
          </Text>
        </View>
      ) : null}

      {showAck ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acknowledged }}
          accessibilityLabel={t(STR.ackLabel)}
          onPress={onToggleAck}
          style={[styles.ackRow, { borderColor: theme.lineStrong }]}
          testID="ack-warnings"
        >
          <View
            style={[
              styles.ackBox,
              {
                borderColor: theme.status.warning,
                backgroundColor: acknowledged
                  ? theme.status.warning
                  : 'transparent',
              },
            ]}
          >
            {acknowledged ? (
              <Text style={[styles.ackTick, { color: theme.status.warningFg }]}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text style={[styles.ackText, { color: theme.fg }]}>
            {t(STR.ackLabel)}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  notice: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { fontSize: fontSize.bodySm, fontWeight: '600' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  serverBlock: { borderWidth: 1 },
  drug: { fontSize: fontSize.body, fontWeight: '700' },
  finding: { gap: spacing.xs, marginTop: spacing.xs },
  reason: { fontSize: fontSize.bodySm, lineHeight: 20 },
  honesty: { fontSize: fontSize.caption, marginTop: spacing.xs },
  ackRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  ackBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackTick: { fontSize: fontSize.bodySm, fontWeight: '700' },
  ackText: { flex: 1, fontSize: fontSize.bodySm, lineHeight: 20 },
});

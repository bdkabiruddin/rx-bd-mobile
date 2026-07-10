// Doctor prescribe + e-sign — THE safety-critical Phase-2 surface.
//
// Backend contract (mirrored precisely):
//   GET  /patients/{id}/allergies            — allergy banner (always on top)
//   GET  /me/prescription-templates          — template library
//   POST /me/prescription-templates/{id}/use — apply + count usage
//   GET  /me/drafts/prescriptions?patientId= — cross-device resume probe
//   POST /prescriptions/draft                — create-or-resume server draft
//   PUT  /prescriptions/{id}/draft           — autonomous draft update
//   POST /clinical/prescription-dry-run      — per-item safety dry-run
//   POST /prescriptions/{id}/sign            — two-key sign (DRAFT → ACTIVE)
//
// INTERLOCK (never weakened): Sign stays disabled until a dry-run has
// been executed against the EXACT current medication list; ABSOLUTE /
// BLOCKING findings disable signing with no client-side override; ADVISORY
// warnings demand an explicit acknowledgement. The server re-runs the
// 12-primitive gate at sign time — a 409 SAFETY_BLOCK is rendered
// faithfully, never swallowed. The whole compose state lives in useDraft
// (encrypted, survives app-kill/lock), keyed per patient.

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api } from '@/api/client';
import { useCachedQuery } from '@/api/useCachedQuery';
import { useSession } from '@/auth/sessionStore';
import { DryRunPanel } from '@/features/doctor-prescribe/DryRunPanel';
import { ItemRow } from '@/features/doctor-prescribe/ItemRow';
import {
  activeAllergies,
  buildDraftBody,
  buildDryRunBody,
  emptyComposeState,
  emptyItem,
  extractServerBlock,
  isPristine,
  itemsFingerprint,
  joinParts,
  MAX_ITEMS,
  openDraftToCompose,
  severityTone,
  signBlockReason,
  summarizeDryRun,
  templateItemsToCompose,
} from '@/features/doctor-prescribe/logic';
import { signServerDraft } from '@/features/doctor-prescribe/signPrescription';
import {
  severityLabel,
  signBlockLabel,
  STR,
} from '@/features/doctor-prescribe/strings';
import type {
  AllergiesPayload,
  ComposeItem,
  ComposeState,
  DrugCatalogPayload,
  DrugLite,
  DryRunResultLite,
  FindOpenDraftPayload,
  ItemDryRun,
  SaveDraftResult,
  ServerBlock,
  TemplatesPayload,
  TemplateUsePayload,
} from '@/features/doctor-prescribe/types';
import { COMMON, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ListRow } from '@/ui/ListRow';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { StatusPill } from '@/ui/StatusPill';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';

export default function PrescribeScreen(): React.ReactElement {
  const { t } = useT();
  const theme = useTheme();
  const router = useRouter();
  const userId = useSession((s) => s.userId);

  const params = useLocalSearchParams<{ patientId: string }>();
  const patientId =
    typeof params.patientId === 'string' && params.patientId.length > 0
      ? params.patientId
      : undefined;

  // ── Compose state — encrypted, autosaved, survives app-kill/lock ─────────
  const draft = useDraft<ComposeState>(
    `doctor-prescribe:${patientId ?? 'unknown'}`,
    emptyComposeState(),
  );
  const state = draft.value;

  // ── Ephemeral interlock state (never persisted — a restart forces a
  //    fresh dry-run; staleness can only strengthen the gate) ──────────────
  const [dryRun, setDryRun] = React.useState<{
    fingerprint: string;
    perItem: ItemDryRun[];
  } | null>(null);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [serverBlock, setServerBlock] = React.useState<ServerBlock | null>(null);
  const [dryRunBusy, setDryRunBusy] = React.useState(false);
  const [signBusy, setSignBusy] = React.useState(false);
  const [showIssues, setShowIssues] = React.useState(false);
  const [templateBusyId, setTemplateBusyId] = React.useState<string | null>(null);

  // ── Reads ────────────────────────────────────────────────────────────────
  const allergyQuery = useCachedQuery<AllergiesPayload>({
    key: `doctor:prescribe:allergies:${patientId ?? 'unknown'}`,
    path: `/api/v1/patients/${patientId ?? 'unknown'}/allergies`,
    ttlMs: 5 * 60 * 1000,
    isPhi: true,
    enabled: patientId !== undefined,
    ...(userId !== null ? { userId } : {}),
  });

  const templatesQuery = useCachedQuery<TemplatesPayload>({
    key: 'doctor:prescribe:templates',
    path: '/api/v1/me/prescription-templates',
    ttlMs: 15 * 60 * 1000,
    isPhi: true,
    ...(userId !== null ? { userId } : {}),
  });

  // ── Cross-device resume probe (one-shot; local pristine state only) ─────
  const probedRef = React.useRef(false);
  const setValueRef = React.useRef(draft.setValue);
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    setValueRef.current = draft.setValue;
    stateRef.current = state;
  });

  React.useEffect(() => {
    if (!draft.restored || patientId === undefined || probedRef.current) return;
    probedRef.current = true;
    void (async () => {
      const res = await api.get<FindOpenDraftPayload>(
        `/api/v1/me/drafts/prescriptions?patientId=${encodeURIComponent(patientId)}`,
      );
      // Probe failures are non-fatal: composing continues locally and
      // POST /prescriptions/draft is create-or-resume server-side anyway.
      if (!res.ok) return;
      const server = res.value?.draft;
      if (!server) return;
      const local = stateRef.current;
      if (isPristine(local)) {
        setValueRef.current(openDraftToCompose(server));
      } else if (local.serverDraftId === null && server.prescriptionId) {
        setValueRef.current({ ...local, serverDraftId: server.prescriptionId });
      }
    })();
  }, [draft.restored, patientId]);

  // ── Derivations ──────────────────────────────────────────────────────────
  const fingerprint = itemsFingerprint(state.items);
  const dryRunFresh = dryRun !== null && dryRun.fingerprint === fingerprint;
  const summary = summarizeDryRun(
    dryRun !== null && dryRun.fingerprint === fingerprint ? dryRun.perItem : null,
    state.items.length,
  );
  const gateReason = signBlockReason({
    items: state.items,
    diagnosisText: state.diagnosisText,
    dryRunFresh,
    summary,
    acknowledged,
  });
  // A server-side 409 SAFETY_BLOCK also pins Sign disabled until the
  // medications change (mutators clear `serverBlock`) — the backend's
  // verdict is never retried around from the client.
  const blockReason = serverBlock !== null ? 'safety-block' : gateReason;

  // ── Compose-state mutators (plain closures over the current render's
  //    state — standard controlled-form pattern used across the app) ───────
  const patchItem = (index: number, patch: Partial<ComposeItem>): void => {
    draft.setValue({
      ...state,
      items: state.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    });
    setServerBlock(null);
  };

  const addItem = (): void => {
    if (state.items.length >= MAX_ITEMS) {
      Alert.alert(t(STR.maxItemsReached));
      return;
    }
    draft.setValue({ ...state, items: [...state.items, emptyItem()] });
  };

  const removeItem = (index: number): void => {
    Alert.alert(t(STR.removeConfirmTitle), t(STR.removeConfirmMsg), [
      { text: t(COMMON.cancel), style: 'cancel' },
      {
        text: t(COMMON.confirm),
        style: 'destructive',
        onPress: () => {
          const current = stateRef.current;
          setValueRef.current({
            ...current,
            items: current.items.filter((_, i) => i !== index),
          });
          setServerBlock(null);
        },
      },
    ]);
  };

  // ── Draft save (create-or-resume → update) ──────────────────────────────
  const draftWrite = useWrite<SaveDraftResult>();

  const persistDraft = React.useCallback(async (): Promise<string | null> => {
    if (patientId === undefined) return null;
    const current = stateRef.current;
    const body = buildDraftBody(current, patientId);
    const res = current.serverDraftId
      ? await draftWrite.submit({
          method: 'PUT',
          path: `/api/v1/prescriptions/${current.serverDraftId}/draft`,
          body,
        })
      : await draftWrite.submit({
          method: 'POST',
          path: '/api/v1/prescriptions/draft',
          body,
        });
    if (!res.ok) {
      if (res.error.code === 'OFFLINE') {
        Alert.alert(t(COMMON.offline), t(STR.offlineWrite));
      } else {
        Alert.alert(t(STR.draftSaveFailed), res.error.message);
      }
      return null;
    }
    const id = res.value?.prescriptionId ?? current.serverDraftId;
    if (id && id !== current.serverDraftId) {
      setValueRef.current({ ...stateRef.current, serverDraftId: id });
    }
    return id ?? null;
  }, [patientId, draftWrite, t]);

  const onSaveDraft = async (): Promise<void> => {
    const id = await persistDraft();
    if (id !== null) Alert.alert(t(STR.draftSavedTitle), t(STR.draftSavedMsg));
  };

  // ── Dry run — per item, sequential, results rendered faithfully ─────────
  const runDryRun = async (): Promise<void> => {
    if (patientId === undefined || state.items.length === 0) return;
    setShowIssues(true);
    if (state.items.some((i) => i.drugName.trim().length === 0)) return;
    setDryRunBusy(true);
    setServerBlock(null);
    setAcknowledged(false);
    const runFingerprint = itemsFingerprint(state.items);
    const perItem: ItemDryRun[] = [];
    for (let i = 0; i < state.items.length; i += 1) {
      const item = state.items[i];
      if (item === undefined) continue;
      const res = await api.post<DryRunResultLite>(
        '/api/v1/clinical/prescription-dry-run',
        buildDryRunBody(item, patientId),
      );
      perItem.push({
        itemIndex: i,
        drugName: item.drugName.trim(),
        result: res.ok ? (res.value ?? null) : null,
        errorMessage: res.ok ? null : res.error.message,
      });
    }
    setDryRun({ fingerprint: runFingerprint, perItem });
    setDryRunBusy(false);
  };

  // ── Templates ────────────────────────────────────────────────────────────
  const templateWrite = useWrite<TemplateUsePayload>();

  const applyTemplate = async (templateId: string): Promise<void> => {
    setTemplateBusyId(templateId);
    const res = await templateWrite.submit({
      method: 'POST',
      path: `/api/v1/me/prescription-templates/${templateId}/use`,
    });
    if (!res.ok) {
      setTemplateBusyId(null);
      if (res.error.code === 'OFFLINE') {
        Alert.alert(t(COMMON.offline), t(STR.offlineWrite));
      } else {
        Alert.alert(t(STR.templateApplyFailed), res.error.message);
      }
      return;
    }
    // Template items reference catalog ids — resolve names via the live
    // catalog; unresolvable rows stay honestly blank.
    const catalogRes = await api.get<DrugCatalogPayload>('/api/v1/drug-catalog');
    const drugsById = new Map<string, DrugLite>();
    if (catalogRes.ok) {
      for (const d of catalogRes.value?.drugs ?? []) drugsById.set(d.id, d);
    }
    const mapped = templateItemsToCompose(res.value?.items, drugsById);
    const current = stateRef.current;
    setValueRef.current({
      ...current,
      items: [...current.items, ...mapped].slice(0, MAX_ITEMS),
    });
    setServerBlock(null);
    setTemplateBusyId(null);
    Alert.alert(t(STR.templateApplied));
  };

  // ── Sign — two-key, interlocked ──────────────────────────────────────────
  const doSign = async (): Promise<void> => {
    if (patientId === undefined) return;
    setSignBusy(true);
    try {
      // 1) Push the exact composed payload to the server draft first — the
      //    sign endpoint promotes the SERVER row, so it must match what the
      //    doctor sees and what the dry-run checked.
      const prescriptionId = await persistDraft();
      if (prescriptionId === null) return;

      // 2) Two-key sign: biometric step-up → intent-pinned reverify token →
      //    POST /prescriptions/{id}/sign (server re-runs the safety gate).
      const res = await signServerDraft({
        prescriptionId,
        promptMessage: t(STR.signPrompt),
      });
      if (res.ok) {
        draft.clear();
        setDryRun(null);
        setAcknowledged(false);
        Alert.alert(t(STR.signedTitle), t(STR.signedMsg), [
          { text: t(COMMON.confirm), onPress: () => router.back() },
        ]);
        return;
      }
      if (res.error.code === 'OFFLINE') {
        Alert.alert(t(COMMON.offline), t(STR.offlineWrite));
        return;
      }
      const block = extractServerBlock(res.error.details);
      if (res.error.code === 'CONFLICT' && block !== null) {
        // Server safety gate refused — render its findings verbatim.
        setServerBlock(block);
        return;
      }
      Alert.alert(t(COMMON.genericError), res.error.message);
    } finally {
      setSignBusy(false);
    }
  };

  const onSignPress = (): void => {
    setShowIssues(true);
    if (blockReason !== null) return;
    Alert.alert(t(STR.signConfirmTitle), t(STR.signConfirmMsg), [
      { text: t(COMMON.cancel), style: 'cancel' },
      { text: t(COMMON.confirm), onPress: () => void doSign() },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (patientId === undefined) {
    return (
      <ScreenScaffold phi>
        <SectionHeader title={t(STR.title)} />
        <EmptyState title={t(STR.invalidPatient)} />
      </ScreenScaffold>
    );
  }

  if (!draft.restored) {
    return (
      <ScreenScaffold phi>
        <SectionHeader title={t(STR.title)} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </ScreenScaffold>
    );
  }

  const allergies = activeAllergies(allergyQuery.data?.allergies);
  const templates = templatesQuery.data?.templates ?? [];

  return (
    <ScreenScaffold phi>
      <SectionHeader
        title={t(STR.title)}
        right={<FreshnessBadge fetchedAt={allergyQuery.fetchedAt} />}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Allergy banner — ALWAYS on top, danger treatment ─────────── */}
        <View
          style={[
            styles.allergyBanner,
            {
              borderColor: theme.status.danger,
              backgroundColor: theme.status.dangerSoft,
            },
          ]}
          accessibilityRole="alert"
        >
          <Text style={[styles.allergyTitle, { color: theme.status.danger }]}>
            {t(STR.allergiesTitle)}
          </Text>
          {allergyQuery.isLoading ? (
            <ActivityIndicator />
          ) : allergyQuery.error && !allergyQuery.data ? (
            <>
              <Text style={[styles.allergyText, { color: theme.status.danger }]}>
                {t(STR.allergyLoadFailed)}
              </Text>
              <Button
                title={t(COMMON.retry)}
                variant="secondary"
                accessibilityLabel={t(COMMON.retry)}
                onPress={allergyQuery.refetch}
              />
            </>
          ) : allergies.length === 0 ? (
            <Text style={[styles.allergyText, { color: theme.fgMuted }]}>
              {t(STR.noAllergies)}
            </Text>
          ) : (
            allergies.map((a) => (
              <View key={a.id} style={styles.allergyRow}>
                <StatusPill
                  label={t(severityLabel(a.severity))}
                  tone={severityTone(a.severity)}
                />
                <Text
                  style={[styles.allergyText, { color: theme.fg }]}
                  numberOfLines={2}
                >
                  {joinParts([a.allergenDisplay, a.reaction]) || '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Medication items ─────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(STR.medications)}
        </Text>
        {state.items.length === 0 ? (
          <Text style={[styles.muted, { color: theme.fgMuted }]}>
            {t(STR.noItemsYet)}
          </Text>
        ) : (
          state.items.map((item, index) => (
            <ItemRow
              key={index}
              index={index}
              item={item}
              showIssues={showIssues}
              onPatch={patchItem}
              onRemove={removeItem}
            />
          ))
        )}
        <Button
          title={t(STR.addMedication)}
          variant="secondary"
          accessibilityLabel={t(STR.addMedication)}
          testID="add-medication"
          onPress={addItem}
        />

        {/* ── Diagnosis / notes / meta ─────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(STR.detailsTitle)}
        </Text>
        <TextField
          label={t(STR.diagnosisLabel)}
          value={state.diagnosisText}
          onChangeText={(v) => draft.setValue({ ...state, diagnosisText: v })}
          autoCapitalize="characters"
          autoCorrect={false}
          hint={t(STR.diagnosisHint)}
          testID="diagnosis-codes"
        />
        <TextField
          label={t(STR.notesLabel)}
          value={state.notes}
          onChangeText={(v) => draft.setValue({ ...state, notes: v })}
          multiline
          testID="notes"
        />
        <TextField
          label={t(STR.refillsLabel)}
          value={state.refillsAllowed}
          onChangeText={(v) => draft.setValue({ ...state, refillsAllowed: v })}
          keyboardType="number-pad"
          testID="refills"
        />
        <TextField
          label={t(STR.validDaysLabel)}
          value={state.validUntilDays}
          onChangeText={(v) => draft.setValue({ ...state, validUntilDays: v })}
          keyboardType="number-pad"
          testID="valid-days"
        />

        {/* ── Templates ────────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(STR.templatesTitle)}
        </Text>
        {templatesQuery.isLoading ? (
          <ActivityIndicator />
        ) : templatesQuery.error && !templatesQuery.data ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={templatesQuery.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={templatesQuery.refetch}
          />
        ) : templates.length === 0 ? (
          <Text style={[styles.muted, { color: theme.fgMuted }]}>
            {t(STR.templatesEmpty)}
          </Text>
        ) : (
          templates.map((tpl) => (
            <ListRow
              key={tpl.id}
              title={tpl.name ?? '—'}
              {...(tpl.description ? { subtitle: tpl.description } : {})}
              meta={
                templateBusyId === tpl.id
                  ? t(COMMON.loading)
                  : t(STR.applyTemplate)
              }
              accessibilityLabel={`${t(STR.applyTemplate)}: ${tpl.name ?? ''}`}
              onPress={() => {
                if (templateBusyId === null) void applyTemplate(tpl.id);
              }}
            />
          ))
        )}

        {/* ── Safety check (dry run) ───────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.fg }]}>
          {t(STR.dryRunTitle)}
        </Text>
        <Text style={[styles.muted, { color: theme.fgMuted }]}>
          {t(STR.dryRunExplain)}
        </Text>
        <Button
          title={t(STR.runDryRun)}
          loading={dryRunBusy}
          disabled={state.items.length === 0 || dryRunBusy}
          accessibilityLabel={t(STR.runDryRun)}
          testID="run-dry-run"
          onPress={() => void runDryRun()}
        />
        {dryRun !== null ? (
          <DryRunPanel
            perItem={dryRun.perItem}
            summary={summary}
            stale={!dryRunFresh}
            acknowledged={acknowledged}
            onToggleAck={() => setAcknowledged((v) => !v)}
            serverBlock={serverBlock}
          />
        ) : serverBlock !== null ? (
          <DryRunPanel
            perItem={[]}
            summary={summary}
            stale={false}
            acknowledged={acknowledged}
            onToggleAck={() => setAcknowledged((v) => !v)}
            serverBlock={serverBlock}
          />
        ) : null}

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <Button
            title={t(STR.saveDraft)}
            variant="secondary"
            loading={draftWrite.busy && !signBusy}
            disabled={draftWrite.busy || signBusy}
            accessibilityLabel={t(STR.saveDraft)}
            testID="save-draft"
            onPress={() => void onSaveDraft()}
          />
          <Button
            title={t(STR.sign)}
            loading={signBusy}
            disabled={blockReason !== null || signBusy || dryRunBusy}
            accessibilityLabel={t(STR.sign)}
            testID="sign-prescription"
            onPress={onSignPress}
          />
          {blockReason !== null ? (
            <Text
              style={[styles.blockHint, { color: theme.fgMuted }]}
              testID="sign-block-reason"
            >
              {t(signBlockLabel(blockReason))}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  allergyBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  allergyTitle: { fontSize: fontSize.body, fontWeight: '700' },
  allergyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  allergyText: { flex: 1, fontSize: fontSize.bodySm, lineHeight: 20 },
  sectionTitle: { fontSize: fontSize.h3, fontWeight: '700', marginTop: spacing.sm },
  muted: { fontSize: fontSize.bodySm, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  blockHint: { fontSize: fontSize.caption, textAlign: 'center' },
});

// Patient profile summary — birth date, gender, blood group, height and
// national/health identifiers (masked at display time; the backend self-
// read returns them decrypted), links to edit / allergies / privacy, and
// the emergency-contacts section (list + add + remove).
//
//   Reads:  GET /api/v1/me/patient-profile      → { profile | null }
//           GET /api/v1/me/emergency-contacts   → { contacts }
//   Writes: POST   /api/v1/me/emergency-contacts        (useWrite + useDraft)
//           DELETE /api/v1/me/emergency-contacts/{id}   (Alert-confirmed)

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CONTACTS_KEY,
  useMyEmergencyContacts,
  useMyPatientProfile,
} from '@/features/patient-profile/hooks';
import {
  bloodTypeDisplay,
  buildEmergencyContactBody,
  emptyContactForm,
  maskIdentifier,
  sortContactsByPriority,
  type ContactFormIssue,
  type ContactFormValues,
} from '@/features/patient-profile/logic';
import {
  PROFILE_STR,
  genderLabel,
  lactationLabel,
} from '@/features/patient-profile/strings';
import type {
  CreateEmergencyContactResponse,
  DeleteEmergencyContactResponse,
  EmergencyContactView,
} from '@/features/patient-profile/types';
import { COMMON, formatDate, useT } from '@/i18n';
import { useWrite } from '@/offline/useWrite';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FreshnessBadge } from '@/ui/FreshnessBadge';
import { ScreenScaffold } from '@/ui/ScreenScaffold';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { useDraft } from '@/ui/useDraft';
import { useTheme } from '@/ui/theme';
import { fontSize, radius, spacing } from '@/ui/tokens';

function FactRow({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.factRow}>
      <Text style={[styles.factLabel, { color: theme.fgMuted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.fg }]}>{value}</Text>
    </View>
  );
}

export default function PatientProfileHome(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, t } = useT();

  const profileQ = useMyPatientProfile();
  const contactsQ = useMyEmergencyContacts();

  // ── Add-contact form (collapsed by default; draft survives app-kill) ──
  const [formOpen, setFormOpen] = React.useState(false);
  const draft = useDraft<ContactFormValues>('patient:profile:contact-add', emptyContactForm());
  const d = draft.value;
  const setD = (patch: Partial<ContactFormValues>): void =>
    draft.setValue({ ...draft.value, ...patch });
  const [issue, setIssue] = React.useState<ContactFormIssue | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const addWrite = useWrite<CreateEmergencyContactResponse>();
  const removeWrite = useWrite<DeleteEmergencyContactResponse>();

  const issueText = (i: ContactFormIssue): string => {
    switch (i.field) {
      case 'name':
        return t(PROFILE_STR.nameRequired);
      case 'relationship':
        return t(PROFILE_STR.relationshipRequired);
      case 'phone':
        return t(PROFILE_STR.phoneInvalid);
      case 'email':
        return t(PROFILE_STR.emailInvalid);
    }
  };

  const onSaveContact = async (): Promise<void> => {
    setServerError(null);
    const built = buildEmergencyContactBody(draft.value);
    if (!built.ok) {
      setIssue(built.issue);
      return;
    }
    setIssue(null);
    const res = await addWrite.submit({
      method: 'POST',
      path: '/api/v1/me/emergency-contacts',
      body: built.body,
    });
    if (res.ok) {
      draft.clear();
      draft.setValue(emptyContactForm());
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
      Alert.alert(t(PROFILE_STR.contactSaved));
    } else if (res.error.code === 'OFFLINE') {
      setServerError(t(PROFILE_STR.offlineWrite));
    } else {
      setServerError(res.error.message || t(COMMON.genericError));
    }
  };

  const onRemoveContact = (contact: EmergencyContactView): void => {
    Alert.alert(t(PROFILE_STR.removeContactTitle), t(PROFILE_STR.removeContactBody), [
      { text: t(PROFILE_STR.keep), style: 'cancel' },
      {
        text: t(PROFILE_STR.removeContact),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await removeWrite.submit({
              method: 'DELETE',
              path: `/api/v1/me/emergency-contacts/${encodeURIComponent(contact.id)}`,
            });
            if (res.ok) {
              void queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
            } else if (res.error.code === 'OFFLINE') {
              Alert.alert(t(COMMON.offline), t(PROFILE_STR.offlineWrite));
            } else {
              Alert.alert(t(COMMON.genericError), res.error.message);
            }
          })();
        },
      },
    ]);
  };

  const profile = profileQ.data?.profile;
  const contacts = contactsQ.data?.contacts;
  const sortedContacts = React.useMemo(
    () => (contacts ? sortContactsByPriority(contacts) : []),
    [contacts],
  );

  const notSet = t(PROFILE_STR.notSet);
  const blood = bloodTypeDisplay(profile?.bloodType);

  return (
    <ScreenScaffold phi>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionHeader
          title={t(PROFILE_STR.profileTitle)}
          right={<FreshnessBadge fetchedAt={profileQ.fetchedAt} />}
        />

        {profileQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : profileQ.error && profileQ.data === undefined ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={profileQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={profileQ.refetch}
          />
        ) : !profile ? (
          <EmptyState
            title={t(PROFILE_STR.noProfileYet)}
            message={t(PROFILE_STR.noProfileHint)}
            actionLabel={t(PROFILE_STR.editProfile)}
            onAction={() => router.push('/(patient)/profile/edit')}
          />
        ) : (
          <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}>
            <FactRow
              label={t(PROFILE_STR.birthDate)}
              value={profile.birthDate ? formatDate(profile.birthDate, lang) : notSet}
            />
            <FactRow
              label={t(PROFILE_STR.gender)}
              value={profile.gender ? t(genderLabel(profile.gender)) : notSet}
            />
            <FactRow
              label={t(PROFILE_STR.bloodGroup)}
              value={blood ?? (profile.bloodType === 'UNKNOWN' ? t(PROFILE_STR.bloodUnknown) : notSet)}
            />
            <FactRow
              label={t(PROFILE_STR.height)}
              value={
                profile.heightCm
                  ? `${profile.heightCm} ${t(PROFILE_STR.heightCmUnit)}`
                  : notSet
              }
            />
            <FactRow
              label={t(PROFILE_STR.lactation)}
              value={profile.lactationStatus ? t(lactationLabel(profile.lactationStatus)) : notSet}
            />
            <FactRow
              label={t(PROFILE_STR.nationalId)}
              value={profile.nationalId ? maskIdentifier(profile.nationalId) : notSet}
            />
            <FactRow
              label={t(PROFILE_STR.birthRegNo)}
              value={profile.birthRegNo ? maskIdentifier(profile.birthRegNo) : notSet}
            />
            <FactRow
              label={t(PROFILE_STR.healthId)}
              value={profile.healthId ? maskIdentifier(profile.healthId) : notSet}
            />
            <Text style={[styles.maskNote, { color: theme.fgSubtle }]}>
              {t(PROFILE_STR.maskedHint)}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title={t(PROFILE_STR.editProfile)}
            accessibilityLabel={t(PROFILE_STR.editProfile)}
            testID="profile-edit-link"
            onPress={() => router.push('/(patient)/profile/edit')}
          />
          <Button
            title={t(PROFILE_STR.allergiesLink)}
            variant="secondary"
            accessibilityLabel={t(PROFILE_STR.allergiesLink)}
            testID="profile-allergies-link"
            onPress={() => router.push('/(patient)/profile/allergies')}
          />
          <Button
            title={t(PROFILE_STR.privacyLink)}
            variant="secondary"
            accessibilityLabel={t(PROFILE_STR.privacyLink)}
            testID="profile-privacy-link"
            onPress={() => router.push('/(patient)/profile/privacy')}
          />
        </View>

        {/* ── Emergency contacts ── */}
        <SectionHeader
          title={t(PROFILE_STR.contactsTitle)}
          right={<FreshnessBadge fetchedAt={contactsQ.fetchedAt} />}
        />

        {contactsQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : contactsQ.error && contactsQ.data === undefined ? (
          <EmptyState
            title={t(COMMON.genericError)}
            message={contactsQ.error.message}
            actionLabel={t(COMMON.retry)}
            onAction={contactsQ.refetch}
          />
        ) : sortedContacts.length === 0 ? (
          <EmptyState
            title={t(PROFILE_STR.noContacts)}
            message={t(PROFILE_STR.noContactsHint)}
          />
        ) : (
          <View style={styles.contactList}>
            {sortedContacts.map((c) => (
              <View
                key={c.id}
                style={[styles.contactCard, { borderColor: theme.line, backgroundColor: theme.bgElevated }]}
                testID={`contact-${c.id}`}
              >
                <View style={styles.contactMain}>
                  <Text style={[styles.contactName, { color: theme.fg }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[styles.contactMeta, { color: theme.fgMuted }]} numberOfLines={1}>
                    {c.relationship} · {c.phoneE164}
                  </Text>
                  {c.email ? (
                    <Text style={[styles.contactMeta, { color: theme.fgMuted }]} numberOfLines={1}>
                      {c.email}
                    </Text>
                  ) : null}
                </View>
                <Button
                  title={t(PROFILE_STR.removeContact)}
                  variant="ghost"
                  accessibilityLabel={`${t(PROFILE_STR.removeContact)} — ${c.name}`}
                  disabled={removeWrite.busy}
                  onPress={() => onRemoveContact(c)}
                />
              </View>
            ))}
          </View>
        )}

        {formOpen ? (
          <View style={styles.form}>
            {!draft.restored ? (
              <ActivityIndicator />
            ) : (
              <>
                <TextField
                  label={t(PROFILE_STR.contactName)}
                  value={d.name}
                  onChangeText={(name) => setD({ name })}
                  maxLength={120}
                  {...(issue?.field === 'name' ? { error: issueText(issue) } : {})}
                  testID="contact-name"
                />
                <TextField
                  label={t(PROFILE_STR.relationship)}
                  hint={t(PROFILE_STR.relationshipHint)}
                  value={d.relationship}
                  onChangeText={(relationship) => setD({ relationship })}
                  maxLength={40}
                  {...(issue?.field === 'relationship' ? { error: issueText(issue) } : {})}
                  testID="contact-relationship"
                />
                <TextField
                  label={t(PROFILE_STR.contactPhone)}
                  hint={t(PROFILE_STR.contactPhoneHint)}
                  value={d.phone}
                  onChangeText={(phone) => setD({ phone })}
                  keyboardType="phone-pad"
                  {...(issue?.field === 'phone' ? { error: issueText(issue) } : {})}
                  testID="contact-phone"
                />
                <TextField
                  label={t(PROFILE_STR.contactEmail)}
                  value={d.email}
                  onChangeText={(email) => setD({ email })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  {...(issue?.field === 'email' ? { error: issueText(issue) } : {})}
                  testID="contact-email"
                />
                <TextField
                  label={t(PROFILE_STR.contactNotes)}
                  value={d.notes}
                  onChangeText={(notes) => setD({ notes })}
                  maxLength={1000}
                  multiline
                  testID="contact-notes"
                />
                {serverError !== null ? (
                  <Text style={[styles.error, { color: theme.status.danger }]}>{serverError}</Text>
                ) : null}
                <Button
                  title={t(PROFILE_STR.saveContact)}
                  loading={addWrite.busy}
                  disabled={addWrite.busy}
                  accessibilityLabel={t(PROFILE_STR.saveContact)}
                  testID="save-contact"
                  onPress={() => void onSaveContact()}
                />
                <Button
                  title={t(COMMON.cancel)}
                  variant="ghost"
                  accessibilityLabel={t(COMMON.cancel)}
                  onPress={() => {
                    setIssue(null);
                    setServerError(null);
                    setFormOpen(false);
                  }}
                />
              </>
            )}
          </View>
        ) : (
          <View style={styles.form}>
            <Button
              title={t(PROFILE_STR.addContact)}
              variant="secondary"
              accessibilityLabel={t(PROFILE_STR.addContact)}
              testID="add-contact"
              onPress={() => setFormOpen(true)}
            />
          </View>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    marginHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  factLabel: { fontSize: fontSize.bodySm, flexShrink: 1 },
  factValue: { fontSize: fontSize.body, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  maskNote: { fontSize: fontSize.caption, paddingVertical: spacing.xs },
  actions: { padding: spacing.lg, gap: spacing.sm },
  contactList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  contactMain: { flex: 1, gap: 2 },
  contactName: { fontSize: fontSize.body, fontWeight: '600' },
  contactMeta: { fontSize: fontSize.bodySm },
  form: { padding: spacing.lg, gap: spacing.md },
  error: { fontSize: fontSize.bodySm, fontWeight: '600' },
});

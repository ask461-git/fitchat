import React, { useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ACTIVITY_LEVEL_KEYS, type Profile } from '../models';
import { useProfileStore } from '../store/profileStore';
import { useDailyLogStore } from '../store/dailyLogStore';
import type { DailyLogState } from '../store/dailyLogStore';
import { calculateBmr, calculateTdee } from '../services/bmr';
import { StatCard } from '../components/StatCard';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import * as db from '../database/db';

export function ProfileScreen(): React.ReactElement {
  const { profile, isLoading, saveProfile } = useProfileStore();
  const syncToSheets = useDailyLogStore((s: DailyLogState) => s.syncToSheets);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [sheetsUrlInput, setSheetsUrlInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [apiUsage, setApiUsage] = useState<{
    totalPromptTokens: number;
    totalCandidatesTokens: number;
    totalCostUsd: number;
  } | null>(null);

  useEffect(() => {
    db.getApiUsageTotals().then(setApiUsage);
    db.getSetting('sheets_url').then(url => {
      setSheetsUrl(url);
      setSheetsUrlInput(url);
    });
  }, []);

  if (isLoading || !profile) return <Loader />;

  if (editing) {
    return (
      <EditForm
        current={profile}
        onSave={async p => {
          await saveProfile(p);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const bmr = Math.round(calculateBmr(profile));
  const tdee = Math.round(calculateTdee(profile));

  // Local currency conversion: default to INR for personal use if env not set.
  const usdToLocalEnv = parseFloat(process.env.EXPO_PUBLIC_USD_TO_LOCAL ?? '');
  const usdToLocal = usdToLocalEnv > 0 ? usdToLocalEnv : 82.5;
  const localCurrency = process.env.EXPO_PUBLIC_LOCAL_CURRENCY ?? 'INR';

  async function handleSaveUrl() {
    const trimmed = sheetsUrlInput.trim();
    setSavingUrl(true);

    // Basic validation
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setSavingUrl(false);
      return Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
    }

    await db.setSetting('sheets_url', trimmed);
    setSheetsUrl(trimmed);

    // If a URL was provided, do a quick POST test to surface success/failure immediately.
    if (trimmed) {
      try {
        setSyncStatus('idle');
        const res = await fetch(trimmed, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && (json === null || json?.ok === true)) {
          setSyncStatus('ok');
          // Try a full sync to ensure app data flows through.
          try { await syncToSheets(); } catch (_) { /* ignore */ }
          Alert.alert('Saved', 'Sheets URL saved and test succeeded.');
        } else {
          setSyncStatus('err');
          Alert.alert('Saved', 'Sheets URL saved but test request failed.');
        }
      } catch (err) {
        setSyncStatus('err');
        Alert.alert('Saved', 'Sheets URL saved but network test failed.');
      } finally {
        setSavingUrl(false);
      }
    } else {
      setSyncStatus('idle');
      setSavingUrl(false);
      Alert.alert('Saved', 'Sheets URL cleared.');
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncStatus('idle');
    try {
      await syncToSheets();
      setSyncStatus('ok');
    } catch {
      setSyncStatus('err');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.sub}>{profile.activityLevel}</Text>

      <View style={styles.statRow}>
        <StatCard label="BMR" value={`${bmr}`} subtitle="kcal/day base" />
        <View style={{ width: SPACING.sm }} />
        <StatCard label="TDEE" value={`${tdee}`} subtitle="kcal/day with activity" />
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="Age" value={`${profile.age} years`} />
        <InfoRow label="Height" value={`${profile.heightCm} cm`} />
        <InfoRow label="Current Weight" value={`${profile.currentWeightKg} kg`} />
        <InfoRow label="Target Weight" value={`${profile.targetWeightKg} kg`} />
        <InfoRow label="To lose" value={`${(profile.currentWeightKg - profile.targetWeightKg).toFixed(1)} kg`} last />
      </View>

      <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
        <Text style={styles.editBtnText}>EDIT PROFILE</Text>
      </TouchableOpacity>

      {/* Google Sheets sync */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionLabel}>GOOGLE SHEETS SYNC</Text>
        <View style={styles.infoCard}>
          <View style={{ paddingVertical: SPACING.sm }}>
            <Text style={styles.syncLabel}>Apps Script Web App URL</Text>
            <View style={styles.urlRow}>
              <TextInput
                style={[styles.urlInput, { flex: 1 }]}
                value={sheetsUrlInput}
                onChangeText={setSheetsUrlInput}
                placeholder="https://script.google.com/macros/s/..."
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={[styles.syncBtn, savingUrl && styles.syncBtnDisabled]}
                onPress={handleSaveUrl}
                disabled={savingUrl}
              >
                <Text style={styles.syncBtnText}>{savingUrl ? 'SAVING…' : 'SAVE'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Auto-syncs after every change.</Text>
            <TouchableOpacity
              style={[styles.syncBtn, (!sheetsUrl || syncing) && styles.syncBtnDisabled]}
              onPress={handleSyncNow}
              disabled={!sheetsUrl || syncing}
            >
              <Text style={styles.syncBtnText}>
                {syncing ? 'SYNCING…' : syncStatus === 'ok' ? '✓ SYNCED' : syncStatus === 'err' ? '✗ FAILED' : 'SYNC NOW'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {apiUsage && (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>GEMINI API USAGE (EST.)</Text>
          <View style={styles.infoCard}>
            <InfoRow
              label="Input tokens"
              value={apiUsage.totalPromptTokens.toLocaleString()}
            />
            <InfoRow
              label="Output tokens"
              value={apiUsage.totalCandidatesTokens.toLocaleString()}
            />
            <InfoRow
              label="Est. cost"
              value={`$${apiUsage.totalCostUsd.toFixed(4)} (${localCurrency} ${(apiUsage.totalCostUsd * usdToLocal).toFixed(2)})`}
              last
            />
          </View>
          <Text style={styles.usageNote}>
            Based on Gemini 2.5 Flash list pricing ($0.075 / $0.30 per 1M tokens).
            Free-tier usage is not deducted.
          </Text>
          <Text style={styles.usageNoteSmall}>
            Showing local conversion to {localCurrency} by default for personal use. Override with EXPO_PUBLIC_USD_TO_LOCAL and EXPO_PUBLIC_LOCAL_CURRENCY.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {!last && <View style={styles.divider} />}
    </>
  );
}

function EditForm({
  current,
  onSave,
  onCancel,
}: {
  current: Profile;
  onSave: (p: Profile) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(current.name);
  const [age, setAge] = useState(String(current.age));
  const [height, setHeight] = useState(String(current.heightCm));
  const [weight, setWeight] = useState(String(current.currentWeightKg));
  const [target, setTarget] = useState(String(current.targetWeightKg));
  const [activity, setActivity] = useState(current.activityLevel);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const ageN = parseInt(age, 10);
    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);
    const targetN = parseFloat(target);

    if (!name.trim()) return Alert.alert('Required', 'Enter your name.');
    if (isNaN(ageN) || ageN < 10) return Alert.alert('Invalid', 'Check age.');
    if (isNaN(heightN) || heightN < 50) return Alert.alert('Invalid', 'Check height (cm).');
    if (isNaN(weightN) || weightN < 20) return Alert.alert('Invalid', 'Check weight (kg).');
    if (isNaN(targetN) || targetN < 20 || targetN >= weightN)
      return Alert.alert('Invalid', 'Target must be less than current weight.');

    setSaving(true);
    await onSave({
      name: name.trim(),
      age: ageN,
      heightCm: heightN,
      currentWeightKg: weightN,
      targetWeightKg: targetN,
      activityLevel: activity,
      updatedAt: new Date().toISOString(),
    });
    setSaving(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.name}>Edit Profile</Text>

        {([
          ['Name', name, setName, 'default', 'words'],
          ['Age', age, setAge, 'number-pad', 'none'],
          ['Height (cm)', height, setHeight, 'decimal-pad', 'none'],
          ['Current Weight (kg)', weight, setWeight, 'decimal-pad', 'none'],
          ['Target Weight (kg)', target, setTarget, 'decimal-pad', 'none'],
        ] as const).map(([label, val, setter, kbType, autoCapitalize]) => (
          <View key={label} style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              style={styles.input}
              value={val}
              onChangeText={setter as (t: string) => void}
              keyboardType={kbType}
              autoCapitalize={autoCapitalize}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        ))}

        <Text style={styles.fieldLabel}>Activity Level</Text>
        <View style={styles.activityList}>
          {ACTIVITY_LEVEL_KEYS.map(level => (
            <TouchableOpacity
              key={level}
              style={[styles.activityBtn, activity === level && styles.activityBtnActive]}
              onPress={() => setActivity(level)}
            >
              <Text
                style={[
                  styles.activityBtnText,
                  activity === level && styles.activityBtnTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.editBtnText}>{saving ? 'SAVING…' : 'SAVE'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  name: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 26, marginBottom: 2 },
  sub: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 12, marginBottom: SPACING.md },
  statRow: { flexDirection: 'row', marginBottom: SPACING.md },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoRow: { flexDirection: 'row', paddingVertical: 14 },
  infoLabel: { flex: 1, color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 14 },
  infoValue: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.divider },
  editBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 14 },
  sectionWrap: { marginTop: SPACING.lg },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  syncLabel: { color: COLORS.textPrimary, fontFamily: FONT.regular, fontSize: 13 },
  syncNote: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 3 },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  urlInput: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
    fontSize: 12,
    fontFamily: FONT.regular,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  syncBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginLeft: SPACING.sm,
  },
  syncBtnDisabled: { backgroundColor: COLORS.surfaceAlt },
  syncBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 12 },
  usageNote: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 11,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  usageNoteSmall: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 11,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  fieldWrap: { marginBottom: SPACING.md },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONT.bold,
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONT.regular,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  activityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    marginTop: SPACING.xs,
  },
  activityBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surfaceAlt,
  },
  activityBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  activityBtnText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12 },
  activityBtnTextActive: { color: COLORS.black },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  btn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 14 },
});

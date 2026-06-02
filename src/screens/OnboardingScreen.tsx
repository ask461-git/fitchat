import React, { useState } from 'react';
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
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

export function OnboardingScreen(): React.ReactElement {
  const saveProfile = useProfileStore(s => s.saveProfile);
  const loadToday = useDailyLogStore(s => s.loadToday);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [target, setTarget] = useState('');
  const [activity, setActivity] = useState('Moderately Active');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const ageN = parseInt(age, 10);
    const heightN = parseFloat(height);
    const weightN = parseFloat(weight);
    const targetN = parseFloat(target);

    if (!name.trim()) return Alert.alert('Required', 'Enter your name.');
    if (isNaN(ageN) || ageN < 10 || ageN > 120)
      return Alert.alert('Invalid', 'Enter a valid age (10–120).');
    if (isNaN(heightN) || heightN < 50 || heightN > 300)
      return Alert.alert('Invalid', 'Enter a valid height in cm.');
    if (isNaN(weightN) || weightN < 20 || weightN > 500)
      return Alert.alert('Invalid', 'Enter a valid current weight in kg.');
    if (isNaN(targetN) || targetN < 20 || targetN >= weightN)
      return Alert.alert('Invalid', 'Target weight must be less than current weight.');

    setSaving(true);
    const profile: Profile = {
      name: name.trim(),
      age: ageN,
      heightCm: heightN,
      currentWeightKg: weightN,
      targetWeightKg: targetN,
      activityLevel: activity,
      updatedAt: new Date().toISOString(),
    };
    await saveProfile(profile);
    await loadToday();
    setSaving(false);
    // Navigation handled reactively in AppNavigator once profile is set.
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Welcome to{'\n'}FitChat</Text>
        <Text style={styles.sub}>Let Kendrick get to know you first, cousin.</Text>

        <Field label="Your Name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
        <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
        <Field label="Current Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <Field label="Target Weight (kg)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />

        <Text style={styles.dropdownLabel}>Activity Level</Text>
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

        <TouchableOpacity
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? 'SAVING…' : "LET'S GO"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.textSecondary}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xl * 2 },
  headline: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontFamily: FONT.bold,
    lineHeight: 42,
    marginBottom: SPACING.xs,
  },
  sub: {
    color: COLORS.accent,
    fontSize: 14,
    fontFamily: FONT.bold,
    marginBottom: SPACING.xl,
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
  dropdownLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONT.bold,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  activityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  activityBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surfaceAlt,
  },
  activityBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  activityBtnText: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  activityBtnTextActive: {
    color: COLORS.black,
  },
  btn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
});

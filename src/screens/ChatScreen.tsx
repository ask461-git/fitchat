import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import { useChatStore } from '../store/chatStore';
import type { DraftMeal, DraftWorkout } from '../store/chatStore';
import { ChatBubble } from '../components/ChatBubble';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import { MEAL_CATEGORIES } from '../models';
import type { ChatMessage } from '../models';

// ---------------------------------------------------------------------------
// List item types — messages interleaved with date separators
// ---------------------------------------------------------------------------

type ListItem =
  | { kind: 'separator'; date: string }
  | { kind: 'message'; data: ChatMessage };

function buildListItems(msgs: ChatMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = '';
  for (const msg of msgs) {
    if (msg.date !== lastDate) {
      items.push({ kind: 'separator', date: msg.date });
      lastDate = msg.date;
    }
    items.push({ kind: 'message', data: msg });
  }
  return items;
}

function formatSeparatorDate(date: string): string {
  const d = dayjs(date);
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return d.format('ddd, MMM D');
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function ChatScreen(): React.ReactElement {
  const {
    messages,
    isSending,
    historyLoaded,
    pendingItems,
    loadToday,
    sendUserMessage,
    loadHistory,
    updateDraftMeal,
    removeDraftMeal,
    addDraftMeal,
    updateDraftWorkout,
    removeDraftWorkout,
    confirmPendingItems,
    rejectPendingItems,
  } = useChatStore();

  const [input, setInput] = React.useState('');
  const [editingMeals, setEditingMeals] = React.useState<Record<string, boolean>>({});
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || pendingItems) return;
    setInput('');
    await sendUserMessage(text);
  }

  const listItems = buildListItems(messages);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>K</Text>
        </View>
        <View>
          <Text style={styles.agentName}>Kendrick</Text>
          <Text style={styles.agentSub}>Your Compton fitness advisor</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={listItems}
        keyExtractor={(item, index) =>
          item.kind === 'separator'
            ? `sep-${item.date}`
            : String((item.data as ChatMessage).id ?? `${(item.data as ChatMessage).timestamp}-${index}`)
        }
        renderItem={({ item }) => {
          if (item.kind === 'separator') {
            return (
              <View style={styles.dateSep}>
                <View style={styles.dateSepLine} />
                <Text style={styles.dateSepText}>{formatSeparatorDate(item.date)}</Text>
                <View style={styles.dateSepLine} />
              </View>
            );
          }
          return (
            <ChatBubble
              text={item.data.content}
              isUser={item.data.role === 'user'}
              timestamp={item.data.timestamp}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          !historyLoaded ? (
            <TouchableOpacity style={styles.loadHistoryBtn} onPress={loadHistory}>
              <Text style={styles.loadHistoryText}>↑ Load previous 7 days</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              "Sit down. I'm kendrick lamar.{'\n'}Tell me what you ate today, cousin."
            </Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {isSending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={styles.typingText}>Kendrick is thinking…</Text>
        </View>
      )}

      {/* Refinement panel — editable before committing */}
      {pendingItems && (
        <View style={styles.refinementPanel}>
          <Text style={styles.refinementTitle}>✏️  Review & refine before logging</Text>
          <Text style={styles.refinementHint}>Tap the button to approve all items as shown, or edit any row before logging.</Text>
          <TouchableOpacity style={styles.quickApproveBtn} onPress={confirmPendingItems}>
            <Text style={styles.quickApproveBtnText}>✓ Approve all and log</Text>
          </TouchableOpacity>
          <ScrollView style={styles.refinementScroll} keyboardShouldPersistTaps="handled">

            {/* Meal rows */}
            {pendingItems.meals.length > 0 && (
              <Text style={styles.refinementSection}>MEALS</Text>
            )}
            {pendingItems.meals.map((m: DraftMeal) => (
              <View key={m.id} style={styles.draftRow}>
                {/* Category pill selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                  {MEAL_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.catPill, m.category === cat && styles.catPillActive]}
                      onPress={() => updateDraftMeal(m.id, { category: cat })}
                    >
                      <Text style={[styles.catPillText, m.category === cat && styles.catPillTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.draftFields}>
                  <TextInput
                    style={[styles.draftInput, { flex: 1 }]}
                    value={m.foodDescription}
                    onChangeText={v => updateDraftMeal(m.id, { foodDescription: v })}
                    placeholder="Food description"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <TextInput
                    style={[styles.draftInput, styles.draftKcal]}
                    value={m.estimatedCalories > 0 ? String(m.estimatedCalories) : ''}
                    onChangeText={v => updateDraftMeal(m.id, { estimatedCalories: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    placeholder="kcal"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  {/* Display Gemini-provided macros read-only by default */}
                  {!editingMeals[m.id] ? (
                    <View style={styles.macroDisplay}>
                      <Text style={styles.macroText}>{`P ${Math.round(m.protein ?? 0)}g · F ${Math.round(m.fat ?? 0)}g · C ${Math.round(
                        m.carbs ?? 0,
                      )}g · Fib ${Math.round(m.fiber ?? 0)}g`}</Text>
                      <TouchableOpacity
                        onPress={() => setEditingMeals(prev => ({ ...prev, [m.id]: true }))}
                        style={styles.editMacroBtn}
                      >
                        <Text style={styles.editMacroBtnText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.macroEditRow}>
                      <TextInput
                        style={[styles.draftInput, styles.macroInput]}
                        value={m.protein ? String(Math.round(m.protein)) : ''}
                        onChangeText={v => updateDraftMeal(m.id, { protein: parseInt(v, 10) || 0 })}
                        keyboardType="number-pad"
                        placeholder="P g"
                        placeholderTextColor={COLORS.textSecondary}
                      />
                      <TextInput
                        style={[styles.draftInput, styles.macroInput]}
                        value={m.fat ? String(Math.round(m.fat)) : ''}
                        onChangeText={v => updateDraftMeal(m.id, { fat: parseInt(v, 10) || 0 })}
                        keyboardType="number-pad"
                        placeholder="F g"
                        placeholderTextColor={COLORS.textSecondary}
                      />
                      <TextInput
                        style={[styles.draftInput, styles.macroInput]}
                        value={m.carbs ? String(Math.round(m.carbs)) : ''}
                        onChangeText={v => updateDraftMeal(m.id, { carbs: parseInt(v, 10) || 0 })}
                        keyboardType="number-pad"
                        placeholder="C g"
                        placeholderTextColor={COLORS.textSecondary}
                      />
                      <TextInput
                        style={[styles.draftInput, styles.macroInput]}
                        value={m.fiber ? String(Math.round(m.fiber)) : ''}
                        onChangeText={v => updateDraftMeal(m.id, { fiber: parseInt(v, 10) || 0 })}
                        keyboardType="number-pad"
                        placeholder="Fib g"
                        placeholderTextColor={COLORS.textSecondary}
                      />
                      <TouchableOpacity
                        onPress={() => setEditingMeals(prev => ({ ...prev, [m.id]: false }))}
                        style={styles.editMacroBtn}
                      >
                        <Text style={styles.editMacroBtnText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => removeDraftMeal(m.id)} style={styles.draftRemove}>
                    <Text style={styles.draftRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addRowBtn} onPress={addDraftMeal}>
              <Text style={styles.addRowBtnText}>+ Add meal item</Text>
            </TouchableOpacity>

            {/* Workout rows */}
            {pendingItems.workouts.length > 0 && (
              <Text style={[styles.refinementSection, { marginTop: SPACING.sm }]}>WORKOUTS</Text>
            )}
            {pendingItems.workouts.map((w: DraftWorkout) => (
              <View key={w.id} style={styles.draftRow}>
                <View style={styles.draftFields}>
                  <TextInput
                    style={[styles.draftInput, { flex: 1 }]}
                    value={w.exerciseType}
                    onChangeText={v => updateDraftWorkout(w.id, { exerciseType: v })}
                    placeholder="Exercise type"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <TextInput
                    style={[styles.draftInput, styles.draftKcal]}
                    value={w.durationMinutes > 0 ? String(w.durationMinutes) : ''}
                    onChangeText={v => updateDraftWorkout(w.id, { durationMinutes: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    placeholder="min"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <TextInput
                    style={[styles.draftInput, styles.draftKcal]}
                    value={w.estimatedCaloriesBurned > 0 ? String(w.estimatedCaloriesBurned) : ''}
                    onChangeText={v => updateDraftWorkout(w.id, { estimatedCaloriesBurned: parseInt(v, 10) || 0 })}
                    keyboardType="number-pad"
                    placeholder="kcal"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <TouchableOpacity onPress={() => removeDraftWorkout(w.id)} style={styles.draftRemove}>
                    <Text style={styles.draftRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

          </ScrollView>

          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.rejectBtn} onPress={rejectPendingItems}>
              <Text style={styles.rejectBtnText}>✕  Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmPendingItems}>
              <Text style={styles.confirmBtnText}>✓  Approve and log</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={[styles.input, pendingItems ? styles.inputDisabled : null]}
          value={input}
          onChangeText={setInput}
          placeholder={
            pendingItems
              ? 'Confirm or re-check above first…'
              : 'Eg. I just had 2 rotis with dal for lunch'
          }
          placeholderTextColor={COLORS.textSecondary}
          multiline
          maxLength={500}
          editable={!pendingItems}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || isSending || !!pendingItems) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isSending || !!pendingItems}
        >
          <Text style={styles.sendBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 18 },
  agentName: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 14 },
  agentSub: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11 },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.sm },
  loadHistoryBtn: {
    alignSelf: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  loadHistoryText: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: COLORS.divider },
  dateSepText: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 11,
  },
  emptyWrap: { paddingTop: SPACING.xl, alignItems: 'center' },
  emptyText: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 21,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  typingText: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONT.regular },
  // Refinement panel
  refinementPanel: {
    margin: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
    overflow: 'hidden',
    maxHeight: 340,
  },
  refinementTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 13,
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  refinementHint: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  quickApproveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  quickApproveBtnText: {
    color: COLORS.black,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  refinementScroll: { maxHeight: 240 },
  refinementSection: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  draftRow: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  catScroll: { marginBottom: SPACING.xs },
  catPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginRight: SPACING.xs,
    backgroundColor: COLORS.surfaceAlt,
  },
  catPillActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  catPillText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11 },
  catPillTextActive: { color: COLORS.black },
  draftFields: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  draftInput: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    fontSize: 13,
    fontFamily: FONT.regular,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  draftKcal: { width: 58 },
  macroInput: { width: 56, marginLeft: 6 },
  macroDisplay: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  macroText: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 12 },
  editMacroBtn: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.sm },
  editMacroBtnText: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 12 },
  macroEditRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  draftRemove: { paddingLeft: SPACING.xs },
  draftRemoveText: { color: COLORS.surplus, fontSize: 14 },
  addRowBtn: {
    padding: SPACING.sm,
    alignItems: 'center',
  },
  addRowBtnText: {
    color: COLORS.accent,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  rejectBtnText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 13 },
  confirmBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  confirmBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 13 },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 14,
    maxHeight: 120,
  },
  inputDisabled: { opacity: 0.5 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.divider },
  sendBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 16 },
});

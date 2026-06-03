import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import { useChatStore } from '../store/chatStore';
import { ChatBubble } from '../components/ChatBubble';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
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
    confirmPendingItems,
    rejectPendingItems,
  } = useChatStore();

  const [input, setInput] = React.useState('');
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

      {/* Pending confirmation card (Bug #1 fix) */}
      {pendingItems && (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>📋 Kendrick wants to log:</Text>
          {pendingItems.meals.map((m, i) => (
            <Text key={`m-${i}`} style={styles.confirmItem}>
              • {m.category}: {m.foodDescription} — {m.estimatedCalories} kcal
            </Text>
          ))}
          {pendingItems.workouts.map((w, i) => (
            <Text key={`w-${i}`} style={styles.confirmItem}>
              • {w.exerciseType} {w.durationMinutes} min — {w.estimatedCaloriesBurned} kcal burned
            </Text>
          ))}
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.rejectBtn} onPress={rejectPendingItems}>
              <Text style={styles.rejectBtnText}>👎  Re-check</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmPendingItems}>
              <Text style={styles.confirmBtnText}>👍  Looks good</Text>
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
  // Confirmation card
  confirmCard: {
    margin: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
    gap: SPACING.xs,
  },
  confirmTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  confirmItem: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 20,
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

export function ChatScreen(): React.ReactElement {
  const { messages, isSending, loadToday, sendUserMessage } = useChatStore();
  const [input, setInput] = React.useState('');
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    await sendUserMessage(text);
  }

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
        data={messages}
        keyExtractor={item => String(item.id ?? `${item.timestamp}`)}
        renderItem={({ item }) => (
          <ChatBubble
            text={item.content}
            isUser={item.role === 'user'}
            timestamp={item.timestamp}
          />
        )}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
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

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Eg. I just had 2 rotis with dal for lunch"
          placeholderTextColor={COLORS.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
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

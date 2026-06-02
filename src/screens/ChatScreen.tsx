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
import { useChatStore } from '../store/chatStore';
import { ChatBubble } from '../components/ChatBubble';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

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

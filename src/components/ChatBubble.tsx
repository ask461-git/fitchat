import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

interface ChatBubbleProps {
  text: string;
  isUser: boolean;
  timestamp: string; // ISO string
}

export function ChatBubble({ text, isUser, timestamp }: ChatBubbleProps): React.ReactElement {
  const time = new Date(timestamp);
  const hh = time.getHours().toString().padStart(2, '0');
  const mm = time.getMinutes().toString().padStart(2, '0');

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperRight : styles.wrapperLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textModel]}>
          {text}
        </Text>
        <Text style={[styles.time, isUser ? styles.timeUser : styles.timeModel]}>
          {hh}:{mm}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 3,
    maxWidth: '78%',
  },
  wrapperRight: {
    alignSelf: 'flex-end',
  },
  wrapperLeft: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: RADIUS.xs,
  },
  bubbleModel: {
    backgroundColor: COLORS.surfaceAlt,
    borderBottomLeftRadius: RADIUS.xs,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.regular,
  },
  textUser: {
    color: COLORS.black,
  },
  textModel: {
    color: COLORS.textPrimary,
  },
  time: {
    fontSize: 10,
    marginTop: SPACING.xs,
  },
  timeUser: {
    color: 'rgba(0,0,0,0.5)',
    textAlign: 'right',
  },
  timeModel: {
    color: COLORS.textSecondary,
  },
});

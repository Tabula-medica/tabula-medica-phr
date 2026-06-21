import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import api from '../services/api';
import { AIChatMessage } from '../types';

interface ChatResponse {
  response: string;
  noCdsCompliance: {
    disclaimer: string;
    notForClinicalDecisionMaking: boolean;
  };
}

export default function AIAssistantScreen() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post<ChatResponse>('/api/ai/chat', { message });
      return res.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        },
      ]);
    },
  });

  function handleSend() {
    if (!input.trim()) return;

    const userMessage: AIChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(input.trim());
    setInput('');

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }

  const suggestedQuestions = [
    'What medications am I currently taking?',
    'Explain my recent lab results',
    'When is my next appointment?',
    'Summarize my health conditions',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
      >
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>AI Health Assistant</Text>
            <Text style={styles.welcomeSubtitle}>
              Ask questions about your health records in plain language
            </Text>

            <Text style={styles.suggestionsTitle}>Try asking:</Text>
            {suggestedQuestions.map((question, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionButton}
                onPress={() => setInput(question)}
                testID={`button-suggestion-${index}`}
              >
                <Text style={styles.suggestionText}>{question}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                ]}
              >
                {message.content}
              </Text>
              <Text style={styles.messageTime}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}

        {chatMutation.isPending && (
          <View style={[styles.messageBubble, styles.assistantMessage]}>
            <ActivityIndicator size="small" color="#0F766E" />
          </View>
        )}
      </ScrollView>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          AI responses are for informational purposes only. Not for clinical decision-making.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your health records..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          testID="input-chat-message"
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || chatMutation.isPending}
          testID="button-send-message"
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    flexGrow: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    alignSelf: 'flex-start',
    marginLeft: 16,
  },
  suggestionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  userMessage: {
    backgroundColor: '#0F766E',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  disclaimer: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 10,
    color: '#92400E',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#111827',
  },
  sendButton: {
    backgroundColor: '#0F766E',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

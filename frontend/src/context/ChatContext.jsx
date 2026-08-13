import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosConfig';

const ChatContext = createContext(null);

const MAX_STORED = 50;
const MAX_SENT = 20;

const getUserId = () => {
  try { return JSON.parse(localStorage.getItem('user'))?.id || null; }
  catch { return null; }
};

const getApiBase = () => axiosInstance.defaults.baseURL || 'http://localhost:3000';
const getToken = () => localStorage.getItem('token');

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [toolStatus, setToolStatus] = useState(null);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const stored = localStorage.getItem(`chat_history_${userId}`);
      if (stored) setMessages(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const userId = getUserId();
    if (!userId || messages.length === 0) return;
    const toStore = messages.slice(-MAX_STORED).map(m => ({
      role: m.role, content: m.content, type: m.type,
      confirmationData: m.confirmationData, suggestions: m.suggestions
    }));
    localStorage.setItem(`chat_history_${userId}`, JSON.stringify(toStore));
  }, [messages]);

  const streamChat = useCallback(async (payload, onDelta, onConfirmation, onError, onToolStatus, onSuggestions) => {
    const response = await fetch(`${getApiBase()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if      (parsed.type === 'delta')       onDelta(parsed.content);
          else if (parsed.type === 'confirmation') onConfirmation(parsed);
          else if (parsed.type === 'error')        onError(parsed.content);
          else if (parsed.type === 'tool_status')  onToolStatus?.(parsed.label);
          else if (parsed.type === 'suggestions')  onSuggestions?.(parsed.items);
        } catch {}
      }
    }
  }, []);

  const sendMessage = useCallback(async (text) => {
    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);
    setToolStatus(null);

    const apiMessages = updatedMessages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.type !== 'confirmation')
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-MAX_SENT);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      let accumulated = '';
      let gotConfirmation = false;
      let pendingSuggestions = null;

      await streamChat(
        { messages: apiMessages },
        (delta) => {
          setToolStatus(null);
          accumulated += delta;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: accumulated };
            return updated;
          });
        },
        (data) => {
          gotConfirmation = true;
          setPendingConfirmation({ tool: data.tool, args: data.args });
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: data.description,
              type: 'confirmation',
              confirmationData: { tool: data.tool, args: data.args }
            };
            return updated;
          });
        },
        (errMsg) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: errMsg };
            return updated;
          });
        },
        (label) => setToolStatus(label),
        (items) => { pendingSuggestions = items; }
      );

      // Attach suggestions to the final assistant message
      if (pendingSuggestions && !gotConfirmation) {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant' && last.content) {
            updated[updated.length - 1] = { ...last, suggestions: pendingSuggestions };
          }
          return updated;
        });
      }

      if (!gotConfirmation) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { role: 'assistant', content: 'Lo siento, ocurrió un error. Intenta de nuevo.' };
        } else {
          updated.push({ role: 'assistant', content: 'Lo siento, ocurrió un error. Intenta de nuevo.' });
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  }, [messages, streamChat]);

  const confirmAction = useCallback(async () => {
    if (!pendingConfirmation) return;
    const action = pendingConfirmation;
    setPendingConfirmation(null);
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      let accumulated = '';
      await streamChat(
        { messages: [], confirmedAction: { tool: action.tool, args: action.args } },
        (delta) => {
          accumulated += delta;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: accumulated };
            return updated;
          });
        },
        () => {},
        (errMsg) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: errMsg };
            return updated;
          });
        }
      );
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Error al ejecutar la acción.' };
        return updated;
      });
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  }, [pendingConfirmation, streamChat]);

  const cancelAction = useCallback(() => {
    setPendingConfirmation(null);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Entendido, acción cancelada.' }]);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setPendingConfirmation(null);
    const userId = getUserId();
    if (userId) localStorage.removeItem(`chat_history_${userId}`);
  }, []);

  return (
    <ChatContext.Provider value={{
      messages, pendingConfirmation, isLoading, isOpen, toolStatus,
      setIsOpen, sendMessage, confirmAction, cancelAction, clearHistory
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
};

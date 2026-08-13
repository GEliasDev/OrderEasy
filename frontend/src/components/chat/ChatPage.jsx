import { useEffect, useRef } from 'react';
import { Bot, Send, Trash2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import ChatMessage from './ChatMessage';
import './ChatPage.css';

const SUGGESTIONS = [
  '¿Cuánto vendí esta semana?',
  '¿Qué productos tienen poco stock?',
  'Muéstrame los últimos 5 egresos',
  '¿Cuál es mi balance de este mes?',
];

function ChatPage() {
  const { messages, isLoading, toolStatus, sendMessage, clearHistory } = useChat();
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = inputRef.current?.value?.trim();
    if (!text || isLoading) return;
    inputRef.current.value = '';
    inputRef.current.style.height = 'auto';
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div className="chat-page">
      <div className="chat-page-header">
        <div className="chat-page-header-left">
          <Bot size={24} color="var(--color-primary, #1565C0)" />
          <div>
            <h1>Asistente Lumxis</h1>
            <p>IA con acceso a tus datos en tiempo real</p>
          </div>
        </div>
        <button className="chat-page-clear-btn" onClick={clearHistory}>
          <Trash2 size={14} />
          Limpiar historial
        </button>
      </div>

      <div className="chat-page-body">
        <div className="chat-page-messages">
          {messages.length === 0 ? (
            <div className="chat-page-empty">
              <Bot size={40} color="#cbd5e1" />
              <h3>¿En qué te puedo ayudar hoy?</h3>
              <p>
                Puedo consultar tus ventas, inventario, clientes y balance.<br />
                También puedo registrar ventas, egresos, productos y más.
              </p>
              <div className="chat-page-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="chat-suggestion-chip"
                    onClick={() => {
                      if (inputRef.current) inputRef.current.value = s;
                      handleSend();
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
          )}
          {isLoading && (
            <div className="chat-page-typing">
              {toolStatus
                ? <span className="chat-page-tool-status">{toolStatus}</span>
                : <><span /><span /><span /></>
              }
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-page-input-area">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Escribe tu pregunta o instrucción..."
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={isLoading}
          />
          <button className="chat-page-send-btn" onClick={handleSend} disabled={isLoading}>
            <Send size={16} />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;

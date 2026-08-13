import { useEffect, useRef } from 'react';
import { Bot, X, Send, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import ChatMessage from './ChatMessage';
import './ChatWidget.css';

function ChatWidget() {
  const { messages, isLoading, isOpen, toolStatus, setIsOpen, sendMessage, clearHistory } = useChat();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = inputRef.current?.value?.trim();
    if (!text || isLoading) return;
    inputRef.current.value = '';
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(o => !o)}
        title="Asistente IA"
        aria-label="Abrir asistente"
      >
        {isOpen ? <X size={22} /> : <Bot size={22} />}
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <div className="chat-panel-header-left">
              <Bot size={20} />
              <div>
                <h3>Asistente Lumxis</h3>
                <p>IA · Datos en tiempo real</p>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                className="chat-header-btn"
                onClick={() => { setIsOpen(false); navigate('/dashboard/asistente'); }}
                title="Abrir pantalla completa"
              >
                <ExternalLink size={16} />
              </button>
              <button
                className="chat-header-btn"
                onClick={clearHistory}
                title="Limpiar historial"
              >
                <Trash2 size={16} />
              </button>
              <button
                className="chat-header-btn"
                onClick={() => setIsOpen(false)}
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <Bot size={32} color="#cbd5e1" />
                <p>¡Hola! Puedo consultar tus ventas,<br />inventario, clientes y más.<br />¿En qué te ayudo?</p>
              </div>
            ) : (
              messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
            )}
            {isLoading && (
              <div className="chat-typing">
                {toolStatus
                  ? <span className="chat-tool-status">{toolStatus}</span>
                  : <><span /><span /><span /></>
                }
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Pregúntame algo..."
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={isLoading}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import ConfirmActionCard from './ConfirmActionCard';
import { useChat } from '../../context/ChatContext';
import './ChatMessage.css';

function ChatMessage({ message }) {
  const { sendMessage, isLoading } = useChat();
  const isUser = message.role === 'user';
  const isConfirmation = message.type === 'confirmation';

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      marginBottom: 12
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--color-primary, #1565C0)' : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {isUser ? <User size={15} color="white" /> : <Bot size={15} color="#64748b" />}
      </div>

      <div style={{ maxWidth: '80%' }}>
        {isConfirmation ? (
          <ConfirmActionCard description={message.content} />
        ) : (
          <div style={{
            background: isUser ? 'var(--color-primary, #1565C0)' : '#f1f5f9',
            color: isUser ? 'white' : '#1e293b',
            borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            padding: '9px 13px',
            fontSize: 14,
            wordBreak: 'break-word'
          }}>
            {isUser ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
            ) : (
              <div className="chat-msg-table-wrap">
                <ReactMarkdown className="chat-msg-markdown" remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {!isUser && !isConfirmation && message.suggestions?.length > 0 && (
          <div className="chat-suggestions">
            {message.suggestions.map((s) => (
              <button
                key={s}
                className="chat-suggestion-btn"
                disabled={isLoading}
                onClick={() => sendMessage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;

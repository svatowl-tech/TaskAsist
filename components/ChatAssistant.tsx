
import React, { useState, useRef, useEffect } from 'react';
import { AppState, ChatMessage, Task, Note, AssistantTone } from '../types';
import { AiService } from '../services/aiService';

interface ChatAssistantProps {
  appState: AppState;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateSettings: (key: string, tone?: AssistantTone, voice?: boolean) => void;
  onAddTask: (task: Partial<Task>) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onAddNote: (note: Partial<Note>) => Promise<void>;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  appState,
  isOpen,
  onToggle,
  onUpdateSettings,
  onAddTask,
  onUpdateTask,
  onAddNote
}) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: 'Привет! Я Copilot. Чем помочь?', timestamp: Date.now() }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !selectedImage) return;

    const newMessageId = crypto.randomUUID();
    const userMsg: ChatMessage = { 
      id: newMessageId, 
      role: 'user', 
      content: input, 
      imageUrl: selectedImage || undefined,
      timestamp: Date.now() 
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
        const apiKey = appState.settings.openRouterApiKey || '';
        // Allow Local AI even without key
        if (!apiKey && appState.settings.aiModel !== 'local') throw new Error("API Key missing");
        
        const context = await AiService.generateContext(appState);
        
        // Prepare content for multimodal
        const messagePayload = messages.concat(userMsg).map(m => {
          if (m.imageUrl) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content },
                { type: "image_url", image_url: { url: m.imageUrl } }
              ]
            };
          }
          return { role: m.role, content: m.content };
        });

        // Filter out system/initial messages from state to prevent dupes in payload logic if simplified
        // Here we just pass the new payload logic inside AiService or construct it carefully
        const response = await AiService.sendMessage(
          apiKey, 
          [{ 
            role: 'user', 
            content: userMsg.imageUrl ? [
                { type: "text", text: userMsg.content },
                { type: "image_url", image_url: { url: userMsg.imageUrl } }
            ] : userMsg.content 
          }], 
          context,
          appState.settings.aiModel,
          AiService.getTools() 
        );
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const tool of response.toolCalls) {
             let toolResult = "";
             if (tool.name === 'create_task') {
               await onAddTask({
                 title: tool.arguments.title,
                 description: tool.arguments.description,
                 status: tool.arguments.status || 'backlog',
                 deadline: tool.arguments.due_date ? new Date(tool.arguments.due_date).getTime() : undefined
               });
               toolResult = "Задача создана.";
             } else if (tool.name === 'create_note') {
               await onAddNote({
                 title: tool.arguments.title,
                 content: tool.arguments.content,
                 type: 'text',
                 tags: [],
                 createdAt: Date.now(),
                 updatedAt: Date.now()
               });
               toolResult = "Заметка создана.";
             }
             setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `[Executed ${tool.name}]: ${toolResult}`, timestamp: Date.now() }]);
          }
        }

        if (response.content) {
           setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: response.content, timestamp: Date.now() }]);
        }
    } catch (e: any) {
        let errMsg = 'Произошла ошибка';
        if (typeof e === 'string') errMsg = e;
        else if (e instanceof Error) errMsg = e.message;
        else if (e && typeof e === 'object') {
           if (e.message && typeof e.message === 'string') {
              errMsg = e.message;
           } else {
              try { errMsg = JSON.stringify(e); } catch { errMsg = String(e); }
           }
        } else {
           errMsg = String(e);
        }
        
        if (errMsg === '[object Object]') errMsg = 'Unknown Error Object';
        
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Ошибка: ${errMsg}`, timestamp: Date.now() }]);
    } finally {
        setIsTyping(false);
    }
  };

  const handleFeedback = (id: string, type: 'like' | 'dislike', content: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback: type } : m));
    AiService.learnFromFeedback(type, content, messages[messages.length - 2]?.content || ''); // Approximate query
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition z-50 animate-in zoom-in"
      >
        {isOpen ? '✕' : '🧠'}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-48px)] h-[600px] bg-bg-surface rounded-modal shadow-modal flex flex-col border border-border z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="bg-bg-panel p-4 border-b border-border flex justify-between items-center">
             <div>
               <h3 className="font-semibold text-text-main">Copilot</h3>
               <div className="flex items-center gap-1">
                 <span className={`w-2 h-2 rounded-full ${appState.settings.aiModel === 'local' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                 <span className="text-xs text-text-muted">
                   {appState.settings.aiModel === 'local' ? 'Offline (Local)' : 'Online (Cloud)'}
                 </span>
               </div>
             </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-main">
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`
                    max-w-[85%] rounded-lg px-4 py-2.5 text-sm shadow-sm relative group
                    ${msg.role === 'user' 
                      ? 'bg-bg-surface border border-border text-text-main' 
                      : 'bg-primary text-white'}
                  `}
                >
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="Uploaded" className="max-w-full h-auto rounded-md mb-2 border border-black/10" />
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  
                  {/* Feedback for Assistant */}
                  {msg.role === 'assistant' && !msg.content.startsWith('Ошибка') && (
                    <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                       <button 
                         onClick={() => handleFeedback(msg.id, 'like', msg.content)}
                         className={`p-1 rounded bg-bg-surface shadow text-xs ${msg.feedback === 'like' ? 'text-green-500' : 'text-gray-400'}`}
                       >
                         👍
                       </button>
                       <button 
                         onClick={() => handleFeedback(msg.id, 'dislike', msg.content)}
                         className={`p-1 rounded bg-bg-surface shadow text-xs ${msg.feedback === 'dislike' ? 'text-red-500' : 'text-gray-400'}`}
                       >
                         👎
                       </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                 <div className="bg-primary/20 px-3 py-2 rounded-lg flex gap-1">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-150"></span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-bg-surface border-t border-border">
            {selectedImage && (
              <div className="mb-2 relative inline-block">
                <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-md border border-border" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-text-muted hover:text-primary transition p-2"
                title="Прикрепить изображение"
              >
                📷
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageSelect}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Сообщение..."
                className="input-field flex-1"
                disabled={isTyping}
              />
              <button 
                onClick={handleSendMessage}
                disabled={(!input.trim() && !selectedImage)}
                className="btn-primary w-10 px-0"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

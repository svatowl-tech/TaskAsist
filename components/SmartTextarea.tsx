
import React, { useState, useRef, useEffect } from 'react';

interface SmartTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}

export const SmartTextarea: React.FC<SmartTextareaProps> = ({ 
  value, onChange, placeholder, className, minRows = 3 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestionBox, setSuggestionBox] = useState<{ visible: boolean, x: number, y: number, trigger: string } | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(val);

    // Simple detection for last word
    const leftPart = val.slice(0, cursorPos);
    const lastWord = leftPart.split(/\s/).pop();

    if (lastWord && (lastWord.startsWith('#') || lastWord.startsWith('@') || lastWord.startsWith(':'))) {
       // Ideally we calculate XY position of cursor, simplified here to fixed relative
       setSuggestionBox({
         visible: true,
         x: 20, // To do real positioning requires a hidden mirror div
         y: 0,
         trigger: lastWord[0]
       });
    } else {
      setSuggestionBox(null);
    }
  };

  const insertSuggestion = (text: string) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const textAfter = value.slice(cursorPos);
    
    // Replace the incomplete trigger word
    const lastWordRegex = /([#@:][^\s]*)$/;
    const newTextBefore = textBefore.replace(lastWordRegex, text + ' ');
    
    onChange(newTextBefore + textAfter);
    setSuggestionBox(null);
    textareaRef.current.focus();
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Голосовой ввод не поддерживается вашим браузером');
      return;
    }

    if (isListening) {
      setIsListening(false);
      // Logic to stop handled by 'end' event usually, but we can force reload logic if needed
      return;
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onChange(value ? value + ' ' + transcript : transcript);
    };

    recognition.start();
  };

  const renderSuggestions = () => {
    if (!suggestionBox?.visible) return null;

    let items: string[] = [];
    if (suggestionBox.trigger === '#') items = ['#работа', '#дом', '#важно', '#идея'];
    if (suggestionBox.trigger === '@') items = ['@команда', '@семья']; // Mock
    if (suggestionBox.trigger === ':') items = ['✅', '🔥', '📅', '⭐', '❤️'];

    return (
      <div className="absolute z-50 bg-bg-surface border border-border shadow-lg rounded-lg p-2 flex flex-col gap-1 min-w-[150px] animate-in fade-in zoom-in-95 bottom-full mb-2 left-0">
        <div className="text-xs text-text-muted px-2 py-1 bg-bg-panel rounded">
           Выберите {suggestionBox.trigger === '#' ? 'тег' : suggestionBox.trigger === '@' ? 'контакт' : 'эмодзи'}
        </div>
        {items.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => insertSuggestion(item)}
            className="text-left px-2 py-1.5 hover:bg-primary/10 hover:text-primary rounded text-sm transition-colors"
          >
            {item}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        rows={minRows}
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        className="input-field h-auto py-2 resize-none pr-10 leading-relaxed"
      />
      <button
        type="button"
        onClick={toggleVoice}
        className={`absolute right-2 bottom-2 p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-text-muted hover:bg-bg-panel'}`}
        title="Голосовой ввод"
      >
        🎤
      </button>
      {renderSuggestions()}
    </div>
  );
};

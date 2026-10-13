
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, User, Bot, ChevronRight, Info } from 'lucide-react';
import { geminiService } from '../../services/gemini';
import { UserRole } from '../../types';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface AIChatbotProps {
  role: UserRole;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestionsScrollRef = useRef<HTMLDivElement>(null);

  const artisanSuggestions = [
    "How do I record a sale?",
    "How to track Udhaar (Credit)?",
    "What is the Royal Ledger?",
    "How to use Scan to List?",
    "About the Mewar-Sync"
  ];

  const visitorSuggestions = [
    "What is Authenticity feature?",
    "How to find verified artisans?",
    "What is Heritage Guide?",
    "How to use the Marketplace?",
    "About the Mewar-Sync"
  ];

  const suggestions = role === 'SHOPKEEPER' ? artisanSuggestions : visitorSuggestions;

  const welcomeMessage = role === 'SHOPKEEPER' 
    ? "Khamma Ghani, Hukumn! I am your Mewar-Sync assistant. I can help you manage your Royal Ledger, track Udhaar, or list your masterpieces using the Scan to List tool. How can I serve you today?"
    : "Khamma Ghani! Welcome to Mewar-Sync. I am here to guide you through the heritage of Udaipur. You can explore the Marketplace, verify artisan authenticity, or use the Heritage Guide for an immersive experience. What would you like to know?";

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        text: welcomeMessage,
        sender: 'bot',
        timestamp: new Date()
      }]);
    }
  }, [role]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const context = `You are the Mewar-Sync Heritage Assistant, a warm and polite guide from the heart of Udaipur. 
      Mewar-Sync is a heritage-tech ecosystem for Udaipur's artisans.
      
      Your personality:
      - Sound like a local Udaipur assistant: helpful, respectful, and culturally rich.
      - Use traditional greetings like "Khamma Ghani" and "Hukumn" naturally.
      - Be conversational but keep the information practical and easy to follow.
      
      When explaining features:
      - Use natural, descriptive headings (e.g., "About the Marketplace", "How to get started").
      - Focus on the actual steps the user needs to take in the app.
      - Avoid technical jargon like "advanced AI", "digital birth certificate", or "seal of truth".
      
      Feature Details for your reference:
      - Translator Bridge: Helps visitors and artisans communicate across languages (English, Hindi, Marwari). Steps: Go to "Translator" tab -> Select languages -> Type or speak to translate.
      - Heritage Feed: Real-time updates and stories from the artisan community. Steps: Go to "Heritage Feed" tab -> Browse latest posts and photos.
      - Add Location Photos: Allows users to contribute to the heritage map. Steps: Go to "Add Location Photos" -> Select a heritage site -> Upload your photos.
      - Authenticity Scanner (Visitor): Verifies if a craft is handmade. Steps: Go to "Authenticity Scan" tab -> Upload/take a photo -> App tells you if it is "Genuine Handmade" or "Machine Made".
      - Royal Ledger / Bahi Khata (Artisan): Digital accounting. Steps: Go to "Royal Ledger" -> Tap mic icon or "Add" button -> Speak/type entry -> Tap "Save".
      - Scan to List (Artisan): Lists products quickly. Steps: Go to "Scan to List" -> Take photo of craft -> AI identifies it -> Save to shop.
      - Udhaar Tracker (Artisan): Manages credit. Steps: Go to "Udhaar Tracker" -> Add name and amount -> Track payments.
      - Marketplace (Visitor): Find artisans. Steps: Go to "Marketplace" -> Browse workshops -> See locations and masterpieces.
      - Heritage Guide (Visitor): Learn history. Steps: Go to "Heritage Guide" -> Pick a location on the map -> Listen to stories or see historical photos.
      - Profile Settings: Manage your account and language preferences. Steps: Go to "Profile Settings" -> Update your details or change app language.
      
      User Role: ${role}.
      
      Formatting Instructions:
      - Use double quotes ("") for emphasis instead of bold stars (**).
      - Use clear bullet points or numbered lists for steps.
      - Ensure each point is on a new line for better readability.`;
      
      const response = await geminiService.chat(text, context);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "I apologize, Hukumn. My connection to the heritage registry is weak. Please try again.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 z-[100] w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-royal-gradient text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-all group ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare size={24} />
        <span className="absolute -top-12 right-0 bg-white text-gray-900 text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-xl border border-gold/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Chat with Mewar Assistant
        </span>
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-8 right-8 z-[102] w-[90vw] max-w-[400px] h-[600px] max-h-[80vh] bg-white rounded-[32px] shadow-2xl border-2 border-gold/20 flex flex-col overflow-hidden transition-all duration-500 transform ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-12 pointer-events-none'}`}>
        {/* Header */}
        <div className="p-6 bg-royal-gradient text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-heritage font-bold text-sm uppercase tracking-tight">Mewar Assistant</h3>
              <p className="text-[9px] font-bold opacity-70 uppercase tracking-widest">Powered by Heritage AI</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-4 no-scrollbar bg-[#FDFBF7]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-saffron text-white' : 'bg-gold text-white'}`}>
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white border border-gold/10 text-gray-800 shadow-sm rounded-tl-none'}`}>
                  {msg.text.replace(/\*\*(.*?)\*\*/g, '"$1"')}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gold text-white flex items-center justify-center">
                  <Bot size={16} />
                </div>
                <div className="p-4 bg-white border border-gold/10 rounded-2xl rounded-tl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gold/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 ? (
          <div className="px-6 py-4 bg-white border-t border-gold/5">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-gold" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Suggested Questions</span>
            </div>
            <div className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="w-full px-4 py-2.5 bg-white border border-gold/20 rounded-full text-[11px] font-medium text-gray-700 hover:bg-gold/5 transition-all flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{s}</span>
                  <ChevronRight size={14} className="text-gold/40 group-hover:text-gold transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-6 py-3 bg-white border-t border-gold/5 w-full">
            <div 
              ref={suggestionsScrollRef}
              onWheel={(e) => {
                if (suggestionsScrollRef.current) {
                  suggestionsScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              className="flex overflow-x-auto no-scrollbar gap-2 pb-1 touch-pan-x scroll-smooth cursor-grab active:cursor-grabbing"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="px-4 py-2 bg-white border border-gold/20 rounded-full text-[10px] font-bold text-gold whitespace-nowrap hover:bg-gold/5 transition-colors flex items-center gap-2 shrink-0 active:scale-95 select-none"
                >
                  <ChevronRight size={12} className="shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-6 bg-white border-t border-gold/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Mewar-Sync..."
              className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:border-saffron shadow-inner"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-royal-gradient text-white rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50 transition-all active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

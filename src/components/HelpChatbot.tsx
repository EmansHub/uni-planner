import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
//import { ScrollArea } from '../ui/scroll-area';
import { Headphones, Send, X } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface HelpChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function HelpChatbot({ isOpen, onToggle }: HelpChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! How can I help you today?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('plan') || lowerMessage.includes('degree')) {
      return 'To create a degree plan, go to Degree Planning from the dashboard. You can start a new plan or view saved plans. The system will guide you through selecting completed courses and planning your remaining semesters.';
    }
    if (lowerMessage.includes('schedule') || lowerMessage.includes('class')) {
      return 'To plan your semester schedule, go to Semester Schedule from the dashboard. You can view available classes, add them to your schedule, and use AI to generate optimized schedules based on your preferences.';
    }
    if (lowerMessage.includes('password') || lowerMessage.includes('reset')) {
      return 'To reset your password, click "Forgot Password" on the login page. You\'ll receive an OTP via email to verify your identity before setting a new password.';
    }
    if (lowerMessage.includes('profile') || lowerMessage.includes('edit')) {
      return 'You can edit your profile by clicking on your user icon in the top corner of the dashboard. From there, you can update your information and change your password.';
    }
    if (lowerMessage.includes('ai') || lowerMessage.includes('generate')) {
      return 'AI features are available in both Degree Planning and Semester Schedule. The AI can auto-generate degree plans to help you graduate on time and create optimal class schedules based on your preferences like time slots and break preferences.';
    }
    if (lowerMessage.includes('prerequisite') || lowerMessage.includes('override')) {
      return 'In the Degree Planning section, click on "Restrictions" to indicate if you have overrides for prerequisites or if you want to repeat courses. This will help the system plan your schedule more accurately.';
    }
    
    return 'I\'m here to help! You can ask me about degree planning, semester schedules, password resets, profile editing, or any other feature of Uni Planner.';
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    const handleSendMessage = async () => {
  if (!inputMessage.trim()) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    text: inputMessage,
    sender: 'user',
    timestamp: new Date(),
  };

  setMessages(prev => [...prev, userMessage]);

  const currentMessage = inputMessage; // store before clearing
  setInputMessage('');

  // 🔹 show temporary "Typing..." message
  const typingMessage: Message = {
    id: 'typing',
    text: 'Typing...',
    sender: 'bot',
    timestamp: new Date(),
  };

  setMessages(prev => [...prev, typingMessage]);

  try {
    const response = await fetch('http://127.0.0.1:5000/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: currentMessage }),
    });

    const data = await response.json();

    // remove "Typing..."
    setMessages(prev => prev.filter(msg => msg.id !== 'typing'));

    const botResponse: Message = {
      id: (Date.now() + 1).toString(),
      text: data.reply,
      sender: 'bot',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, botResponse]);

  } catch (error) {
    console.error(error);

    setMessages(prev => prev.filter(msg => msg.id !== 'typing'));

    const errorMessage: Message = {
      id: (Date.now() + 2).toString(),
      text: 'Something went wrong. Please try again.',
      sender: 'bot',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, errorMessage]);
  }
};

    setInputMessage('');
  };

  if (!isOpen) {
    return (
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg"
        size="icon"
        onClick={onToggle}
      >
        <Headphones className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-2xl flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Headphones className="w-5 h-5" />
          Help Assistant
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onToggle}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender === 'user'
                      ? 'bg-[#E87722] text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="p-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button size="icon" onClick={handleSendMessage}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

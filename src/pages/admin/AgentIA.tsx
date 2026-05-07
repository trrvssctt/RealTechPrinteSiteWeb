import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Bot,
  Send,
  Plus,
  Loader2,
  User,
  Sparkles,
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
  MessageSquare,
  Clock,
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

interface Conversation {
  id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

const SUGGESTIONS = [
  { icon: TrendingUp, text: "Quel est mon chiffre d'affaires d'aujourd'hui ?" },
  { icon: ShoppingCart, text: "Quelles sont les 5 dernières ventes ?" },
  { icon: Package, text: "Quels produits sont en rupture de stock ?" },
  { icon: Users, text: "Combien d'employés sont actifs en ce moment ?" },
  { icon: TrendingUp, text: "Quel est mon CA ce mois-ci ?" },
  { icon: Package, text: "Quels sont mes produits les plus vendus ?" },
];

export default function AgentIA() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('sessionToken') || '';
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
    setLoadingConvs(true);
    try {
      const resp = await apiFetch('/api/admin/agent/conversations', { headers });
      if (resp.ok) {
        const { data } = await resp.json();
        const normalized = (data || []).map((c: Conversation) => ({
          ...c,
          messages: Array.isArray(c.messages)
            ? c.messages
            : typeof c.messages === 'string'
            ? JSON.parse(c.messages)
            : [],
        }));
        setConversations(normalized);
        if (normalized.length > 0 && !activeConvId) {
          openConversation(normalized[0]);
        }
      }
    } catch (e) {
      console.error('Erreur chargement conversations', e);
    } finally {
      setLoadingConvs(false);
    }
  }

  function openConversation(conv: Conversation) {
    setActiveConvId(conv.id);
    setMessages(conv.messages || []);
  }

  function newConversation() {
    setActiveConvId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  async function sendMessage(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;

    const userMsg: Message = { role: 'user', content: q, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const resp = await apiFetch('/api/admin/agent/chat', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, conversation_id: activeConvId }),
      });

      if (!resp.ok) {
        throw new Error(`Erreur ${resp.status}`);
      }

      const { answer, conversation_id } = await resp.json();
      const assistantMsg: Message = { role: 'assistant', content: answer, ts: new Date().toISOString() };

      setMessages(prev => [...prev, assistantMsg]);
      if (!activeConvId && conversation_id) {
        setActiveConvId(conversation_id);
        loadConversations();
      }
    } catch (e: any) {
      toast.error("Erreur de communication avec l'agent IA");
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Désolé, je n'ai pas pu obtenir de réponse. Vérifiez que n8n est bien configuré.",
        ts: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function firstLine(messages: Message[] | unknown) {
    const arr: Message[] = Array.isArray(messages) ? messages : [];
    const first = arr.find(m => m.role === 'user');
    if (!first) return 'Nouvelle conversation';
    return first.content.slice(0, 45) + (first.content.length > 45 ? '…' : '');
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Sidebar conversations */}
      <div className="hidden lg:flex w-64 flex-col gap-2">
        <Button onClick={newConversation} className="w-full gap-2" variant="outline">
          <Plus className="h-4 w-4" />
          Nouvelle conversation
        </Button>

        <Card className="flex-1 overflow-hidden">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Historique
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-3.5rem)]">
            <div className="px-2 pb-2 space-y-1">
              {loadingConvs ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 px-2">
                  Aucune conversation
                </p>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      activeConvId === conv.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <p className="font-medium truncate text-xs">{firstLine(conv.messages)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(conv.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Zone de chat principale */}
      <div className="flex-1 flex flex-col">
        {/* En-tête */}
        <Card className="mb-3">
          <CardContent className="py-3 px-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Agent IA RealTech</p>
              <p className="text-xs text-gray-500">Posez n'importe quelle question sur votre activité</p>
            </div>
            <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Powered by GPT-4o
            </Badge>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-4 py-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Comment puis-je vous aider ?
                </h3>
                <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
                  Posez toutes vos questions sur vos ventes, stock, employés ou chiffre d'affaires.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      onClick={() => sendMessage(text)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-left text-sm text-gray-700 transition-all group"
                    >
                      <Icon className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-gray-700 to-gray-900'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    }`}>
                      {msg.role === 'user'
                        ? <User className="h-4 w-4 text-white" />
                        : <Bot className="h-4 w-4 text-white" />
                      }
                    </div>

                    {/* Bulle */}
                    <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-3 text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}>
                        <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(msg.ts)}</span>
                    </div>
                  </div>
                ))}

                {/* Indicateur de frappe */}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1 items-center h-5">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Zone de saisie */}
          <div className="p-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question à l'agent IA…"
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                size="icon"
                className="bg-blue-600 hover:bg-blue-700 flex-shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              L'agent peut faire des erreurs. Vérifiez les données importantes directement dans les tableaux de bord.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

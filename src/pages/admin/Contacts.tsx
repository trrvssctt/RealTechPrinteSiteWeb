import { useEffect, useState, useMemo } from "react";
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  User,
  Calendar,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  RefreshCw,
  Eye,
  Reply,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MailOpen,
  Archive,
  Tag,
  Send,
  AlertCircle,
  MessageSquare,
  Smartphone,
  Building,
  Globe,
  ExternalLink,
  Download,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  company?: string;
  website?: string;
  handled: boolean;
  created_at: string;
  updated_at: string;
  metadata?: {
    user_agent?: string;
    ip_address?: string;
    page_url?: string;
  };
  tags?: string[];
  assigned_to?: string;
};

type MessageStats = {
  total: number;
  unread: number;
  handled: number;
  today: number;
};

const Contacts = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'unhandled' | 'handled'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [replySubject, setReplySubject] = useState("");
  const [messageToDelete, setMessageToDelete] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    unread: 0,
    handled: 0,
    today: 0
  });

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    let filtered = allMessages;

    // Filter by status
    if (filter === 'unhandled') {
      filtered = filtered.filter(m => !m.handled);
    } else if (filter === 'handled') {
      filtered = filtered.filter(m => m.handled);
    }

    // Filter by search
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone?.includes(searchQuery) ||
        m.company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setMessages(filtered);
    setCurrentPage(1);
  }, [allMessages, filter, searchQuery]);

  useEffect(() => {
    calculateStats();
  }, [allMessages]);

  const fetchMessages = async () => {
    setLoading(true);
    const token = localStorage.getItem('sessionToken');
    const headers: Record<string,string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const resp = await apiFetch('/api/contacts', { headers });
      if (!resp.ok) {
        toast.error('Erreur', {
          description: 'Impossible de charger les messages'
        });
        return;
      }
      const json = await resp.json();
      const sortedMessages = (json.results || json.data || [])
        .sort((a: ContactMessage, b: ContactMessage) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      setAllMessages(sortedMessages);
    } catch (err) {
      toast.error('Erreur', {
        description: 'Impossible de charger les messages'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: MessageStats = {
      total: allMessages.length,
      unread: allMessages.filter(m => !m.handled).length,
      handled: allMessages.filter(m => m.handled).length,
      today: allMessages.filter(m => new Date(m.created_at) >= today).length
    };

    setStats(stats);
  };

  const handleMarkAsHandled = async (id: string, handled: boolean) => {
    const token = localStorage.getItem('sessionToken');
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const resp = await apiFetch(`/api/contacts/${id}/handle`, { 
        method: 'POST', 
        headers,
        body: JSON.stringify({ handled })
      });
      
      if (!resp.ok) {
        toast.error('Erreur', {
          description: `Impossible de ${handled ? 'marquer comme traité' : 'marquer comme non traité'}`
        });
        return;
      }

      toast.success('Succès', {
        description: `Message ${handled ? 'marqué comme traité' : 'réouvert'}`
      });

      setSelectedMessage(prev => (prev?.id === id ? { ...prev, handled } : prev));
      await fetchMessages();
    } catch (err) {
      toast.error('Erreur', {
        description: `Impossible de ${handled ? 'marquer comme traité' : 'marquer comme non traité'}`
      });
    }
  };

  const handleViewDetails = (message: ContactMessage) => {
    setSelectedMessage(message);
    setDetailsOpen(true);
  };

  const handleOpenReply = (message: ContactMessage) => {
    setSelectedMessage(message);
    setReplySubject(`Re: ${message.subject}`);
    setReplyContent(`\n\n--- Message original ---\nDe: ${message.name} <${message.email}>\nDate: ${format(new Date(message.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}\n\n${message.message}`);
    setReplyOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    setSendingReply(true);
    try {
      // Open user's mail client / webmail with a prefilled message using mailto:
      const to = selectedMessage.email;
      const subject = replySubject || `Re: ${selectedMessage.subject}`;
      const body = replyContent;
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      // open in new tab/window - will open default mail client or configured webmail
      window.open(mailto, '_blank');

      toast.success('✉️ Brouillon ouvert', {
        description: `Le brouillon pour ${selectedMessage.email} a été ouvert dans votre client de messagerie.`
      });

      // Mark as handled after opening the mail client
      await handleMarkAsHandled(selectedMessage.id, true);

      setReplyOpen(false);
      setReplyContent("");
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur', {
        description: 'Impossible d\'ouvrir le client mail'
      });
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = (message: ContactMessage) => {
    setMessageToDelete(message);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;
    const id = messageToDelete.id;
    setDeleting(true);

    const token = localStorage.getItem('sessionToken');
    const headers: Record<string,string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const resp = await apiFetch(`/api/contacts/${id}`, { 
        method: 'DELETE', 
        headers 
      });
      
      if (!resp.ok) {
        toast.error('Erreur', {
          description: 'Impossible de supprimer le message'
        });
        return;
      }

      toast.success('🗑️ Message supprimé', {
        description: 'Le message a été supprimé avec succès'
      });

      setMessageToDelete(null);
      if (selectedMessage?.id === id) setDetailsOpen(false);
      await fetchMessages();
    } catch (err) {
      toast.error('Erreur', {
        description: 'Impossible de supprimer le message'
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return "Date invalide";
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) {
        return "Il y a moins d'une heure";
      } else if (diffHours < 24) {
        return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
      } else if (diffDays === 1) {
        return "Hier";
      } else if (diffDays < 7) {
        return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      } else {
        return format(date, "dd/MM/yyyy", { locale: fr });
      }
    } catch {
      return "";
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(messages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentMessages = messages.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Messages de Contact</h1>
              <p className="text-muted-foreground mt-1">
                Gérez les messages envoyés via le formulaire de contact
              </p>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={fetchMessages} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Non traités</p>
                <p className="text-3xl font-bold text-orange-600">{stats.unread}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <MailOpen className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Traités</p>
                <p className="text-3xl font-bold text-green-600">{stats.handled}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aujourd'hui</p>
                <p className="text-3xl font-bold text-purple-600">{stats.today}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher un message (nom, email, sujet, contenu...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="w-[180px] h-11">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les messages</SelectItem>
                  <SelectItem value="unhandled">Non traités</SelectItem>
                  <SelectItem value="handled">Traités</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={fetchMessages}
                className="h-11 w-11"
                disabled={loading}
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des messages</CardTitle>
          <CardDescription>
            {messages.length} message{messages.length !== 1 ? 's' : ''} trouvé{messages.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Aucun message trouvé</h3>
              <p className="text-muted-foreground">
                {searchQuery || filter !== "all" 
                  ? 'Aucun message ne correspond à vos critères'
                  : 'Aucun message n\'a été reçu pour le moment'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {currentMessages.map((message) => {
                  return (
                    <Card 
                      key={message.id} 
                      className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${!message.handled ? 'border-l-4 border-l-blue-500' : ''}`}
                      onClick={() => handleViewDetails(message)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                                {message.name[0].toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold">{message.name}</div>
                                  <Badge variant="outline" className="text-xs">
                                    {message.email}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                  <span>{message.subject}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3">
                              <p className="text-sm line-clamp-2 text-muted-foreground">
                                {message.message}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatRelativeTime(message.created_at)}
                                </div>
                                {message.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {message.phone}
                                  </div>
                                )}
                                {message.company && (
                                  <div className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {message.company}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge variant={message.handled ? "default" : "destructive"}>
                                  {message.handled ? 'Traité' : 'Non traité'}
                                </Badge>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDetails(message);
                                    }}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Voir les détails
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenReply(message);
                                    }}>
                                      <Reply className="mr-2 h-4 w-4" />
                                      Répondre
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {!message.handled ? (
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkAsHandled(message.id, true);
                                      }}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Marquer comme traité
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkAsHandled(message.id, false);
                                      }}>
                                        <Clock className="mr-2 h-4 w-4" />
                                        Réouvrir
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(message);
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Affichage de {startIndex + 1} à {Math.min(endIndex, messages.length)} sur {messages.length} messages
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Message Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {selectedMessage.subject}
                </DialogTitle>
                <DialogDescription>
                  Reçu le {formatDateTime(selectedMessage.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Sender Info */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                          {selectedMessage.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-lg">{selectedMessage.name}</div>
                          <div className="text-muted-foreground">{selectedMessage.email}</div>
                          <div className="flex items-center gap-4 mt-2">
                            {selectedMessage.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-4 w-4" />
                                {selectedMessage.phone}
                              </div>
                            )}
                            {selectedMessage.company && (
                              <div className="flex items-center gap-1 text-sm">
                                <Building className="h-4 w-4" />
                                {selectedMessage.company}
                              </div>
                            )}
                            {selectedMessage.website && (
                              <div className="flex items-center gap-1 text-sm">
                                <Globe className="h-4 w-4" />
                                <a 
                                  href={selectedMessage.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {selectedMessage.website}
                                  <ExternalLink className="h-3 w-3 inline ml-1" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={selectedMessage.handled ? "default" : "destructive"}>
                          {selectedMessage.handled ? 'Traité' : 'Non traité'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Message Content */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Message</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap">
                      {selectedMessage.message}
                    </div>
                  </CardContent>
                </Card>

                {/* Technical Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Informations techniques</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Date d'envoi</Label>
                        <p className="text-sm">{formatDateTime(selectedMessage.created_at)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Dernière mise à jour</Label>
                        <p className="text-sm">{formatDateTime(selectedMessage.updated_at)}</p>
                      </div>
                      {selectedMessage.metadata?.ip_address && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Adresse IP</Label>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {selectedMessage.metadata.ip_address}
                          </code>
                        </div>
                      )}
                      {selectedMessage.metadata?.user_agent && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Navigateur</Label>
                          <p className="text-sm truncate">{selectedMessage.metadata.user_agent}</p>
                        </div>
                      )}
                      {selectedMessage.metadata?.page_url && (
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">Page d'origine</Label>
                          <a 
                            href={selectedMessage.metadata.page_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {selectedMessage.metadata.page_url}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedMessage) {
                      handleDelete(selectedMessage);
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedMessage) {
                      handleMarkAsHandled(selectedMessage.id, !selectedMessage.handled);
                    }
                  }}
                >
                  {selectedMessage?.handled ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Réouvrir
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marquer comme traité
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setDetailsOpen(false);
                    handleOpenReply(selectedMessage);
                  }}
                >
                  <Reply className="mr-2 h-4 w-4" />
                  Répondre
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="max-w-2xl">
          {selectedMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Reply className="h-5 w-5" />
                  Répondre à {selectedMessage.name}
                </DialogTitle>
                <DialogDescription>
                  Votre réponse sera envoyée à {selectedMessage.email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Sujet</Label>
                  <Input
                    id="subject"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reply">Message</Label>
                  <Textarea
                    id="reply"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={10}
                    className="resize-none"
                  />
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm font-medium mb-2">Message original</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedMessage.message.substring(0, 200)}...
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReplyOpen(false)}
                  disabled={sendingReply}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyContent.trim()}
                >
                  {sendingReply ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer la réponse
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!messageToDelete}
        onOpenChange={(open) => { if (!open && !deleting) setMessageToDelete(null); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto sm:mx-0 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {messageToDelete && (
                  <div className="rounded-lg border bg-muted/50 p-3 text-left">
                    <p className="font-medium text-foreground truncate">
                      {messageToDelete.subject || 'Sans sujet'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      De {messageToDelete.name} &lt;{messageToDelete.email}&gt;
                    </p>
                  </div>
                )}
                <p className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                  Ce message sera définitivement supprimé. Cette action est irréversible.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer définitivement
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Contacts;
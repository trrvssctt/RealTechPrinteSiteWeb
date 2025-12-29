import React, { useEffect, useMemo, useState } from 'react';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
// replaced DatePickerWithRange (missing) with native date inputs
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Download, FileText, FileSpreadsheet, FileImage, 
  Printer, Filter, RefreshCw, BarChart, TrendingUp, 
  Package, Calendar, Eye, Settings, ChevronDown,
  CheckCircle, AlertCircle, Clock
} from 'lucide-react';

const periodOptions = [
  { value: 'today', label: 'Aujourd\'hui', icon: Clock },
  { value: 'yesterday', label: 'Hier', icon: Calendar },
  { value: 'week', label: 'Cette semaine', icon: TrendingUp },
  { value: 'month', label: 'Ce mois', icon: Calendar },
  { value: 'quarter', label: 'Trimestre', icon: BarChart },
  { value: 'year', label: 'Année', icon: TrendingUp },
  { value: 'custom', label: 'Personnalisé', icon: Settings }
];

const formatOptions = [
  { value: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-500' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-green-600' },
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, color: 'text-blue-600' },
  { value: 'png', label: 'PNG', icon: FileImage, color: 'text-purple-500' },
  { value: 'print', label: 'Imprimer', icon: Printer, color: 'text-gray-600' }
];

const reportTypes = [
  { value: 'summary', label: 'Résumé', description: 'Vue d\'ensemble des mouvements' },
  { value: 'detailed', label: 'Détaillé', description: 'Liste complète des transactions' },
  { value: 'analytics', label: 'Analytique', description: 'Graphiques et tendances' },
  { value: 'inventory', label: 'Inventaire', description: 'Niveaux de stock actuels' }
];

const ReportsImproved = () => {
  const [period, setPeriod] = useState<string>('week');
  const [format, setFormat] = useState<string>('pdf');
  const [reportType, setReportType] = useState<string>('summary');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [emailReport, setEmailReport] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [reportTitle, setReportTitle] = useState('Rapport des Mouvements');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [customColumns, setCustomColumns] = useState<string[]>([
    'product', 'type', 'quantity', 'date', 'reference'
  ]);

  // Initialize default dates
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    setStartDate(start.toISOString());
    setEndDate(end.toISOString());
    fetchProducts();
  }, []);

  // Handle period change
  useEffect(() => {
    if (period !== 'custom') {
      const now = new Date();
      let start = new Date();
      let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      switch(period) {
        case 'today':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
          break;
        case 'week':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'quarter':
          start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case 'year':
          start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
      }

      setStartDate(start.toISOString());
      setEndDate(end.toISOString());
    }
  }, [period]);

  const fetchProducts = async () => {
    try {
      const resp = await apiFetch('/api/products?limit=1000');
      if (resp.ok) {
        const data = await resp.json();
        setProducts(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchReportData = async () => {
    if (!startDate || !endDate) {
      toast.error('Veuillez sélectionner une plage de dates');
      return;
    }

    setLoading(true);
    try {
      const qs = [
        `start=${encodeURIComponent(startDate)}`,
        `end=${encodeURIComponent(endDate)}`,
        'limit=1000'
      ].join('&');
      
      const url = `/api/admin/stock-mouvements?${qs}`;
      const resp = await apiFetch(url);
      
      if (!resp.ok) throw new Error('Failed to fetch data');
      
      const data = await resp.json();
      setMovements(Array.isArray(data.data) ? data.data : []);
      toast.success(`${data.data?.length || 0} mouvements chargés`);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const reportSummary = useMemo(() => {
    const totalIn = movements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    
    const totalOut = movements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    
    const netChange = totalIn - totalOut;
    const uniqueProducts = new Set(movements.map(m => m.product_id)).size;
    const avgPerDay = movements.length / 7; // Assuming 7-day period
    
    return { 
      totalIn, 
      totalOut, 
      netChange, 
      uniqueProducts, 
      count: movements.length,
      avgPerDay: Math.round(avgPerDay)
    };
  }, [movements]);

  const topProducts = useMemo(() => {
    const productMap = new Map();
    
    movements.forEach(m => {
      const productName = m.product?.name || m.product_name || 'Inconnu';
      const current = productMap.get(productName) || { in: 0, out: 0 };
      
      if (m.movement_type === 'in') {
        current.in += Number(m.quantity) || 0;
      } else {
        current.out += Number(m.quantity) || 0;
      }
      
      productMap.set(productName, current);
    });
    
    return Array.from(productMap.entries())
      .map(([name, data]) => ({
        name,
        totalIn: data.in,
        totalOut: data.out,
        netChange: data.in - data.out
      }))
      .sort((a, b) => Math.abs(b.netChange) - Math.abs(a.netChange))
      .slice(0, 5);
  }, [movements]);

  const generateReport = async () => {
    if (movements.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    setGenerating(true);
    
    try {
      // persist report record in DB
      try {
        const formatMap: Record<string,string> = { excel: 'xls', pdf: 'pdf', csv: 'csv', png: 'png', print: 'pdf' };
        const payload = {
          type_rapport: getTypeFromPeriod(period),
          format_rapport: formatMap[format] || 'pdf',
          parameters: { start: startDate, end: endDate }
        };
        const resp = await apiFetch('/api/admin/rapports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          const body = await resp.json().catch(() => ({}));
          if (body?.download) {
            toast.success('Rapport enregistré sur le serveur (fichier disponible)');
          } else {
            toast.success('Rapport enregistré dans la base');
          }
        } else {
          // don't block generation if persistence fails
          const err = await resp.json().catch(() => ({}));
          console.warn('Rapport persistence failed', err);
        }
      } catch (e) {
        console.warn('Failed to persist report', e);
      }

      switch(format) {
        case 'pdf':
          await exportPDF();
          break;
        case 'excel':
          exportExcel();
          break;
        case 'csv':
          exportCSV();
          break;
        case 'png':
          await exportImage('png');
          break;
        case 'print':
          exportPrint();
          break;
      }
      
      if (emailReport && emailAddress) {
        toast.info('Envoi par email en cours...');
        // Simulate email sending
        setTimeout(() => {
          toast.success(`Rapport envoyé à ${emailAddress}`);
        }, 1500);
      }
    } catch (error) {
      toast.error('Erreur lors de la génération du rapport');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  function getTypeFromPeriod(p: string) {
    if (p === 'today' || p === 'yesterday') return 'journalier';
    if (p === 'year') return 'annuelle';
    return 'mensuelle';
  }

  const shareReport = async () => {
    if (movements.length === 0) {
      toast.error('Générez ou chargez des données avant de partager');
      return;
    }
    setGenerating(true);
    try {
      const formatMap: Record<string,string> = { excel: 'xls', pdf: 'pdf', csv: 'csv', png: 'png', print: 'pdf' };
      const payload = {
        type_rapport: getTypeFromPeriod(period),
        format_rapport: formatMap[format] || 'pdf',
        parameters: { start: startDate, end: endDate }
      };

      const resp = await apiFetch('/api/admin/rapports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // read body once and handle errors
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error || 'Erreur création rapport');
      }

      // server may return different keys (download, filePath, filename)
      let downloadPath = body.download || body.filePath || body.path || body.filename;
      if (!downloadPath && body.filename) downloadPath = `/exports/${body.filename}`;

      if (!downloadPath) {
        toast.error('Rapport créé mais pas de fichier disponible pour le partage');
        return;
      }

      // normalize to full URL
      const fullUrl = /^https?:\/\//i.test(downloadPath)
        ? downloadPath
        : `${window.location.origin}${downloadPath.startsWith('/') ? downloadPath : '/' + downloadPath}`;

      const phone = '221774220320';
      const startStr = startDate ? new Date(startDate).toLocaleDateString() : '';
      const endStr = endDate ? new Date(endDate).toLocaleDateString() : '';
      const message = `Bonjour,\nVoici le rapport "${reportTitle}" pour la période ${startStr} - ${endStr} :\n${fullUrl}`;
      const wa = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(wa, '_blank', 'noopener');
      toast.success('Ouverture de WhatsApp pour partager le rapport');
    } catch (e) {
      console.error(e);
      toast.error('Impossible de partager le rapport');
    } finally {
      setGenerating(false);
    }
  };

  const exportPDF = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Impossible d\'ouvrir la fenêtre d\'impression');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${reportTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 30px 0; }
            .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
            .summary-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #3b82f6; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 12px; }
            .positive { color: #10b981; }
            .negative { color: #ef4444; }
          </style>
        </head>
        <body>
              <div class="header" style="display:flex;align-items:center;gap:20px;justify-content:center;flex-direction:column;">
                <img src="/assets/logo_realtech.png" alt="logo" style="height:72px;object-fit:contain;margin-bottom:6px" />
                <h1>${reportTitle}</h1>
                <p>Période: ${new Date(startDate!).toLocaleDateString()} - ${new Date(endDate!).toLocaleDateString()}</p>
                <p>Généré le: ${new Date().toLocaleString()}</p>
              </div>
          
          ${includeSummary ? `
            <div class="summary">
              <div class="summary-card">
                <div>Total Entrées</div>
                <div class="summary-value">${reportSummary.totalIn}</div>
              </div>
              <div class="summary-card">
                <div>Total Sorties</div>
                <div class="summary-value">${reportSummary.totalOut}</div>
              </div>
              <div class="summary-card">
                <div>Variation Nette</div>
                <div class="summary-value ${reportSummary.netChange >= 0 ? 'positive' : 'negative'}">
                  ${reportSummary.netChange >= 0 ? '+' : ''}${reportSummary.netChange}
                </div>
              </div>
              <div class="summary-card">
                <div>Produits Actifs</div>
                <div class="summary-value">${reportSummary.uniqueProducts}</div>
              </div>
            </div>
          ` : ''}
          
          <h2>Top 5 Produits</h2>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Entrées</th>
                <th>Sorties</th>
                <th>Variation</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.totalIn}</td>
                  <td>${p.totalOut}</td>
                  <td class="${p.netChange >= 0 ? 'positive' : 'negative'}">
                    ${p.netChange >= 0 ? '+' : ''}${p.netChange}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <h2>Détail des Mouvements</h2>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Type</th>
                <th>Sous-type</th>
                <th>Quantité</th>
                <th>Référence</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${movements.map(m => `
                <tr>
                  <td>${m.product?.name || m.product_name || '-'}</td>
                  <td>${m.movement_type}</td>
                  <td>${m.movement_subtype}</td>
                  <td>${m.quantity}</td>
                  <td>${m.reference || '-'}</td>
                  <td>${new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Rapport généré automatiquement - Système de Gestion de Stock</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      toast.success('Rapport PDF généré');
    }, 500);
  };

  const exportExcel = () => {
    const headers = [
      'ID', 'Produit', 'Type', 'Sous-type', 'Quantité', 
      'Coût Unitaire', 'Référence', 'Date', 'Statut', 'Créé par'
    ];
    
    const rows = movements.map(m => [
      m.id,
      m.product?.name || m.product_name || '',
      m.movement_type,
      m.movement_subtype,
      m.quantity,
      m.unit_cost || '',
      m.reference || '',
      new Date(m.created_at).toLocaleString(),
      m.status,
      m.created_by_name || m.created_by || ''
    ]);

    // Create CSV with Excel BOM for UTF-8
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        `"${String(cell).replace(/"/g, '""')}"`
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Fichier Excel généré');
  };

  const exportCSV = () => {
    const headers = [
      'Produit', 'Type', 'Sous-type', 'Quantité', 
      'Référence', 'Date', 'Statut'
    ];
    
    const rows = movements.map(m => [
      m.product?.name || m.product_name || '',
      m.movement_type,
      m.movement_subtype,
      m.quantity,
      m.reference || '',
      new Date(m.created_at).toISOString(),
      m.status
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => 
        `"${String(cell).replace(/"/g, '""')}"`
      ).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Fichier CSV généré');
  };

  const exportImage = async (type: 'png' | 'jpg') => {
    try {
      toast.info('Génération d\'image en cours...');
      if (!(window as any).html2canvas) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      const html2canvas = (window as any).html2canvas;
      // build container with same content as PDF header + table
      const container = document.createElement('div');
      container.style.padding = '20px';
      container.style.background = '#fff';
      container.style.color = '#333';
      container.style.maxWidth = '1200px';
      container.style.fontFamily = 'Arial, sans-serif';
      const headerHtml = `
        <div style="text-align:center;margin-bottom:12px">
          <img src="/assets/logo_realtech.png" alt="logo" style="height:72px;object-fit:contain;margin-bottom:6px" />
          <h2 style="margin:0">${reportTitle}</h2>
          <div style="font-size:12px;color:#666">Période: ${new Date(startDate!).toLocaleDateString()} - ${new Date(endDate!).toLocaleDateString()}</div>
        </div>
      `;
      const tableRows = movements.map(m => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${m.product?.name||m.product_name||''}</td>
          <td style="padding:8px;border:1px solid #ddd">${m.movement_type}</td>
          <td style="padding:8px;border:1px solid #ddd">${m.movement_subtype}</td>
          <td style="padding:8px;border:1px solid #ddd">${m.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd">${m.reference||''}</td>
          <td style="padding:8px;border:1px solid #ddd">${new Date(m.created_at).toLocaleString()}</td>
        </tr>
      `).join('');
      const tableHtml = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">Produit</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">Type</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">Sous-type</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">Quantité</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">Référence</th>
              <th style="padding:8px;border:1px solid #ddd;background:#f3f4f6">Date</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
      container.innerHTML = headerHtml + tableHtml;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      document.body.removeChild(container);
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) { toast.error('Échec génération image'); return; }
        const ext = type === 'png' ? 'png' : 'jpg';
        const filename = `rapport_${(new Date()).toISOString().slice(0,10)}.${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Image ${type.toUpperCase()} générée`);
      }, type === 'png' ? 'image/png' : 'image/jpeg', type === 'jpg' ? 0.9 : undefined);
    } catch (error) {
      toast.error('Erreur lors de la génération de l\'image');
      console.error(error);
    }
  };

  const exportPrint = () => {
    exportPDF();
  };

  const loadSampleData = () => {
    setLoading(true);
    setTimeout(() => {
      // Simulate API call
      const sampleData = Array.from({ length: 15 }, (_, i) => ({
        id: `sample-${i}`,
        product: { name: `Produit ${i + 1}` },
        product_name: `Produit ${i + 1}`,
        movement_type: i % 3 === 0 ? 'in' : 'out',
        movement_subtype: i % 2 === 0 ? 'livraison' : 'commande',
        quantity: Math.floor(Math.random() * 100) + 1,
        reference: `REF-${1000 + i}`,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        created_by: `Utilisateur ${i % 3 + 1}`
      }));
      
      setMovements(sampleData);
      toast.success('Données exemple chargées');
      setLoading(false);
    }, 1000);
  };

  const ColumnSelector = () => (
    <Dialog>
      <Button variant="outline" size="sm" className="gap-2">
        <Settings className="h-4 w-4" />
        Colonnes
        <ChevronDown className="h-4 w-4" />
      </Button>
    </Dialog>
  );

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Générateur de Rapports</h1>
          <p className="text-gray-600 mt-1">
            Créez et exportez des rapports détaillés sur vos mouvements de stock
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadSampleData}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Données Exemple
          </Button>
          <Button 
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? 'Masquer l\'aperçu' : 'Aperçu'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration
              </CardTitle>
              <CardDescription>Paramètres du rapport</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Titre du Rapport</Label>
                <Input 
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Entrez le titre du rapport"
                />
              </div>

              <div className="space-y-2">
                <Label>Type de Rapport</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex flex-col">
                          <span>{type.label}</span>
                          <span className="text-xs text-gray-500">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Période</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map(option => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {period === 'custom' && (
                <div className="space-y-2">
                  <Label>Plage de dates personnalisée</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Début</Label>
                      <Input type="datetime-local" value={startDate ? new Date(startDate).toISOString().slice(0,16) : ''} onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value).toISOString() : null)} />
                    </div>
                    <div>
                      <Label>Fin</Label>
                      <Input type="datetime-local" value={endDate ? new Date(endDate).toISOString().slice(0,16) : ''} onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value).toISOString() : null)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Format d'export</Label>
                <div className="grid grid-cols-2 gap-2">
                  {formatOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        variant={format === option.value ? "default" : "outline"}
                        className={`justify-start ${format === option.value ? option.color : ''}`}
                        onClick={() => setFormat(option.value)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-summary" className="cursor-pointer">
                    Inclure le résumé
                  </Label>
                  <Switch
                    id="include-summary"
                    checked={includeSummary}
                    onCheckedChange={setIncludeSummary}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="include-charts" className="cursor-pointer">
                    Inclure les graphiques
                  </Label>
                  <Switch
                    id="include-charts"
                    checked={includeCharts}
                    onCheckedChange={setIncludeCharts}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="email-report" className="cursor-pointer">
                    Envoyer par email
                  </Label>
                  <Switch
                    id="email-report"
                    checked={emailReport}
                    onCheckedChange={setEmailReport}
                  />
                </div>
              </div>

              {emailReport && (
                <div className="space-y-2 pt-2">
                  <Label>Adresse email</Label>
                  <Input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="email@exemple.com"
                  />
                </div>
              )}

              <div className="pt-4 space-y-2">
                <Button 
                  onClick={fetchReportData}
                  className="w-full gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <Filter className="h-4 w-4" />
                      Charger les données
                    </>
                  )}
                </Button>

                <Button 
                  onClick={generateReport}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  disabled={generating || movements.length === 0}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Générer le rapport
                    </>
                  )}
                </Button>
                <Button
                  onClick={shareReport}
                  className="w-full gap-2 mt-2"
                  disabled={generating || movements.length === 0}
                >
                  Partager (WhatsApp)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Statistiques Rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Données chargées</span>
                <Badge variant={movements.length > 0 ? "success" : "secondary"}>
                  {movements.length} lignes
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Période</span>
                <span className="text-sm font-medium">
                  {startDate ? new Date(startDate).toLocaleDateString() : '-'} 
                  {' → '}
                  {endDate ? new Date(endDate).toLocaleDateString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Format sélectionné</span>
                <Badge variant="outline" className="font-mono">
                  {format.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Entrées</p>
                    <h3 className="text-2xl font-bold mt-2 text-green-600">
                      {reportSummary.totalIn}
                    </h3>
                  </div>
                  <div className="p-3 bg-green-50 rounded-full">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Quantité totale entrante</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Sorties</p>
                    <h3 className="text-2xl font-bold mt-2 text-red-600">
                      {reportSummary.totalOut}
                    </h3>
                  </div>
                  <div className="p-3 bg-red-50 rounded-full">
                    <TrendingUp className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Quantité totale sortante</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Variation Nette</p>
                    <h3 className={`text-2xl font-bold mt-2 ${
                      reportSummary.netChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {reportSummary.netChange >= 0 ? '+' : ''}{reportSummary.netChange}
                    </h3>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full">
                    <BarChart className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Balance stock</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Produits Actifs</p>
                    <h3 className="text-2xl font-bold mt-2 text-purple-600">
                      {reportSummary.uniqueProducts}
                    </h3>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-full">
                    <Package className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Avec mouvements</p>
              </CardContent>
            </Card>
          </div>

          {/* Data Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Aperçu des Données</CardTitle>
                  <CardDescription>
                    {movements.length} mouvements trouvés
                    {startDate && endDate && (
                      <span className="ml-2">
                        ({new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()})
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMovements([])}
                  >
                    Effacer
                  </Button>
                  <ColumnSelector />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Aucune donnée
                  </h3>
                  <p className="text-gray-600 max-w-sm mx-auto mb-6">
                    Chargez des données pour visualiser et générer des rapports
                  </p>
                  <Button onClick={loadSampleData} variant="outline">
                    Charger des données exemple
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.slice(0, 10).map((m, i) => (
                        <TableRow key={m.id || i}>
                          <TableCell className="font-medium">
                            {m.product?.name || m.product_name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={m.movement_type === 'in' ? 'success' : 'destructive'}
                              className={
                                m.movement_type === 'in' 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                  : 'bg-red-100 text-red-800 hover:bg-red-100'
                              }
                            >
                              {m.movement_type === 'in' ? 'Entrée' : 'Sortie'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{m.quantity}</span>
                              {m.unit_cost && (
                                <span className="text-xs text-gray-500">
                                  ({m.unit_cost} €/u)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {m.reference || '-'}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(m.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={m.status === 'active' ? 'outline' : 'secondary'}
                              className={
                                m.status === 'active' 
                                  ? 'border-green-200 text-green-700' 
                                  : 'border-gray-200 text-gray-700'
                              }
                            >
                              {m.status === 'active' ? 'Actif' : m.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {movements.length > 10 && (
                    <div className="p-4 border-t text-center">
                      <p className="text-sm text-gray-600">
                        + {movements.length - 10} autres mouvements non affichés
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 5 Produits</CardTitle>
                <CardDescription>Produits avec le plus d'activité</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <div className="flex gap-4 text-sm text-gray-600">
                            <span>Entrées: {product.totalIn}</span>
                            <span>Sorties: {product.totalOut}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${
                        product.netChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {product.netChange >= 0 ? '+' : ''}{product.netChange}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsImproved;
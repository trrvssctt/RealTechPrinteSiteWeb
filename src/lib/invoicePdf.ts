import { apiFetch } from '@/lib/api';
// Importé via Vite : URL valide en dev comme en build (le fichier n'est pas dans public/)
import cachetUrl from '/assets/cachet_realtech.png';
import { buildInvoiceHTML, type Invoice } from '@/lib/invoiceTemplate';

const A4_W_MM = 210;
const A4_H_MM = 297;
const PAGE_MARGIN_MM = 12; // marges haut/bas des pages quand le document en compte plusieurs

/**
 * Rend un document HTML (conteneur `.invoice-container`, largeur A4) dans un iframe
 * hors écran puis l'exporte en PDF A4 (html2canvas + jsPDF).
 * Au-delà d'une page, le document est découpé entre deux lignes de tableau / blocs
 * (jamais au milieu d'une ligne) et les pages sont numérotées.
 */
export async function downloadHtmlAsPdf(html: string, filename: string): Promise<void> {
  const [jspdfMod, html2canvasMod] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const jsPDF = (jspdfMod as any).jsPDF || (jspdfMod as any).default || jspdfMod;
  const html2canvas = (html2canvasMod as any).default || html2canvasMod;

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', left: '-9999px', top: '0', width: '210mm', height: '297mm', border: 'none', background: 'white',
  });
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error('Impossible de créer le document iframe');
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') resolve();
      else iframe.contentWindow?.addEventListener('load', () => resolve());
    });
    await new Promise(resolve => setTimeout(resolve, 800));

    const container = doc.querySelector('.invoice-container') as HTMLElement | null;
    if (!container) throw new Error('Conteneur du document introuvable');

    const totalH = container.offsetHeight;
    const pxPerMm = container.offsetWidth / A4_W_MM;
    const pageH = A4_H_MM * pxPerMm;

    // Découpage en pages (en px CSS du conteneur)
    const slices: Array<[number, number]> = [];
    if (totalH <= pageH + 1) {
      slices.push([0, totalH]);
    } else {
      const top0 = container.getBoundingClientRect().top;
      // tr.keep : lignes de totaux, jamais séparées du reste du bloc (ni du cachet qui suit)
      const breakpoints = Array.from(container.querySelectorAll('tr:not(.keep), .section-band, .avoid-break, h1, h2'))
        .map(el => (el as HTMLElement).getBoundingClientRect().top - top0)
        .filter(y => y > 0)
        .sort((a, b) => a - b);
      const usable = pageH - 2 * PAGE_MARGIN_MM * pxPerMm;
      let start = 0;
      while (totalH - start > usable) {
        const limit = start + usable;
        // Dernier point de coupe possible dans la page (au moins un tiers de page rempli)
        const cut = [...breakpoints].reverse().find(y => y <= limit && y > start + usable / 3) ?? limit;
        slices.push([start, cut]);
        start = cut;
      }
      slices.push([start, totalH]);
    }

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: totalH,
    });
    const ratio = canvas.height / totalH;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const multi = slices.length > 1;
    slices.forEach(([a, b], idx) => {
      if (idx > 0) pdf.addPage();
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = Math.max(1, Math.round((b - a) * ratio));
      const ctx = part.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, part.width, part.height);
      ctx.drawImage(canvas, 0, Math.round(a * ratio), canvas.width, part.height, 0, 0, canvas.width, part.height);
      const y = multi && idx > 0 ? PAGE_MARGIN_MM : 0;
      pdf.addImage(part.toDataURL('image/jpeg', 0.95), 'JPEG', 0, y, A4_W_MM, (b - a) / pxPerMm);
      if (multi) {
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Page ${idx + 1} / ${slices.length}`, A4_W_MM - 12, A4_H_MM - 6, { align: 'right' });
      }
    });
    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}

// Facture en PDF (cachet de l'entreprise en option, ex. commande terminée)
export async function downloadInvoicePdf(invoice: Invoice, opts: { stamp?: boolean } = {}): Promise<void> {
  const stampHtml = opts.stamp
    ? `<div class="stamp"><img src="${cachetUrl}" alt="cachet"/></div>`
    : '';
  const html = buildInvoiceHTML(invoice).replace('<div class="invoice-footer">', stampHtml + '<div class="invoice-footer">');
  await downloadHtmlAsPdf(html, `Facture-${invoice.invoice_number}.pdf`);
}

async function readJson(resp: Response) {
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || resp.statusText);
  return body;
}

// Facture d'une commande : le type (acompte / définitive) découle de son état de paiement.
// Si rien n'a changé depuis la dernière facture, elle est réimprimée (reused = true).
export async function createInvoiceFromOrder(orderId: string): Promise<{ invoice: Invoice; reused: boolean }> {
  const resp = await apiFetch('/api/admin/invoices/from-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const body = await readJson(resp);
  return { invoice: body.data, reused: !!body.reused };
}

export async function fetchInvoices(params: Record<string, string> = {}): Promise<Invoice[]> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const resp = await apiFetch(`/api/admin/invoices${qs ? `?${qs}` : ''}`);
  return (await readJson(resp)).data || [];
}

// Détail complet (avec acomptes déjà versés) avant impression
export async function fetchInvoice(id: string): Promise<Invoice> {
  const resp = await apiFetch(`/api/admin/invoices/${id}`);
  return (await readJson(resp)).data;
}

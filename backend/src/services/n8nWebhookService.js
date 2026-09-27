/**
 * Service d'intégration n8n
 * Envoie les événements métier vers les webhooks n8n pour traitement WhatsApp.
 * Tous les appels sont fire-and-forget (non bloquants pour l'API).
 */

const pool = require('../config/db');

const N8N_BASE_URL     = process.env.N8N_BASE_URL     || 'http://localhost:5678';
const N8N_EVENTS_PATH  = process.env.N8N_EVENTS_PATH  || '/webhook/realtech/events';
const N8N_AGENT_PATH   = process.env.N8N_AGENT_PATH   || '/webhook/realtech/agent/chat';
const N8N_REPORT_PATH  = process.env.N8N_REPORT_PATH  || '/webhook/realtech/rapport-journalier';
const N8N_WEBHOOK_KEY  = process.env.N8N_WEBHOOK_KEY  || '';

function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (N8N_WEBHOOK_KEY) headers['X-N8N-Key'] = N8N_WEBHOOK_KEY;
  return headers;
}

async function logNotification(event_type, event_id, message, status, error_message, metadata) {
  try {
    await pool.query(
      `INSERT INTO app.whatsapp_notifications
         (event_type, event_id, message, status, sent_at, error_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event_type,
        event_id || null,
        message,
        status,
        status === 'sent' ? new Date() : null,
        error_message || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (e) {
    console.warn('[n8n] Impossible de logger la notification WhatsApp :', e.message);
  }
}

async function sendEvent(payload) {
  if (!process.env.N8N_BASE_URL) {
    console.warn('[n8n] N8N_BASE_URL non défini – événement ignoré :', payload.event_type);
    return;
  }
  const url = `${N8N_BASE_URL}${N8N_EVENTS_PATH}`;
  try {
    const { default: fetch } = await import('node-fetch');
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
      timeout: 8000,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      await logNotification(payload.event_type, payload.event_id, payload.message || '', 'failed', `HTTP ${resp.status}: ${text}`, payload);
      console.warn(`[n8n] Webhook échoué (${resp.status}) pour ${payload.event_type}`);
    } else {
      await logNotification(payload.event_type, payload.event_id, payload.message || '', 'sent', null, payload);
    }
  } catch (err) {
    await logNotification(payload.event_type, payload.event_id, payload.message || '', 'failed', err.message, payload);
    console.warn('[n8n] Erreur réseau webhook :', err.message);
  }
}

// ─── Événements métier ──────────────────────────────────────────────────────

async function notifySaleCompleted(order) {
  const clientName = order.client_name || order.metadata?.customer?.name || 'Client';
  const montant    = Number(order.total_amount || 0).toLocaleString('fr-FR');
  const items      = (order.items || [])
    .map(i => `• ${i.product_name || i.service_name || 'Article'} ×${i.quantity}`)
    .join('\n');

  const message = [
    `✅ *Vente complétée* — RealTech Print`,
    ``,
    `👤 Client : ${clientName}`,
    `💰 Montant : ${montant} FCFA`,
    items ? `📦 Articles :\n${items}` : '',
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].filter(Boolean).join('\n');

  await sendEvent({
    event_type: 'sale_completed',
    event_id:   order.id,
    message,
    data: { order_id: order.id, client: clientName, montant, items: order.items },
  });
}

async function notifyOrderCreated(order) {
  const clientName = order.client_name || order.metadata?.customer?.name || 'Client';
  const montant    = Number(order.total_amount || 0).toLocaleString('fr-FR');

  const message = [
    `🛒 *Nouvelle commande* — RealTech Print`,
    ``,
    `👤 Client : ${clientName}`,
    `💰 Montant : ${montant} FCFA`,
    `📋 Statut : En attente`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({
    event_type: 'order_created',
    event_id:   order.id,
    message,
    data: { order_id: order.id, client: clientName, montant },
  });
}

async function notifyOrderCancelled(order) {
  const clientName = order.client_name || order.metadata?.customer?.name || 'Client';
  const raison     = order.cancel_reason || 'Non précisée';

  const message = [
    `❌ *Commande annulée* — RealTech Print`,
    ``,
    `👤 Client : ${clientName}`,
    `📋 Raison : ${raison}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({
    event_type: 'order_cancelled',
    event_id:   order.id,
    message,
    data: { order_id: order.id, client: clientName, raison },
  });
}

async function notifyStockExit(movement) {
  const produit  = movement.product_name || movement.product_id || 'Produit';
  const quantite = movement.quantity || 0;
  const type     = movement.movement_subtype || 'sortie';
  const employe  = movement.employe || 'Employé';

  const message = [
    `📦 *Sortie de stock* — RealTech Print`,
    ``,
    `🏷️ Produit : ${produit}`,
    `🔢 Quantité : ${quantite}`,
    `📂 Type : ${type}`,
    `👷 Employé : ${employe}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({
    event_type: 'stock_exit',
    event_id:   movement.id,
    message,
    data: { movement_id: movement.id, produit, quantite, type, employe },
  });
}

// ─── Produits ────────────────────────────────────────────────────────────────

async function notifyProductCreated(product, actor) {
  const nom    = product.name || 'Produit';
  const prix   = Number(product.price || 0).toLocaleString('fr-FR');
  const acteur = actor || 'Admin';

  const message = [
    `🆕 *Nouveau produit créé* — RealTech Print`,
    ``,
    `📦 Produit : ${nom}`,
    `💰 Prix : ${prix} FCFA`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'product_created', event_id: product.id, message, data: { product_id: product.id, nom, prix, acteur } });
}

async function notifyProductUpdated(product, actor) {
  const nom    = product.name || 'Produit';
  const acteur = actor || 'Admin';

  const message = [
    `✏️ *Produit modifié* — RealTech Print`,
    ``,
    `📦 Produit : ${nom}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'product_updated', event_id: product.id, message, data: { product_id: product.id, nom, acteur } });
}

async function notifyProductDeleted(product, actor) {
  const nom    = product.name || 'Produit';
  const acteur = actor || 'Admin';

  const message = [
    `🗑️ *Produit supprimé* — RealTech Print`,
    ``,
    `📦 Produit : ${nom}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'product_deleted', event_id: product.id, message, data: { product_id: product.id, nom, acteur } });
}

// ─── Services ────────────────────────────────────────────────────────────────

async function notifyServiceCreated(service, actor) {
  const nom    = service.name || 'Service';
  const prix   = Number(service.price || service.base_price || 0).toLocaleString('fr-FR');
  const acteur = actor || 'Admin';

  const message = [
    `🆕 *Nouveau service créé* — RealTech Print`,
    ``,
    `🛠️ Service : ${nom}`,
    `💰 Prix : ${prix} FCFA`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'service_created', event_id: service.id, message, data: { service_id: service.id, nom, prix, acteur } });
}

async function notifyServiceUpdated(service, actor) {
  const nom    = service.name || 'Service';
  const acteur = actor || 'Admin';

  const message = [
    `✏️ *Service modifié* — RealTech Print`,
    ``,
    `🛠️ Service : ${nom}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'service_updated', event_id: service.id, message, data: { service_id: service.id, nom, acteur } });
}

async function notifyServiceDeleted(service, actor) {
  const nom    = service.name || 'Service';
  const acteur = actor || 'Admin';

  const message = [
    `🗑️ *Service supprimé* — RealTech Print`,
    ``,
    `🛠️ Service : ${nom}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'service_deleted', event_id: service.id, message, data: { service_id: service.id, nom, acteur } });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

async function notifyClientCreated(client, actor) {
  const nom    = client.full_name || client.email || 'Client';
  const acteur = actor || 'Admin';

  const message = [
    `👤 *Nouveau client créé* — RealTech Print`,
    ``,
    `🏷️ Nom : ${nom}`,
    `📧 Email : ${client.email || '—'}`,
    `📱 Téléphone : ${client.phone || '—'}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'client_created', event_id: client.id, message, data: { client_id: client.id, nom, email: client.email, phone: client.phone, acteur } });
}

async function notifyClientUpdated(client, actor) {
  const nom    = client.full_name || client.email || 'Client';
  const acteur = actor || 'Admin';

  const message = [
    `✏️ *Client modifié* — RealTech Print`,
    ``,
    `🏷️ Nom : ${nom}`,
    `📧 Email : ${client.email || '—'}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'client_updated', event_id: client.id, message, data: { client_id: client.id, nom, acteur } });
}

async function notifyClientDeleted(client, actor) {
  const nom    = client.full_name || client.email || 'Client';
  const acteur = actor || 'Admin';

  const message = [
    `🗑️ *Client supprimé* — RealTech Print`,
    ``,
    `🏷️ Nom : ${nom}`,
    `📧 Email : ${client.email || '—'}`,
    `👤 Par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'client_deleted', event_id: client.id, message, data: { client_id: client.id, nom, acteur } });
}

// ─── Dépenses ─────────────────────────────────────────────────────────────────

async function notifyDepenseCreated(depense, actor) {
  const montant  = Number(depense.montant || 0).toLocaleString('fr-FR');
  const acteur   = actor || depense.employe_name || 'Employé';

  const message = [
    `💸 *Nouvelle dépense enregistrée* — RealTech Print`,
    ``,
    `📝 Description : ${depense.description || '—'}`,
    `🗂️ Catégorie : ${depense.categorie || '—'}`,
    `💰 Montant : ${montant} FCFA`,
    `👤 Par : ${acteur}`,
    `📋 Statut : En attente de validation`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'depense_created', event_id: depense.id, message, data: { depense_id: depense.id, montant, categorie: depense.categorie, acteur } });
}

async function notifyDepenseValidated(depense, actor) {
  const montant = Number(depense.montant || 0).toLocaleString('fr-FR');
  const acteur  = actor || 'Admin';

  const message = [
    `✅ *Dépense validée* — RealTech Print`,
    ``,
    `📝 Description : ${depense.description || '—'}`,
    `💰 Montant : ${montant} FCFA`,
    `👤 Validée par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'depense_validated', event_id: depense.id, message, data: { depense_id: depense.id, montant, acteur } });
}

async function notifyDepenseRejected(depense, actor) {
  const montant = Number(depense.montant || 0).toLocaleString('fr-FR');
  const acteur  = actor || 'Admin';

  const message = [
    `❌ *Dépense rejetée* — RealTech Print`,
    ``,
    `📝 Description : ${depense.description || '—'}`,
    `💰 Montant : ${montant} FCFA`,
    `💬 Motif : ${depense.commentaire_admin || '—'}`,
    `👤 Rejetée par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'depense_rejected', event_id: depense.id, message, data: { depense_id: depense.id, montant, acteur, motif: depense.commentaire_admin } });
}

async function notifyDepenseCancelled(depense, actor) {
  const montant = Number(depense.montant || 0).toLocaleString('fr-FR');
  const acteur  = actor || 'Admin';

  const message = [
    `🚫 *Dépense annulée* — RealTech Print`,
    ``,
    `📝 Description : ${depense.description || '—'}`,
    `💰 Montant : ${montant} FCFA`,
    `💬 Raison : ${depense.commentaire_admin || '—'}`,
    `👤 Annulée par : ${acteur}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'depense_cancelled', event_id: depense.id, message, data: { depense_id: depense.id, montant, acteur } });
}

// ─── Entrée de stock ──────────────────────────────────────────────────────────

async function notifyStockEntry(movement) {
  const produit  = movement.product_name || movement.product_id || 'Produit';
  const quantite = movement.quantity || 0;
  const type     = movement.movement_subtype || 'entrée';
  const employe  = movement.employe || 'Employé';

  const message = [
    `📥 *Entrée de stock* — RealTech Print`,
    ``,
    `🏷️ Produit : ${produit}`,
    `🔢 Quantité : +${quantite}`,
    `📂 Type : ${type}`,
    `👷 Employé : ${employe}`,
    ``,
    `🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' })}`,
  ].join('\n');

  await sendEvent({ event_type: 'stock_entry', event_id: movement.id, message, data: { movement_id: movement.id, produit, quantite, type, employe } });
}

async function notifyDailyReport(reportInfo) {
  const { date, filepath, filename, totalVentes, totalQteSorties, totalDepenses, ventesCount, depensesCount } = reportInfo;

  const message = [
    `📊 *Rapport Journalier* — RealTech Print`,
    `📅 ${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Dakar' })}`,
    ``,
    `💰 Ventes : ${Number(totalVentes).toLocaleString('fr-FR')} FCFA (${ventesCount} commandes)`,
    `📦 Sorties stock : ${totalQteSorties} unités`,
    `💸 Dépenses : ${Number(totalDepenses).toLocaleString('fr-FR')} FCFA (${depensesCount} enregistrements)`,
    ``,
    `📎 Le fichier Excel détaillé est joint ci-dessous.`,
  ].join('\n');

  await sendEvent({
    event_type:    'daily_report',
    event_id:      null,
    message,
    report_path:   filepath,
    report_name:   filename,
    report_date:   date,
    data: { totalVentes, totalQteSorties, totalDepenses, ventesCount, depensesCount },
  });
}

// ─── Agent IA (requête synchrone — attend la réponse n8n) ──────────────────

async function askAgent(question, adminId, conversationId, messages = []) {
  if (!process.env.N8N_BASE_URL) {
    return { answer: "L'agent IA n'est pas encore configuré (N8N_BASE_URL manquant)." };
  }
  const url = `${N8N_BASE_URL}${N8N_AGENT_PATH}`;
  try {
    const { default: fetch } = await import('node-fetch');
    const resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        question,
        admin_id: adminId,
        conversation_id: conversationId,
        messages,          // historique complet pour le contexte DeepSeek
      }),
      timeout: 30000,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    const json = await resp.json().catch(() => ({ answer: "Réponse invalide de l'agent." }));
    return json;
  } catch (err) {
    console.error('[n8n] Erreur agent IA :', err.message);
    return { answer: `Erreur de communication avec l'agent : ${err.message}` };
  }
}

module.exports = {
  notifySaleCompleted,
  notifyOrderCreated,
  notifyOrderCancelled,
  notifyStockExit,
  notifyStockEntry,
  notifyDailyReport,
  askAgent,
  notifyProductCreated,
  notifyProductUpdated,
  notifyProductDeleted,
  notifyServiceCreated,
  notifyServiceUpdated,
  notifyServiceDeleted,
  notifyClientCreated,
  notifyClientUpdated,
  notifyClientDeleted,
  notifyDepenseCreated,
  notifyDepenseValidated,
  notifyDepenseRejected,
  notifyDepenseCancelled,
};

/**
 * Paiements des commandes (versements dans app.payments).
 * Une commande peut être payée en plusieurs fois ; son état de paiement est
 * toujours déduit de la somme des versements.
 */

const db = require('../config/db');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Montant payé d'une commande (alias SQL `o`). Les anciennes commandes, antérieures
// à l'enregistrement des versements, comptent comme payées si elles sont terminées
// ou marquées « payée » dans metadata.delivery.
const paidSql = (o) => `(CASE
  WHEN EXISTS (SELECT 1 FROM app.payments pay WHERE pay.order_id = ${o}.id AND pay.status = 'paid')
    THEN (SELECT SUM(pay.amount) FROM app.payments pay WHERE pay.order_id = ${o}.id AND pay.status = 'paid')
  WHEN ${o}.status = 'completed' OR ${o}.metadata->'delivery'->>'payment_status' = 'paid'
    THEN ${o}.total_amount
  ELSE 0 END)`;

// 'paid' | 'partial' | 'unpaid'
function paymentStatus(paid, total) {
  if (Number(total) > 0 ? paid >= Number(total) : paid > 0) return 'paid';
  return paid > 0 ? 'partial' : 'unpaid';
}

/**
 * État complet d'une commande pour la facturation.
 * `q` : pool ou client de transaction (doit exposer .query).
 */
async function getOrderState(orderId, q = db) {
  const { rows } = await q.query(
    `SELECT o.*, ${paidSql('o')} AS amount_paid FROM app.orders o WHERE o.id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return null;

  const total = Number(order.total_amount) || 0;
  const amountPaid = round2(order.amount_paid || 0);

  const { rows: payRows } = await q.query(
    `SELECT paid_at, provider AS method, amount FROM app.payments
      WHERE order_id = $1 AND status = 'paid' ORDER BY paid_at, created_at`,
    [orderId]
  );
  let payments = payRows.map(p => ({ paid_at: p.paid_at, method: p.method, amount: Number(p.amount) }));
  // Ancienne commande payée sans versement enregistré : un versement unique implicite
  if (payments.length === 0 && amountPaid > 0) {
    payments = [{
      paid_at: order.completed_at || order.placed_at,
      method: order.metadata?.sale_context?.payment_method || null,
      amount: amountPaid,
    }];
  }

  return {
    order,
    state: {
      order_status: order.status,
      delivery_status: order.metadata?.delivery?.delivery_status || (order.status === 'completed' ? 'full' : 'none'),
      payment_status: paymentStatus(amountPaid, total),
      amount_paid: amountPaid,
      remaining: round2(Math.max(0, total - amountPaid)),
      payments,
    },
  };
}

module.exports = { paidSql, paymentStatus, getOrderState, round2 };

const { validationResult } = require('express-validator');
const contactModel = require('../models/contactModel');
const nodemailer = require('nodemailer');

// create transporter if SMTP details provided
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined,
  });
}

async function verifyRecaptcha(token, remoteip) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    // no secret configured: skip verification (development)
    console.warn('RECAPTCHA_SECRET not set; skipping recaptcha verification');
    return { ok: true };
  }

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);
  if (remoteip) params.append('remoteip', remoteip);

  try {
    // use global fetch when available
    const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;
    const resp = await fetchFn('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = await resp.json();
    return json; // contains success, score, action, etc.
  } catch (err) {
    console.error('recaptcha verification failed', err);
    return { ok: false, error: 'recaptcha-failed' };
  }
}

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message, recaptchaToken } = req.body;

    // verify recaptcha token
    const remoteip = req.ip || req.headers['x-forwarded-for'] || '';
    const rec = await verifyRecaptcha(recaptchaToken, remoteip);
    if (process.env.RECAPTCHA_SECRET) {
      if (!rec || rec.success !== true) {
        return res.status(400).json({ error: 'reCAPTCHA verification failed' });
      }
      // if score present (v3), enforce a minimum threshold
      if (typeof rec.score === 'number' && rec.score < 0.4) {
        return res.status(400).json({ error: 'reCAPTCHA score too low' });
      }
    }

    const { name: _n, email: _e, subject: _s, message: _m } = { name, email, subject, message };

    const nameVal = _n;
    const emailVal = _e;
    const subjectVal = _s;
    const messageVal = _m;

    // limit message size server-side as an extra precaution
    if (typeof messageVal !== 'string' || messageVal.length > 10000) {
      return res.status(400).json({ error: 'Message too long' });
    }

    const ip_address = req.ip || req.headers['x-forwarded-for'] || null;
    const user_agent = req.get('User-Agent') || null;

    const contact = await contactModel.createContact({
      name: nameVal,
      email: emailVal,
      subject: subjectVal,
      message: messageVal,
      ip_address,
      user_agent,
      metadata: { ref: req.get('Referer') || null, recaptcha: rec || null }
    });

    // send notification email (best-effort; do not block client if email fails)
    (async () => {
      try {
        const to = process.env.CONTACT_NOTIFY_EMAIL;
        if (transporter && to) {
          const subjectLine = subject ? `Nouveau message: ${subject}` : 'Nouveau message de contact';
          const html = `
            <p><strong>Nom:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Sujet:</strong> ${escapeHtml(subject || '')}</p>
            <p><strong>Message:</strong></p>
            <div style="white-space:pre-wrap;border:1px solid #eee;padding:8px">${escapeHtml(message)}</div>
            <p><small>IP: ${escapeHtml(ip_address || '')} — User-Agent: ${escapeHtml(user_agent || '')}</small></p>
          `;
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com',
            to,
            subject: subjectLine,
            html,
            text: `${name} <${email}>\n\n${message}`
          });
        }
      } catch (err) {
        console.error('Failed to send contact notification email', err);
      }
    })();

    return res.status(201).json({ ok: true, contact: { id: contact.id, created_at: contact.created_at } });
  } catch (err) {
    next(err);
  }
};

// small helper to avoid accidental HTML injection in the email body
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Admin helpers
const list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const offset = parseInt(req.query.offset || '0', 10);
    const handled = req.query.handled === undefined ? null : req.query.handled === 'true';
    const rows = await contactModel.listContacts({ limit, offset, handled });
    res.json({ ok: true, results: rows });
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const contact = await contactModel.getContact(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, contact });
  } catch (err) {
    next(err);
  }
};

const handle = async (req, res, next) => {
  try {
    const contact = await contactModel.markHandled(req.params.id, true);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, contact });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, list, get, handle };

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database');
const config = require('../config');

const VERIFY_TOKENS = new Map();

module.exports = function(emailService) {
  // POST /api/auth/register
  router.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, organization } = req.body;
      if (!name || !email || !email.includes('@')) {
        return res.status(400).json({ error: 'Name and valid email required' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
      if (existing && existing.verified) {
        return res.status(400).json({ error: 'Email already registered. Please log in.' });
      }

      const verifyToken = crypto.randomBytes(32).toString('hex');
      VERIFY_TOKENS.set(verifyToken, { email: normalizedEmail, name: name.trim() });

      if (existing) {
        db.prepare('UPDATE users SET name=?, organization=?, verify_token=? WHERE email=?')
          .run(name.trim(), (organization || '').trim(), verifyToken, normalizedEmail);
      } else {
        db.prepare('INSERT INTO users (name, email, organization, verify_token) VALUES (?,?,?,?)')
          .run(name.trim(), normalizedEmail, (organization || '').trim(), verifyToken);
      }

      // Send verification email
      if (emailService && emailService.transporter) {
        const verifyLink = `http://localhost:5000/verify.html?token=${verifyToken}`;
        try {
          await emailService.transporter.sendMail({
            from: `"Skill Sprint" <${config.smtp.user}>`,
            to: normalizedEmail,
            subject: 'Verify your Skill Sprint account',
            html: `<div style="max-width:500px;margin:0 auto;font-family:Arial;">
              <div style="background:linear-gradient(135deg,#4361ee,#3f37c9);padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;">🎯 Skill Sprint</h1></div>
              <div style="background:#f8f9fa;padding:24px;border:1px solid #dee2e6;">
                <h2>Welcome, ${name}!</h2>
                <p>Click below to verify your email and start your AI-powered career journey.</p>
                <a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:#4361ee;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Verify Email</a>
                <p style="font-size:12px;color:#888;margin-top:16px;">Or copy: ${verifyLink}</p>
              </div></div>`,
          });
        } catch (e) { console.error('Verification email failed:', e.message); }
      }

      res.json({ success: true, message: 'Account created! Check your email for verification link.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/auth/verify?token=xxx
  router.get('/api/auth/verify', (req, res) => {
    const { token } = req.query;
    if (!token || !VERIFY_TOKENS.has(token)) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }
    const data = VERIFY_TOKENS.get(token);
    db.prepare('UPDATE users SET verified=1, verify_token=NULL WHERE email=?').run(data.email);
    VERIFY_TOKENS.delete(token);
    res.json({ success: true, message: 'Email verified! You can now log in.', email: data.email });
  });

  // POST /api/auth/login
  router.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return res.status(404).json({ error: 'User not found. Please register first.' });

    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        organization: user.organization || '',
        subscription: user.subscription, verified: !!user.verified,
        wipeCount: user.wipeCount || 0,
      },
    });
  });

  // GET /api/auth/me
  router.get('/api/auth/me', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const decoded = jwt.verify(auth.replace('Bearer ', ''), config.jwtSecret);
      const user = db.prepare('SELECT id, name, email, organization, subscription, verified FROM users WHERE id = ?').get(decoded.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
};

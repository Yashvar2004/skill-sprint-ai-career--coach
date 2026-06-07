require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const { EmailService } = require('./src/email/service');

const app = express();
const emailService = new EmailService();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use(require('./src/routes/auth')(emailService));
app.use(require('./src/routes/assessment')(emailService));
app.use(require('./src/routes/mentor')());
app.use(require('./src/routes/resume')());
app.use(require('./src/routes/courses')());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', services: { ai: !!config.ai.apiKey, email: !!emailService.transporter }, timestamp: new Date().toISOString() });
});

// Serve SPA
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║  🎯 Skill Sprint — AI Career Coach   ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  http://localhost:${PORT}                  ║`);
    console.log(`║  AI: ${config.ai.apiKey ? 'ENABLED ✓' : 'offline ✗'}                       ║`);
    console.log(`║  Email: ${emailService.transporter ? 'ENABLED ✓' : 'offline ✗'}                   ║`);
    console.log('╚══════════════════════════════════════╝');
  });
}

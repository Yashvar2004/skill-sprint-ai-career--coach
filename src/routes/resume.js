const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const config = require('../config');
const { AICoach } = require('../ai/coach');

const ai = new AICoach();

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), config.jwtSecret);
    next();
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
}

module.exports = function() {
  // POST /api/resume/analyze
  router.post('/api/resume/analyze', authMiddleware, async (req, res) => {
    try {
      const { resumeText, jobRole } = req.body;
      if (!resumeText || resumeText.length < 50) return res.status(400).json({ error: 'Please paste your full resume text (at least 50 characters).' });
      if (!jobRole) return res.status(400).json({ error: 'Target job role required.' });

      // Free tier limit
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const analysisCount = db.prepare('SELECT COUNT(*) as count FROM resume_analyses WHERE user_id = ?').get(req.user.id);
      if (user.subscription === 'free' && analysisCount.count >= config.freeTier.maxResumeAnalyses) {
        return res.status(403).json({ error: 'Free tier limit reached. Upgrade for unlimited resume analyses.', upgrade: true });
      }

      const analysis = await ai.analyzeResume(resumeText, jobRole);

      if (analysis) {
        db.prepare('INSERT INTO resume_analyses (user_id, job_role, original_text, analysis, optimized_resume, gap_report) VALUES (?,?,?,?,?,?)')
          .run(req.user.id, jobRole, resumeText, JSON.stringify(analysis), analysis.optimizedResume || '', JSON.stringify(analysis.gaps || []));
      }

      res.json({ success: true, analysis });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/resume/history
  router.get('/api/resume/history', authMiddleware, (req, res) => {
    const analyses = db.prepare('SELECT id, job_role, created_at FROM resume_analyses WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ analyses });
  });

  return router;
};

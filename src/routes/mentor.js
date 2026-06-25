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
  router.post('/api/mentor/chat', authMiddleware, async (req, res) => {
    try {
      const { message, chatHistory } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });

      const assessment = await db.prepare('SELECT * FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);

      const userContext = {
        jobRole: assessment?.job_role || 'Not specified',
        experience: 'Entry level',
        assessmentScore: assessment?.score || null,
        skillGaps: assessment?.skill_gaps ? JSON.parse(assessment.skill_gaps) : [],
        strengths: assessment?.strengths ? JSON.parse(assessment.strengths) : [],
      };

      const response = await ai.mentorChat(message, userContext, chatHistory || []);

      await db.prepare('INSERT INTO mentor_chats (user_id, message, response, context) VALUES (?,?,?,?)')
        .run(req.user.id, message, response, JSON.stringify(userContext));

      res.json({ success: true, response });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/mentor/history', authMiddleware, async (req, res) => {
    const chats = await db.prepare('SELECT message, response, created_at FROM mentor_chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json({ chats });
  });

  return router;
};

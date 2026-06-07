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

module.exports = function(emailService) {
  // POST /api/assessment/generate — AI generates assessment questions
  router.post('/api/assessment/generate', authMiddleware, async (req, res) => {
    try {
      const { jobRole, careerPath, experienceLevel } = req.body;
      if (!jobRole) return res.status(400).json({ error: 'Job role required' });

      // Check free tier limits
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const assessmentCount = db.prepare('SELECT COUNT(*) as count FROM assessments WHERE user_id = ?').get(req.user.id);
      if (user.subscription === 'free' && assessmentCount.count >= config.freeTier.maxAssessments) {
        return res.status(403).json({ error: 'Free tier limit reached. Upgrade for unlimited assessments.', upgrade: true });
      }

      const assessment = await ai.generateAssessment(jobRole, careerPath || 'Technology', experienceLevel || 'Entry Level');

      // Store in DB
      const result = db.prepare('INSERT INTO assessments (user_id, job_role, career_path, questions) VALUES (?,?,?,?)')
        .run(req.user.id, jobRole, careerPath || '', JSON.stringify(assessment.questions));

      res.json({
        success: true,
        assessmentId: result.lastInsertRowid,
        jobRole,
        ...assessment,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/assessment/submit — submit answers and get analysis
  router.post('/api/assessment/submit', authMiddleware, async (req, res) => {
    try {
      const { assessmentId, answers, jobRole } = req.body;
      if (!assessmentId || !answers) return res.status(400).json({ error: 'Assessment ID and answers required' });

      const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(assessmentId, req.user.id);
      if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

      const questions = JSON.parse(assessment.questions);
      const result = await ai.analyzeResults(jobRole, questions, answers);

      // Generate diagnostic questions
      const diagnostics = await ai.generateDiagnosticQuestions(jobRole, result.skillGaps || [], result.score);

      // Update DB
      db.prepare('UPDATE assessments SET answers=?, score=?, skill_gaps=?, strengths=?, report=? WHERE id=?')
        .run(JSON.stringify(answers), result.score, JSON.stringify(result.skillGaps), JSON.stringify(result.strengths), JSON.stringify(result), assessmentId);

      res.json({
        success: true,
        analysis: result,
        diagnosticQuestions: diagnostics.questions,
        assessmentId,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/assessment/report — generate final report
  router.post('/api/assessment/report', authMiddleware, async (req, res) => {
    try {
      const { assessmentId, jobRole, diagnosticAnswers, userName } = req.body;

      const assessment = db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id = ?').get(assessmentId, req.user.id);
      if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

      const analysisData = JSON.parse(assessment.report || '{}');
      const report = await ai.generateReport(userName || req.user.name, jobRole, analysisData, diagnosticAnswers);

      // Store report
      db.prepare('UPDATE assessments SET report=? WHERE id=?').run(JSON.stringify(report), assessmentId);

      // Send email with report
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (emailService && emailService.transporter && report) {
        await emailService.transporter.sendMail({
          from: `"Skill Sprint" <${config.smtp.user}>`,
          to: user.email,
          subject: `Your Career Report for ${jobRole} — Skill Sprint`,
          html: buildReportEmail(userName || user.name, jobRole, report, assessment),
        });
      }

      res.json({ success: true, report, assessmentId });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/assessment/history
  router.get('/api/assessment/history', authMiddleware, (req, res) => {
    const assessments = db.prepare('SELECT id, job_role, score, created_at FROM assessments WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ assessments });
  });

  return router;
};

function buildReportEmail(name, jobRole, report, assessment) {
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial;">
    <div style="background:linear-gradient(135deg,#4361ee,#3f37c9);padding:30px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="color:#fff;margin:0;">🎯 Skill Sprint Career Report</h1></div>
    <div style="background:#fff;padding:30px;border:1px solid #dee2e6;">
      <h2>Hello ${name}!</h2>
      <p>Here's your comprehensive career analysis for <strong>${jobRole}</strong>.</p>
      <div style="background:#f0f4ff;padding:16px;border-radius:8px;margin:16px 0;">
        <h3>📊 Score: ${assessment.score || report?.score || 'N/A'}%</h3>
        <p><strong>Readiness:</strong> ${report?.readinessLevel || 'Being evaluated'}</p>
        <p><strong>Time to hire-ready:</strong> ${report?.timeToHire || 'Varies'}</p>
      </div>
      ${report?.executiveSummary ? `<p><strong>Summary:</strong> ${report.executiveSummary}</p>` : ''}
      <h3>🎯 Focus Areas</h3>
      <ul>${(report?.focusAreas || []).map(f => `<li>${typeof f === 'string' ? f : f.area}</li>`).join('')}</ul>
      <h3>📚 Recommended Courses</h3>
      <ul>${(report?.recommendedCourses || []).slice(0, 5).map(c => `<li><strong>${c.name}</strong> — ${c.platform} (${c.cost})</li>`).join('')}</ul>
      <p style="margin-top:20px;">Log in to see your full report with learning paths, certifications, and AI mentor guidance.</p>
    </div></div>`;
}

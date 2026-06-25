const axios = require('axios');
const config = require('../config');

class AICoach {
  constructor() {
    this.enabled = !!(config.ai.apiKey);
  }

  async _callAI(systemPrompt, userMessage, temperature = 0.3, maxTokens = 1000) {
    if (!this.enabled) {
      return this._fallback(userMessage);
    }
    try {
      const resp = await axios.post(config.ai.baseUrl + '/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }, {
        headers: { 'Authorization': 'Bearer ' + config.ai.apiKey, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      return resp.data.choices[0].message.content;
    } catch (e) {
      console.error('AI call failed:', e.message);
      return this._fallback(userMessage);
    }
  }

  _fallback(msg) {
    return `I'm currently operating in offline mode. Your question was: "${msg}". Here are some general tips: Focus on building practical projects, contribute to open source, and continuously learn new skills relevant to your target role.`;
  }

  /**
   * Generate assessment questions based on job role
   */
  async generateAssessment(jobRole, careerPath, experienceLevel) {
    const prompt = `You are a senior career coach and technical interviewer. Generate a comprehensive skills assessment for a candidate targeting the role of "${jobRole}" in the "${careerPath}" field with "${experienceLevel}" experience level.

Create exactly 10 multiple-choice questions that test real, practical knowledge needed for this role. Each question should have 4 options with one correct answer.

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct": 0,
      "skill": "Skill being tested",
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "skillsCovered": ["skill1", "skill2"],
  "estimatedTime": "10 minutes",
  "passingScore": 70
}`;

    const resp = await this._callAI(prompt,
      `Generate assessment for: Job Role = ${jobRole}, Career Path = ${careerPath}, Experience = ${experienceLevel}`,
      0.5, 2000);

    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return this._fallbackAssessment(jobRole);
    } catch (e) {
      return this._fallbackAssessment(jobRole);
    }
  }

  /**
   * Generate skill gap analysis from assessment results
   */
  async analyzeResults(jobRole, questions, answers) {
    const prompt = `You are an expert career coach. Analyze the following assessment results for a ${jobRole} candidate.

Questions and user's answers:
${questions.map((q, i) => `Q${i+1}: ${q.question}\nUser selected: ${q.options[answers[i]]}\nCorrect: ${q.options[q.correct]}\nSkill: ${q.skill}`).join('\n\n')}

Provide a detailed analysis in JSON format:
{
  "score": <number 0-100>,
  "skillGaps": [{"skill": "...", "level": "beginner|intermediate|advanced", "gap": "what they're missing"}],
  "strengths": [{"skill": "...", "description": "what they excel at"}],
  "summary": "2-3 sentence overall assessment",
  "focusAreas": ["priority 1", "priority 2", "priority 3"],
  "readinessLevel": "beginner|intermediate|advanced|job-ready",
  "recommendedRoles": ["role1", "role2"]
}`;

    const resp = await this._callAI(prompt, 'Analyze assessment results', 0.3, 1500);
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return { score: 50, skillGaps: [], strengths: [], summary: 'Analysis completed.', focusAreas: [], readinessLevel: 'intermediate' };
    } catch (e) {
      return { score: 50, skillGaps: [], strengths: [], summary: 'Analysis completed.', focusAreas: [], readinessLevel: 'intermediate' };
    }
  }

  /**
   * Generate follow-up diagnostic questions
   */
  async generateDiagnosticQuestions(jobRole, skillGaps, assessmentScore) {
    const prompt = `You are a career coach. Based on the candidate's assessment for ${jobRole} (score: ${assessmentScore}%), generate 5 personalized diagnostic questions to better understand their proficiency level and preparation.

Skill gaps identified: ${skillGaps.map(g => g.skill).join(', ')}

These questions should be open-ended and help understand:
1. Their practical coding/debugging experience (if technical role)
2. Their problem-solving approach
3. Their familiarity with industry tools
4. Their project experience
5. Their learning habits

Return JSON:
{
  "questions": [
    {"question": "...", "category": "experience|problem-solving|tools|projects|learning", "expectedAnswer": "brief hint of what to look for"}
  ]
}`;

    const resp = await this._callAI(prompt, `Generate diagnostic questions for ${jobRole}`, 0.5, 1500);
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return this._fallbackDiagnostic(jobRole);
    } catch (e) {
      return this._fallbackDiagnostic(jobRole);
    }
  }

  /**
   * Generate comprehensive career report
   */
  async generateReport(userName, jobRole, assessmentData, diagnosticAnswers) {
    const prompt = `You are a senior career coach. Generate a comprehensive career development report for ${userName}, targeting ${jobRole}.

Assessment Score: ${assessmentData.score}%
Strengths: ${JSON.stringify(assessmentData.strengths || [])}
Skill Gaps: ${JSON.stringify(assessmentData.skillGaps || [])}
Diagnostic Responses: ${JSON.stringify(diagnosticAnswers || [])}

Generate a detailed report in JSON:
{
  "executiveSummary": "2-3 sentence overview",
  "currentLevel": "beginner|intermediate|advanced|job-ready",
  "strengthsAnalysis": "detailed analysis of strengths",
  "gapAnalysis": "detailed analysis of gaps",
  "learningPath": ["step 1", "step 2", "step 3", "step 4", "step 5"],
  "focusAreas": [{"area": "...", "why": "...", "resources": ["resource1", "resource2"]}],
  "timeToHire": "estimated months to be job-ready",
  "salaryRange": "estimated entry salary range",
  "recommendedCourses": [{"name": "...", "platform": "...", "level": "...", "cost": "free|paid"}],
  "certifications": [{"name": "...", "issuer": "...", "value": "why it matters"}],
  "finalAdvice": "personalized closing advice"
}`;

    const resp = await this._callAI(prompt, 'Generate career report', 0.3, 2000);
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return null;
    } catch (e) { return null; }
  }

  /**
   * AI Mentor chat - context-aware responses
   */
  async mentorChat(message, userContext, chatHistory) {
    const prompt = `You are an expert AI career mentor for Skill Sprint. You are coaching a candidate with this profile:
- Target Role: ${userContext.jobRole || 'Not specified'}
- Experience: ${userContext.experience || 'Entry level'}
- Assessment Score: ${userContext.assessmentScore || 'Not assessed'}%
- Skill Gaps: ${JSON.stringify(userContext.skillGaps || [])}
- Strengths: ${JSON.stringify(userContext.strengths || [])}

Your responses should be:
1. Contextual - reference their specific profile
2. Actionable - give concrete advice
3. Encouraging - motivate them
4. Expert - show deep knowledge
5. Concise - under 200 words unless explaining concepts

Previous conversation:
${(chatHistory || []).slice(-6).map(h => `${h.role}: ${h.content}`).join('\n')}

User: ${message}

Respond as their personal career mentor.`;

    return await this._callAI(prompt, 'Mentor chat response', 0.5, 500);
  }

  /**
   * Resume analysis
   */
  async analyzeResume(resumeText, jobRole) {
    const prompt = `You are a professional resume analyst and career coach. Analyze this resume for a ${jobRole} position.

Resume:
"""
${resumeText}
"""

Provide analysis in JSON:
{
  "overallScore": <1-100>,
  "strengths": ["strength1", "strength2"],
  "gaps": [{"section": "...", "issue": "...", "suggestion": "..."}],
  "keywords": ["missing keyword1", "missing keyword2"],
  "formatIssues": ["issue1", "issue2"],
  "atsScore": <1-100>,
  "optimizedResume": "the improved version of the resume",
  "summary": "overall assessment"
}`;

    const resp = await this._callAI(prompt, 'Analyze resume', 0.3, 2000);
    try {
      const jsonMatch = resp.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return null;
    } catch (e) { return null; }
  }

  _fallbackAssessment(jobRole) {
    return {
      questions: [
        { question: `What is the most important skill for a ${jobRole}?`, options: ['A) Technical expertise', 'B) Communication', 'C) Problem-solving', 'D) All of the above'], correct: 3, skill: 'General', difficulty: 'beginner' },
        { question: `Which tool is commonly used in ${jobRole} roles?`, options: ['A) Git', 'B) Excel', 'C) Industry-specific tools', 'D) All tools have their place'], correct: 3, skill: 'Tools', difficulty: 'beginner' },
      ],
      skillsCovered: ['General Knowledge', 'Tools'],
      estimatedTime: '5 minutes',
      passingScore: 60,
    };
  }

  _fallbackDiagnostic(jobRole) {
    return {
      questions: [
        { question: `Describe your experience with key ${jobRole} tools and technologies.`, category: 'experience', expectedAnswer: 'Specific tools and years of experience' },
        { question: 'Walk me through a challenging problem you solved recently.', category: 'problem-solving', expectedAnswer: 'Structured problem-solving approach' },
        { question: 'How do you stay updated with industry trends?', category: 'learning', expectedAnswer: 'Active learning habits' },
      ],
    };
  }
}

module.exports = { AICoach };

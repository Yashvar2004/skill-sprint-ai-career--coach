const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const config = require('../config');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), config.jwtSecret);
    next();
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
}

// Curated free courses database
const COURSES = {
  'Software Developer': [
    { name: 'CS50: Introduction to Computer Science', platform: 'Harvard/edX', level: 'Beginner', cost: 'free', link: 'https://cs50.harvard.edu/', category: 'Programming' },
    { name: 'The Odin Project - Full Stack JavaScript', platform: 'The Odin Project', level: 'Intermediate', cost: 'free', link: 'https://www.theodinproject.com/', category: 'Web Development' },
    { name: 'FreeCodeCamp - Responsive Web Design', platform: 'FreeCodeCamp', level: 'Beginner', cost: 'free', link: 'https://www.freecodecamp.org/', category: 'Web Development' },
    { name: 'AWS Cloud Practitioner Essentials', platform: 'AWS', level: 'Beginner', cost: 'free', link: 'https://aws.amazon.com/training/', category: 'Cloud' },
    { name: 'Google IT Automation with Python', platform: 'Coursera', level: 'Intermediate', cost: 'free', link: 'https://www.coursera.org/', category: 'Automation' },
    { name: 'Meta Front-End Developer', platform: 'Coursera', level: 'Intermediate', cost: 'paid', link: 'https://www.coursera.org/', category: 'Web Development' },
    { name: 'IBM Full Stack Cloud Developer', platform: 'Coursera', level: 'Advanced', cost: 'paid', link: 'https://www.coursera.org/', category: 'Full Stack' },
  ],
  'Data Scientist': [
    { name: 'Machine Learning by Andrew Ng', platform: 'Coursera/Stanford', level: 'Beginner', cost: 'free', link: 'https://www.coursera.org/learn/machine-learning', category: 'ML' },
    { name: 'Python for Data Science', platform: 'FreeCodeCamp', level: 'Beginner', cost: 'free', link: 'https://www.freecodecamp.org/', category: 'Programming' },
    { name: 'Data Science MicroMasters', platform: 'edX', level: 'Advanced', cost: 'paid', link: 'https://www.edx.org/', category: 'Data Science' },
    { name: 'Google Data Analytics Certificate', platform: 'Coursera', level: 'Intermediate', cost: 'free', link: 'https://www.coursera.org/', category: 'Analytics' },
    { name: 'Deep Learning Specialization', platform: 'Coursera', level: 'Advanced', cost: 'paid', link: 'https://www.coursera.org/', category: 'Deep Learning' },
  ],
  'SAP Consultant': [
    { name: 'SAP Learning Hub - Discovery Edition', platform: 'SAP', level: 'Beginner', cost: 'free', link: 'https://learning.sap.com/', category: 'SAP' },
    { name: 'openSAP Courses', platform: 'openSAP', level: 'Beginner', cost: 'free', link: 'https://open.sap.com/', category: 'SAP' },
    { name: 'SAP S/4HANA Overview', platform: 'SAP', level: 'Intermediate', cost: 'free', link: 'https://learning.sap.com/', category: 'SAP' },
    { name: 'SAP Certified Application Associate', platform: 'SAP', level: 'Advanced', cost: 'paid', link: 'https://training.sap.com/', category: 'Certification' },
  ],
};

const ALL_CERTIFICATIONS = [
  { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon', level: 'Beginner', cost: 'paid', value: 'Cloud fundamentals' },
  { name: 'Google IT Support Professional', issuer: 'Google/Coursera', level: 'Beginner', cost: 'free', value: 'IT fundamentals' },
  { name: 'Microsoft Azure Fundamentals AZ-900', issuer: 'Microsoft', level: 'Beginner', cost: 'paid', value: 'Cloud basics' },
  { name: 'CompTIA Security+', issuer: 'CompTIA', level: 'Intermediate', cost: 'paid', value: 'Cybersecurity' },
  { name: 'Certified Scrum Master', issuer: 'Scrum Alliance', level: 'Intermediate', cost: 'paid', value: 'Agile methodology' },
  { name: 'SAP Certified Associate', issuer: 'SAP', level: 'Advanced', cost: 'paid', value: 'SAP expertise' },
  { name: 'Google Data Analytics Certificate', issuer: 'Google/Coursera', level: 'Beginner', cost: 'free', value: 'Data analysis' },
  { name: 'Meta Social Media Marketing', issuer: 'Meta/Coursera', level: 'Beginner', cost: 'free', value: 'Marketing' },
];

module.exports = function() {
  // GET /api/courses/:jobRole
  router.get('/api/courses/:jobRole', authMiddleware, (req, res) => {
    const { jobRole } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const isPaid = user.subscription === 'paid';

    let courses = COURSES[jobRole] || COURSES['Software Developer'];
    const freeCourses = courses.filter(c => c.cost === 'free');
    const paidCourses = courses.filter(c => c.cost === 'paid');

    res.json({
      freeCourses: freeCourses.slice(0, isPaid ? 10 : config.freeTier.maxCourses),
      paidCourses: isPaid ? paidCourses : paidCourses.slice(0, 2),
      totalAvailable: courses.length,
      freeLimit: isPaid ? 'unlimited' : config.freeTier.maxCourses,
      isPaid,
    });
  });

  // GET /api/certifications
  router.get('/api/certifications', authMiddleware, (req, res) => {
    res.json({ certifications: ALL_CERTIFICATIONS });
  });

  // GET /api/courses/search?q=keyword
  router.get('/api/courses/search', authMiddleware, (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    const allCourses = Object.values(COURSES).flat();
    const results = allCourses.filter(c => c.name.toLowerCase().includes(q) || c.platform.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    res.json({ results: results.slice(0, 10) });
  });

  return router;
};

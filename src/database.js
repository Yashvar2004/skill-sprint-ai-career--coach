const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

// Create tables
async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      organization TEXT DEFAULT '',
      verified INTEGER DEFAULT 0,
      verify_token TEXT,
      subscription TEXT DEFAULT 'free',
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      job_role TEXT NOT NULL,
      career_path TEXT,
      questions TEXT,
      answers TEXT,
      score INTEGER,
      skill_gaps TEXT,
      strengths TEXT,
      report TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mentor_chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      context TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS resume_analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      job_role TEXT,
      original_text TEXT,
      analysis TEXT,
      optimized_resume TEXT,
      gap_report TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      source TEXT DEFAULT 'website',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      course_name TEXT NOT NULL,
      issuer TEXT DEFAULT 'Skill Sprint',
      completed_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

// Initialize tables on module load
initDB().catch(e => console.error('DB init error:', e.message));

// Wrapper to match SQLite API
const db = {
  prepare(sqlStr) {
    return {
      get(...params) {
        return new Promise((resolve, reject) => {
          // Convert SQLite ? placeholders to $1, $2, etc.
          let idx = 0;
          const pgSql = sqlStr.replace(/\?/g, () => `$${++idx}`);
          sql.query(pgSql, params).then(rows => resolve(rows[0] || null)).catch(reject);
        });
      },
      all(...params) {
        return new Promise((resolve, reject) => {
          let idx = 0;
          const pgSql = sqlStr.replace(/\?/g, () => `$${++idx}`);
          sql.query(pgSql, params).then(rows => resolve(rows || [])).catch(reject);
        });
      },
      run(...params) {
        return new Promise((resolve, reject) => {
          let idx = 0;
          const pgSql = sqlStr.replace(/\?/g, () => `$${++idx}`);
          sql.query(pgSql, params).then(rows => resolve({ changes: rows.length })).catch(reject);
        });
      },
    };
  },
};

module.exports = db;

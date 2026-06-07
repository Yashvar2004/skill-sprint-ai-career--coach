const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL;
const BASE = isVercel ? '/tmp' : path.join(__dirname, '..');

const dirs = {
  data: BASE,
};

Object.values(dirs).forEach(dir => {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
});

module.exports = { dirs, isVercel };

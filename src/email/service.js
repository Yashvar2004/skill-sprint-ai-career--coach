const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
  constructor() {
    if (config.smtp.user && config.smtp.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: false,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
      console.log('Email: configured');
    } else {
      this.transporter = null;
      console.log('Email: not configured');
    }
  }
}

module.exports = { EmailService };

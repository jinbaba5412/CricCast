'use strict';
const nodemailer = require('nodemailer');
const log        = require('./logger');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendWelcome({ to, name, clubName, slug }) {
  if (!process.env.SMTP_HOST) {
    log.warn('MAILER', 'SMTP not configured — skipping welcome email', { to });
    return;
  }
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM,
      to,
      subject: `Welcome to CricCast — ${clubName} is live!`,
      text: [
        `Hi ${name},`,
        '',
        `Your club "${clubName}" is now registered on CricCast.`,
        '',
        `Dashboard: https://criccast.app/dashboard`,
        `Club URL:  https://criccast.app/t/${slug}/`,
        '',
        'Start by creating your first match from the dashboard.',
        '',
        '— The CricCast Team',
      ].join('\n'),
    });
    log.info('MAILER', 'Welcome email sent', { to, slug });
  } catch (err) {
    log.error('MAILER', 'Failed to send welcome email', { to, error: err.message });
  }
}

async function sendInvite({ to, clubName, inviteToken, role }) {
  if (!process.env.SMTP_HOST) {
    log.warn('MAILER', 'SMTP not configured — skipping invite email', { to });
    return;
  }
  const inviteUrl = `https://criccast.app/signup/invite?token=${inviteToken}`;
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM,
      to,
      subject: `You're invited to join ${clubName} on CricCast`,
      text: [
        `You have been invited to join "${clubName}" as a ${role} on CricCast.`,
        '',
        `Accept your invitation here: ${inviteUrl}`,
        '',
        'This link expires in 72 hours.',
        '',
        '— The CricCast Team',
      ].join('\n'),
    });
    log.info('MAILER', 'Invite email sent', { to, role });
  } catch (err) {
    log.error('MAILER', 'Failed to send invite email', { to, error: err.message });
  }
}

module.exports = { sendWelcome, sendInvite };

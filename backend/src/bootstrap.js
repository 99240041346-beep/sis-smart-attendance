require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { ensureSchema } = require('./db');
const { router: permissionRouter } = require('./permission-routes');

const SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || 'development-only-secret';
const originalListen = express.application.listen;

express.application.listen = function patchedListen(...args) {
  this.use('/api/permissions', (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      req.user = jwt.verify(header.startsWith('Bearer ') ? header.slice(7) : '', SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Authentication required' });
    }
  }, permissionRouter);
  return originalListen.apply(this, args);
};

(async () => {
  await ensureSchema();
  require('./server');
})().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});

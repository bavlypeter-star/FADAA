import express from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { statements } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

export const authRouter = express.Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = statements.findUserByUsername.get(username);

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  return res.json({ user: req.session.user });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

authRouter.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ user: req.session.user });
});

authRouter.post('/register', requireAdmin, (req, res) => {
  const { username, password, role } = req.body;

  if (!username || username.length > 60) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'user';

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = statements.insertUser.run(username, hash, normalizedRole);
    return res.status(201).json({ id: result.lastInsertRowid, username, role: normalizedRole });
  } catch (err) {
    return res.status(409).json({ error: 'Username already exists' });
  }
});

authRouter.post('/self-register', (req, res) => {
  if (!config.allowRegistration) {
    return res.status(403).json({ error: 'Self registration disabled' });
  }

  const { username, password } = req.body;
  if (!username || username.length > 60) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = statements.insertUser.run(username, hash, 'user');
    return res.status(201).json({ id: result.lastInsertRowid, username, role: 'user' });
  } catch {
    return res.status(409).json({ error: 'Username already exists' });
  }
});

import express from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { statements } from '../db.js';

export const usersRouter = express.Router();

usersRouter.get('/', requireAdmin, (req, res) => {
  const users = statements.listUsers.all();
  res.json({ users });
});

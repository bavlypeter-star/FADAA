import fs from 'fs';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { listDirectory, readText, resolveFile } from '../services/fileService.js';

const upload = multer({ dest: path.join(config.storageRoot, '.tmp') });

export const filesRouter = express.Router();

filesRouter.use(requireAuth);

filesRouter.get('/list', (req, res) => {
  try {
    const data = listDirectory(req.query.path || '');
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

filesRouter.get('/text', (req, res) => {
  try {
    const data = readText(req.query.path || '');
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

filesRouter.get('/raw', (req, res) => {
  try {
    const filePath = resolveFile(req.query.path || '');
    res.sendFile(filePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

filesRouter.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Missing file' });

  const targetRelPath = String(req.body.path || '').replace(/^\/+/, '');
  const targetAbsolute = path.resolve(config.storageRoot, `.${path.sep}${targetRelPath}`);
  if (!targetAbsolute.startsWith(config.storageRoot)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  fs.mkdirSync(targetAbsolute, { recursive: true });
  const finalPath = path.join(targetAbsolute, req.file.originalname);
  fs.renameSync(req.file.path, finalPath);
  return res.status(201).json({ ok: true });
});

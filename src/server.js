import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import helmet from 'helmet';
import morgan from 'morgan';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { tunnelsRouter } from './routes/tunnels.js';
import { filesRouter } from './routes/files.js';
import { startFtpServer } from './services/ftpService.js';
import { tunnelService } from './services/tunnelService.js';

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();

fs.mkdirSync(config.storageRoot, { recursive: true });

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.dirname(config.dbPath) }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/tunnels', tunnelsRouter);
app.use('/api/files', filesRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use(express.static(path.resolve('public')));
app.get('*', (_req, res) => {
  res.sendFile(path.resolve('public/index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
});

tunnelService.subscribe((event) => {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
});

server.listen(config.port, async () => {
  console.log(`Server running on http://localhost:${config.port}`);
  try {
    await startFtpServer();
    console.log(`FTP service running on ftp://0.0.0.0:${config.ftp.port}`);
  } catch (err) {
    console.error('Failed to start FTP server:', err.message);
  }
});

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tunnels (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK(protocol IN ('http', 'https', 'tcp', 'udp')),
  local_host TEXT NOT NULL,
  local_port INTEGER NOT NULL,
  public_url TEXT,
  mode TEXT NOT NULL CHECK(mode IN ('direct', 'fallback')),
  status TEXT NOT NULL CHECK(status IN ('starting', 'online', 'offline', 'error')),
  latency_ms INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
if (!userCount) {
  const hash = bcrypt.hashSync(config.defaultAdminPassword, 12);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(config.defaultAdminUsername, hash, 'admin');
}

export const statements = {
  insertUser: db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'),
  findUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUserById: db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?'),
  listUsers: db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'),
  insertTunnel: db.prepare(`
    INSERT INTO tunnels (id, owner_id, name, protocol, local_host, local_port, public_url, mode, status)
    VALUES (@id, @owner_id, @name, @protocol, @local_host, @local_port, @public_url, @mode, @status)
  `),
  updateTunnelStatus: db.prepare(`
    UPDATE tunnels
    SET status = @status,
        latency_ms = @latency_ms,
        last_error = @last_error,
        public_url = COALESCE(@public_url, public_url),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  deleteTunnel: db.prepare('DELETE FROM tunnels WHERE id = ?'),
  getTunnelById: db.prepare('SELECT * FROM tunnels WHERE id = ?'),
  listTunnelsForUser: db.prepare('SELECT * FROM tunnels WHERE owner_id = ? ORDER BY created_at DESC'),
  listTunnelsAll: db.prepare('SELECT t.*, u.username AS owner_username FROM tunnels t JOIN users u ON u.id = t.owner_id ORDER BY created_at DESC'),
  insertAuditLog: db.prepare('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)'),
};

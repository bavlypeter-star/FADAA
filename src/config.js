import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const root = process.cwd();

export const config = {
  port: Number(process.env.PORT || 8080),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  dbPath: path.resolve(root, process.env.DB_PATH || './data/app.db'),
  storageRoot: path.resolve(root, process.env.STORAGE_ROOT || './uploads'),
  ftp: {
    port: Number(process.env.FTP_PORT || 2121),
    pasvUrl: process.env.FTP_PASV_URL || '127.0.0.1',
    pasvMin: Number(process.env.FTP_PASV_MIN || 1025),
    pasvMax: Number(process.env.FTP_PASV_MAX || 1050),
  },
  tunnelFallbackBase: process.env.TUNNEL_FALLBACK_BASE || 'https://example-tunnel.invalid',
  allowRegistration: String(process.env.ALLOW_REGISTRATION || 'false').toLowerCase() === 'true',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin1234',
};

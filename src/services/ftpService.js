import FtpSrv from 'ftp-srv';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { statements } from '../db.js';
import { getUserRoot } from './fileService.js';

let ftpServer;

export async function startFtpServer() {
  ftpServer = new FtpSrv({
    url: `ftp://0.0.0.0:${config.ftp.port}`,
    pasv_url: config.ftp.pasvUrl,
    pasv_min: config.ftp.pasvMin,
    pasv_max: config.ftp.pasvMax,
    anonymous: false,
  });

  ftpServer.on('login', ({ username, password }, resolve, reject) => {
    const user = statements.findUserByUsername.get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reject(new Error('Invalid credentials'));
    }

    return resolve({ root: getUserRoot() });
  });

  await ftpServer.listen();
}

export async function stopFtpServer() {
  if (ftpServer) {
    await ftpServer.close();
  }
}

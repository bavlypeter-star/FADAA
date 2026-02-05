import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

fs.mkdirSync(config.storageRoot, { recursive: true });

const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const videoExt = new Set(['.mp4', '.webm', '.ogg', '.mov']);
const audioExt = new Set(['.mp3', '.wav', '.ogg', '.aac', '.flac']);
const textExt = new Set(['.txt', '.md', '.json', '.yaml', '.yml', '.log', '.csv']);

function resolveSafe(relativePath = '') {
  const candidate = path.resolve(config.storageRoot, `.${path.sep}${relativePath}`);
  if (!candidate.startsWith(config.storageRoot)) {
    throw new Error('Invalid path');
  }
  return candidate;
}

export function listDirectory(relativePath = '') {
  const absolute = resolveSafe(relativePath);
  const items = fs.readdirSync(absolute, { withFileTypes: true }).map((entry) => {
    const full = path.join(absolute, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    const stat = fs.statSync(full);

    let kind = 'other';
    if (entry.isDirectory()) kind = 'directory';
    else if (imageExt.has(ext)) kind = 'image';
    else if (videoExt.has(ext)) kind = 'video';
    else if (audioExt.has(ext)) kind = 'audio';
    else if (textExt.has(ext)) kind = 'text';

    return {
      name: entry.name,
      path: path.join(relativePath, entry.name).replace(/\\/g, '/'),
      isDirectory: entry.isDirectory(),
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      kind,
    };
  });

  return { currentPath: relativePath, items };
}

export function resolveFile(relativePath = '') {
  const absolute = resolveSafe(relativePath);
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) throw new Error('Not a file');
  return absolute;
}

export function readText(relativePath = '') {
  const absolute = resolveFile(relativePath);
  const ext = path.extname(absolute).toLowerCase();
  if (!textExt.has(ext)) throw new Error('Text preview not supported for this file type');

  const content = fs.readFileSync(absolute, 'utf8');
  return { content: content.slice(0, 512_000) };
}

export function getUserRoot() {
  return config.storageRoot;
}

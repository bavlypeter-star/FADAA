import net from 'net';
import dgram from 'dgram';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { statements } from '../db.js';

class TunnelService {
  constructor() {
    this.live = new Map();
    this.subscribers = new Set();
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  publish(event) {
    for (const fn of this.subscribers) fn(event);
  }

  async probe(protocol, host, port) {
    const started = Date.now();

    if (protocol === 'udp') {
      return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        const timeout = setTimeout(() => {
          socket.close();
          resolve({ reachable: false, latency: null, error: 'UDP probe timeout' });
        }, 1200);

        socket.send(Buffer.from('ping'), port, host, (err) => {
          clearTimeout(timeout);
          socket.close();
          if (err) {
            resolve({ reachable: false, latency: null, error: err.message });
          } else {
            resolve({ reachable: true, latency: Date.now() - started, error: null });
          }
        });
      });
    }

    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ reachable: false, latency: null, error: 'Connection timeout' });
      }, 1500);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ reachable: true, latency: Date.now() - started, error: null });
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ reachable: false, latency: null, error: err.message });
      });
    });
  }

  async createTunnel(ownerId, payload) {
    const id = nanoid(12);
    const { name, protocol, localHost, localPort } = payload;
    const probe = await this.probe(protocol, localHost, Number(localPort));

    const mode = probe.reachable ? 'direct' : 'fallback';
    const publicUrl = mode === 'direct'
      ? this.buildDirectPublicUrl(protocol, localPort)
      : `${config.tunnelFallbackBase.replace(/\/$/, '')}/${id}`;
    const status = probe.reachable ? 'online' : 'error';

    const tunnel = {
      id,
      owner_id: ownerId,
      name,
      protocol,
      local_host: localHost,
      local_port: Number(localPort),
      public_url: publicUrl,
      mode,
      status,
    };

    statements.insertTunnel.run(tunnel);

    const record = {
      ...tunnel,
      latency_ms: probe.latency,
      last_error: probe.error,
    };

    statements.updateTunnelStatus.run({
      id,
      status,
      latency_ms: probe.latency,
      last_error: probe.error,
      public_url: publicUrl,
    });

    this.live.set(id, record);
    this.publish({ type: 'tunnel_updated', tunnel: record });
    return record;
  }

  buildDirectPublicUrl(protocol, localPort) {
    const host = 'your-public-host.example';
    if (protocol === 'http' || protocol === 'https') {
      return `${protocol}://${host}:${localPort}`;
    }
    return `${protocol}://${host}:${localPort}`;
  }

  async refreshTunnelStatus(id) {
    const tunnel = statements.getTunnelById.get(id);
    if (!tunnel) return null;

    const probe = await this.probe(tunnel.protocol, tunnel.local_host, tunnel.local_port);
    const status = probe.reachable ? 'online' : 'offline';

    statements.updateTunnelStatus.run({
      id,
      status,
      latency_ms: probe.latency,
      last_error: probe.error,
      public_url: null,
    });

    const refreshed = { ...tunnel, status, latency_ms: probe.latency, last_error: probe.error };
    this.live.set(id, refreshed);
    this.publish({ type: 'tunnel_updated', tunnel: refreshed });
    return refreshed;
  }

  stopTunnel(id) {
    const found = statements.getTunnelById.get(id);
    if (!found) return false;

    statements.deleteTunnel.run(id);
    this.live.delete(id);
    this.publish({ type: 'tunnel_deleted', tunnelId: id });
    return true;
  }
}

export const tunnelService = new TunnelService();

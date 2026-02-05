import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { statements } from '../db.js';
import { validateTunnelInput } from '../utils/validate.js';
import { tunnelService } from '../services/tunnelService.js';

export const tunnelsRouter = express.Router();

tunnelsRouter.use(requireAuth);

tunnelsRouter.get('/', (req, res) => {
  const { user } = req.session;
  const tunnels = user.role === 'admin'
    ? statements.listTunnelsAll.all()
    : statements.listTunnelsForUser.all(user.id);

  res.json({ tunnels });
});

tunnelsRouter.post('/', async (req, res) => {
  const error = validateTunnelInput(req.body);
  if (error) return res.status(400).json({ error });

  const tunnel = await tunnelService.createTunnel(req.session.user.id, req.body);
  return res.status(201).json({ tunnel });
});

tunnelsRouter.post('/:id/refresh', async (req, res) => {
  const tunnel = statements.getTunnelById.get(req.params.id);
  if (!tunnel) return res.status(404).json({ error: 'Tunnel not found' });

  const user = req.session.user;
  if (user.role !== 'admin' && tunnel.owner_id !== user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  const refreshed = await tunnelService.refreshTunnelStatus(req.params.id);
  return res.json({ tunnel: refreshed });
});

tunnelsRouter.delete('/:id', (req, res) => {
  const tunnel = statements.getTunnelById.get(req.params.id);
  if (!tunnel) return res.status(404).json({ error: 'Tunnel not found' });

  const user = req.session.user;
  if (user.role !== 'admin' && tunnel.owner_id !== user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  tunnelService.stopTunnel(req.params.id);
  return res.json({ ok: true });
});

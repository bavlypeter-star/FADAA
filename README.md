# FADAA Self-Hosted Tunnel + NAS Control Panel

Production-oriented baseline for a browser-controlled self-hosted platform with:

- Port forwarding / tunnel management (with automatic fallback link mode).
- Real-time tunnel status updates.
- Auth + role-based access control.
- File browser + media viewer (image/video/audio/text).
- FTP server using the same user credentials.

## Stack

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`)
- **Realtime:** WebSocket (`ws`)
- **FTP:** `ftp-srv`
- **Frontend:** Vanilla HTML/CSS/JS (responsive)

## Project Structure

```text
.
├── public/
│   ├── css/styles.css          # Responsive UI styling
│   ├── js/app.js               # SPA-like client logic
│   └── index.html              # App shell with navbar/pages
├── src/
│   ├── middleware/auth.js      # AuthZ middleware
│   ├── routes/
│   │   ├── auth.js             # Login/logout/register APIs
│   │   ├── users.js            # Admin user listing
│   │   ├── tunnels.js          # Tunnel CRUD/status APIs
│   │   └── files.js            # File browser/raw/text/upload APIs
│   ├── services/
│   │   ├── tunnelService.js    # Probe, fallback, WS events
│   │   ├── fileService.js      # Safe file browsing/reading
│   │   └── ftpService.js       # FTP login using DB users
│   ├── utils/validate.js       # Input validation
│   ├── config.js               # Environment-driven config
│   ├── db.js                   # SQLite schema + prepared statements
│   └── server.js               # App bootstrap + websocket
├── uploads/                    # File storage root
├── data/                       # SQLite DB/session storage
└── .env.example
```

## Database Schema

Implemented in `src/db.js`:

- `users`
  - `id`, `username` (unique), `password_hash`, `role`, timestamps
- `tunnels`
  - Tunnel config + runtime status (`online/offline/error`, `latency_ms`, `last_error`), mode (`direct/fallback`)
- `audit_logs`
  - Room for security/event auditing

## Key Backend Logic

### Port forwarding/tunnel flow

1. User submits a tunnel request with protocol, host, and local port.
2. Service probes local endpoint:
   - TCP/HTTP/HTTPS via socket connect
   - UDP via datagram send probe
3. If probe succeeds: mark mode as `direct` and generate a direct public URL placeholder.
4. If probe fails: automatically switch to `fallback` mode and generate external tunnel URL based on `TUNNEL_FALLBACK_BASE`.
5. Emit real-time websocket event to connected dashboards.

### Safe file access

- All paths are resolved under `STORAGE_ROOT`.
- Any attempted traversal outside root is rejected.
- Raw streaming and text previews are gated behind auth.

### FTP integration

- FTP login handler validates credentials against the same `users` table (bcrypt hashes).
- File root points to `STORAGE_ROOT`.

## API Routes

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/register` (admin only)
- `POST /api/auth/self-register` (optional via env flag)

### Users

- `GET /api/users` (admin only)

### Tunnels

- `GET /api/tunnels`
- `POST /api/tunnels`
- `POST /api/tunnels/:id/refresh`
- `DELETE /api/tunnels/:id`

### Files/media

- `GET /api/files/list?path=`
- `GET /api/files/raw?path=`
- `GET /api/files/text?path=`
- `POST /api/files/upload`

### Health

- `GET /api/health`

## Frontend Layout

Navbar sections:

- Dashboard
- Port Forwarding
- File Browser
- Media Viewer
- User Settings

Responsive behavior:

- Flexible nav wrapping
- Card/grid layout for desktop and mobile

## Run

```bash
cp .env.example .env
npm install
npm start
```

Default admin user is seeded from env (`DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`).

## Production hardening checklist

- Put behind HTTPS reverse proxy.
- Set `secure` session cookies.
- Rotate secrets + enforce stronger password policy + MFA.
- Replace direct URL placeholder with real NAT or provider integrations.
- Add rate limiting + audit log writes for critical actions.
- Add antivirus and file extension policies for uploads.

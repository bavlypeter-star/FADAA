const state = {
  user: null,
  tunnels: [],
  files: [],
  currentPath: '',
  selectedMedia: null,
};

const pages = {
  dashboard: document.getElementById('page-dashboard'),
  ports: document.getElementById('page-ports'),
  files: document.getElementById('page-files'),
  media: document.getElementById('page-media'),
  settings: document.getElementById('page-settings'),
};

for (const btn of document.querySelectorAll('nav button[data-page]')) {
  btn.addEventListener('click', () => switchPage(btn.dataset.page));
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });

  if (result.error) {
    document.getElementById('login-error').textContent = result.error;
    return;
  }

  state.user = result.user;
  await bootApp();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.reload();
});

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  return body;
}

function switchPage(name) {
  Object.entries(pages).forEach(([key, page]) => page.classList.toggle('hidden', key !== name));
}

async function bootApp() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');

  connectWs();
  await Promise.all([renderDashboard(), renderPorts(), renderFiles(), renderSettings(), renderMedia()]);
}

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);
  ws.onmessage = async (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type?.startsWith('tunnel_')) {
      await renderPorts();
      await renderDashboard();
    }
  };
}

async function renderDashboard() {
  const tunnelResponse = await api('/api/tunnels');
  state.tunnels = tunnelResponse.tunnels || [];

  pages.dashboard.innerHTML = `
    <h2>Dashboard</h2>
    <div class="grid">
      <div class="card"><strong>User:</strong><br/>${state.user.username} (${state.user.role})</div>
      <div class="card"><strong>Active Tunnels:</strong><br/>${state.tunnels.length}</div>
      <div class="card"><strong>Online:</strong><br/>${state.tunnels.filter((t) => t.status === 'online').length}</div>
      <div class="card"><strong>Errors:</strong><br/>${state.tunnels.filter((t) => t.status === 'error').length}</div>
    </div>
  `;
}

async function renderPorts() {
  const tunnelResponse = await api('/api/tunnels');
  state.tunnels = tunnelResponse.tunnels || [];

  pages.ports.innerHTML = `
    <h2>Port Forwarding / Tunneling</h2>
    <form id="create-tunnel-form" class="grid">
      <input name="name" placeholder="Tunnel name" required />
      <select name="protocol">
        <option>http</option><option>https</option><option>tcp</option><option>udp</option>
      </select>
      <input name="localHost" placeholder="Local host (127.0.0.1)" value="127.0.0.1" required />
      <input name="localPort" type="number" placeholder="Local port" required />
      <button type="submit">Create Tunnel</button>
    </form>
    <table class="table">
      <thead><tr><th>Name</th><th>Protocol</th><th>Status</th><th>Latency</th><th>Public Link</th><th>Action</th></tr></thead>
      <tbody>
        ${state.tunnels.map((t) => `
          <tr>
            <td>${t.name}</td>
            <td>${t.protocol}</td>
            <td class="status-${t.status}">${t.status}</td>
            <td>${t.latency_ms ?? '-'}</td>
            <td>${t.public_url ? `<a href="${t.public_url}" target="_blank">${t.public_url}</a>` : '-'}</td>
            <td>
              <button data-refresh="${t.id}">Refresh</button>
              <button data-delete="${t.id}">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('create-tunnel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    await api('/api/tunnels', { method: 'POST', body: JSON.stringify(data) });
    await renderPorts();
    await renderDashboard();
  });

  pages.ports.querySelectorAll('[data-refresh]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/tunnels/${btn.dataset.refresh}/refresh`, { method: 'POST' });
      await renderPorts();
    });
  });

  pages.ports.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/tunnels/${btn.dataset.delete}`, { method: 'DELETE' });
      await renderPorts();
      await renderDashboard();
    });
  });
}

async function renderFiles() {
  const data = await api(`/api/files/list?path=${encodeURIComponent(state.currentPath)}`);
  state.files = data.items || [];

  pages.files.innerHTML = `
    <h2>File Browser</h2>
    <p>Current path: /${state.currentPath}</p>
    <button id="up-dir-btn">Up</button>
    <div class="grid">
      ${state.files.map((f) => `
        <button data-path="${f.path}" data-dir="${f.isDirectory}" data-kind="${f.kind}">
          ${f.isDirectory ? '📁' : '📄'} ${f.name}<br/>
          <small>${f.kind}</small>
        </button>
      `).join('')}
    </div>
    <form id="upload-form" enctype="multipart/form-data">
      <h3>Upload</h3>
      <input name="file" type="file" required />
      <button type="submit">Upload to current folder</button>
    </form>
  `;

  document.getElementById('up-dir-btn').addEventListener('click', async () => {
    if (!state.currentPath.includes('/')) {
      state.currentPath = '';
    } else {
      state.currentPath = state.currentPath.split('/').slice(0, -1).join('/');
    }
    await renderFiles();
  });

  pages.files.querySelectorAll('[data-path]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const path = btn.dataset.path;
      if (btn.dataset.dir === 'true') {
        state.currentPath = path;
        await renderFiles();
        return;
      }

      state.selectedMedia = { path, kind: btn.dataset.kind, name: path.split('/').pop() };
      await renderMedia();
      switchPage('media');
    });
  });

  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.set('path', state.currentPath);
    await fetch('/api/files/upload', { method: 'POST', body: formData });
    await renderFiles();
  });
}

async function renderMedia() {
  if (!state.selectedMedia) {
    pages.media.innerHTML = '<h2>Media Viewer</h2><p>Select a file from the File Browser.</p>';
    return;
  }

  const rawUrl = `/api/files/raw?path=${encodeURIComponent(state.selectedMedia.path)}`;
  let viewer = '<p>Preview not available for this file type.</p>';

  if (state.selectedMedia.kind === 'image') {
    viewer = `<img alt="${state.selectedMedia.name}" src="${rawUrl}"/>`;
  } else if (state.selectedMedia.kind === 'video') {
    viewer = `<video controls src="${rawUrl}"></video>`;
  } else if (state.selectedMedia.kind === 'audio') {
    viewer = `<audio controls src="${rawUrl}"></audio>`;
  } else if (state.selectedMedia.kind === 'text') {
    const text = await api(`/api/files/text?path=${encodeURIComponent(state.selectedMedia.path)}`);
    viewer = `<pre>${escapeHtml(text.content || '')}</pre>`;
  }

  pages.media.innerHTML = `
    <h2>Media Viewer</h2>
    <div class="media-box card">
      <h3>${state.selectedMedia.name}</h3>
      ${viewer}
    </div>
  `;
}

async function renderSettings() {
  const usersResp = state.user.role === 'admin' ? await api('/api/users') : { users: [] };

  pages.settings.innerHTML = `
    <h2>User Settings</h2>
    <p>Username: ${state.user.username}</p>
    <p>Role: ${state.user.role}</p>
    ${state.user.role === 'admin' ? `
      <h3>Create User</h3>
      <form id="create-user-form" class="grid">
        <input name="username" placeholder="username" required />
        <input name="password" type="password" placeholder="password (min 8)" required />
        <select name="role"><option value="user">user</option><option value="admin">admin</option></select>
        <button type="submit">Create</button>
      </form>
      <h3>Existing Users</h3>
      <ul>${(usersResp.users || []).map((u) => `<li>${u.username} (${u.role})</li>`).join('')}</ul>
      <p><strong>FTP:</strong> same username/password as panel login.</p>
    ` : '<p>Only admins can manage users.</p>'}
  `;

  const createForm = document.getElementById('create-user-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
      await renderSettings();
    });
  }
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

(async () => {
  const me = await api('/api/auth/me');
  if (me?.user) {
    state.user = me.user;
    await bootApp();
  }
})();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const USERS_FILE = path.join(DATA_DIR, 'registered_users.json');
const BACKUP_FILE = path.join(__dirname, 'database_backup.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(CLIENTS_FILE)) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify([], null, 4), 'utf-8');
}

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 4), 'utf-8');
}

function loadRegisteredUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveRegisteredUsersToDisk(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 4), 'utf-8');
}

function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const usersDb = {
  '14298116': { pass: '14298116Je*', name: 'Jhon Espinosa', role: 'admin' },
  '1106227253': { pass: '7253pipe', name: 'Felipe Molina', role: 'admin' },
  '1005703432': { pass: '3432sergio', name: 'Sergio Suarez', role: 'admin' },
  '1104942399': { pass: '2399caleb', name: 'Caleb Perez', role: 'admin' },
  'jhon@spesfidem.com': { pass: 'Ventas2026!', name: 'Jhon Espinosa', role: 'admin' },
  'felipe@spesfidem.com': { pass: 'Felipe2026!', name: 'Felipe Molina', role: 'admin' },
  'ventas@spesfidem.com': { pass: 'Ventas2026!', name: 'Ventas Spesfidem', role: 'vendedor' },
  'sergio@spesfidem.com': { pass: 'Sergio2026!', name: 'Sergio Suarez', role: 'vendedor' },
  'caleb@spesfidem.com': { pass: 'CalebPerez2026!', name: 'Caleb Perez', role: 'vendedor' }
};

function sendCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function loadClients() {
  try {
    const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveClientsToDisk(clients) {
  const newContent = JSON.stringify(clients, null, 4);
  try {
    if (fs.existsSync(CLIENTS_FILE)) {
      const existing = fs.readFileSync(CLIENTS_FILE, 'utf-8');
      if (existing === newContent) return; // Prevent triggering Live Server reload if content is identical
    }
  } catch (e) {}

  fs.writeFileSync(CLIENTS_FILE, newContent, 'utf-8');
  try {
    fs.writeFileSync(BACKUP_FILE, newContent, 'utf-8');
  } catch (err) {
    console.error('Error al guardar respaldo:', err);
  }
}

function upsertClient(newClient) {
  const clients = loadClients();
  const index = clients.findIndex(c => String(c.id) === String(newClient.id));

  if (index !== -1) {
    if ('deleted' in newClient) {
      clients[index].deleted = newClient.deleted;
    } else if ('deleted' in clients[index]) {
      newClient.deleted = clients[index].deleted;
    }

    Object.assign(clients[index], newClient);

    if (!clients[index].serial) {
      const maxSerial = clients.reduce((max, c) => Math.max(max, c.serial || 0), 0);
      clients[index].serial = maxSerial + 1;
    }
  } else {
    if (!newClient.serial) {
      const maxSerial = clients.reduce((max, c) => Math.max(max, c.serial || 0), 0);
      newClient.serial = maxSerial + 1;
    }
    clients.push(newClient);
  }

  saveClientsToDisk(clients);
}

function deleteClient(clientId) {
  const clients = loadClients();
  const client = clients.find(c => String(c.id) === String(clientId));
  if (client) {
    client.deleted = true;
    saveClientsToDisk(clients);
  }
}

function emptyTrash() {
  let clients = loadClients();
  clients = clients.filter(c => !c.deleted);
  saveClientsToDisk(clients);
}

function hardDeleteClient(clientId) {
  let clients = loadClients();
  clients = clients.filter(c => String(c.id) !== String(clientId));
  saveClientsToDisk(clients);
}


const server = http.createServer((req, res) => {
  sendCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathOnly = parsedUrl.pathname;

  // GET API routes
  if (req.method === 'GET') {
    if (pathOnly === '/api/clients') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
      res.end(JSON.stringify(loadClients()));
      return;
    }
    if (pathOnly === '/api/registered-users') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
      const users = loadRegisteredUsers().map(u => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        idCard: u.idCard || '',
        cellphone: u.cellphone || '',
        city: u.city || '',
        registrationDate: u.registrationDate || u.date || '',
        status: u.status || 'Activo',
        role: u.role || 'user'
      }));
      res.end(JSON.stringify(users));
      return;
    }
    if (pathOnly === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Servidor Spesfidem Activo' }));
      return;
    }

    // Static file serving
    let safePath = path.normalize(decodeURIComponent(pathOnly)).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }

    const filePath = path.join(__dirname, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 - Archivo no encontrado');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
    return;
  }

  // POST API routes
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      let data = {};
      try {
        if (body) data = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'JSON inválido' }));
        return;
      }

      if (pathOnly === '/api/register') {
        const { fullName, email, password, confirmPassword, idCard, cellphone, city, address } = data;

        if (!fullName || !fullName.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'El nombre completo es obligatorio.' }));
          return;
        }
        if (!email || !email.includes('@') || !email.includes('.')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Ingrese un correo electrónico válido.' }));
          return;
        }
        if (!password || password.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' }));
          return;
        }
        if (password !== confirmPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Las contraseñas no coinciden.' }));
          return;
        }

        const users = loadRegisteredUsers();
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = users.find(u => (u.email && u.email.toLowerCase() === normalizedEmail) || (idCard && u.idCard && u.idCard === idCard.trim()));

        if (existingUser) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'El correo electrónico o documento ya se encuentra registrado.' }));
          return;
        }

        const { hash, salt } = hashPassword(password);
        const newUser = {
          id: 'usr_' + Date.now(),
          fullName: fullName.trim(),
          email: normalizedEmail,
          idCard: idCard ? idCard.trim() : '',
          cellphone: cellphone ? cellphone.trim() : '',
          city: city ? city.trim() : 'Ibagué',
          address: address ? address.trim() : '',
          passwordHash: hash,
          salt: salt,
          registrationDate: new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          status: 'Activo',
          role: 'user'
        };

        users.push(newUser);
        saveRegisteredUsersToDisk(users);

        // Sync client record into clients.json
        upsertClient({
          id: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
          idCard: newUser.idCard,
          cellphone: newUser.cellphone,
          city: newUser.city,
          address: newUser.address,
          status: 'Cliente Registrado'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: '¡Registro Élite exitoso! Por favor inicia sesión.',
          user: { id: newUser.id, fullName: newUser.fullName, email: newUser.email, role: newUser.role }
        }));
        return;
      }

      if (pathOnly === '/api/user-login') {
        const { email, password } = data;
        const inputKey = (email || '').trim().toLowerCase();

        // 1. Check registered users DB (hashed)
        const users = loadRegisteredUsers();
        const user = users.find(u => (u.email && u.email.toLowerCase() === inputKey) || (u.idCard && u.idCard === inputKey));

        if (user) {
          const { hash } = hashPassword(password, user.salt);
          if (hash === user.passwordHash) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              user: { id: user.id, name: user.fullName, fullName: user.fullName, email: user.email, role: user.role || 'user' }
            }));
            return;
          }
        }

        // 2. Check admin users Db
        const adminKey = Object.keys(usersDb).find(k => k.toLowerCase() === inputKey);
        if (adminKey && usersDb[adminKey].pass === password) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            user: { id: adminKey, name: usersDb[adminKey].name, fullName: usersDb[adminKey].name, email: adminKey, role: usersDb[adminKey].role }
          }));
          return;
        }

        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Correo/Usuario o contraseña incorrectos.' }));
        return;
      }

      if (pathOnly === '/api/clients') {
        upsertClient(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Cliente guardado correctamente.' }));
        return;
      }

      if (pathOnly === '/api/login') {
        const { username, password } = data;
        const inputKey = (username || '').trim().toLowerCase();

        // Check registered users DB first
        const users = loadRegisteredUsers();
        const foundUser = users.find(u => (u.email && u.email.toLowerCase() === inputKey) || (u.idCard && u.idCard === inputKey));
        if (foundUser) {
          const { hash } = hashPassword(password, foundUser.salt);
          if (hash === foundUser.passwordHash) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              token: 'USER_AUTH_SUCCESS',
              name: foundUser.fullName,
              role: foundUser.role || 'user'
            }));
            return;
          }
        }

        if (usersDb[username] || usersDb[inputKey]) {
          const userRec = usersDb[username] || usersDb[inputKey];
          if (userRec.pass === password) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              token: 'BASIC_AUTH_SUCCESS',
              name: userRec.name,
              role: userRec.role
            }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Contraseña incorrecta' }));
          }
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Usuario no registrado' }));
        }
        return;
      }

      if (pathOnly === '/api/logout') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Set-Cookie': 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly'
        });
        res.end(JSON.stringify({ success: true, message: 'Sesión cerrada correctamente en servidor.' }));
        return;
      }

      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Método no permitido' }));
    });
    return;
  }

  // DELETE API routes
  if (req.method === 'DELETE') {
    if (pathOnly.replace(/\/$/, '') === '/api/clients/trash') {
      emptyTrash();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Papelera vaciada permanentemente.' }));
      return;
    }

    if (pathOnly.startsWith('/api/clients/')) {
      const parts = pathOnly.split('/');
      const clientId = parts[parts.length - 1];
      const isPermanent = parsedUrl.query.permanent === 'true';

      if (isPermanent) {
        hardDeleteClient(clientId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Cliente eliminado permanentemente.' }));
      } else {
        deleteClient(clientId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Cliente movido a la papelera.' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Endpoint no encontrado' }));
    return;
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==========================================`);
  console.log(`  SISTEMA ADMINISTRATIVO Y WEB SPESFIDEM`);
  console.log(`==========================================`);
  console.log(` Servidor activo en http://localhost:${PORT}`);
  console.log(` Panel admin:     http://localhost:${PORT}/admin.html`);
  console.log(` CRM:             http://localhost:${PORT}/crm.html`);
  console.log(`==========================================\n`);
});

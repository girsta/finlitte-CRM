const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security Middleware ---
app.set('trust proxy', 1); // Trust Nginx proxy

// Content Security Policy adjustment for CDN-based frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://aistudiocdn.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://n8n.girsta.com"] // Allow webhook
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Adjust for production
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased slightly for usability
  message: "Too many login attempts, please try again after 15 minutes"
});

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using https
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// --- Middleware ---
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function hasRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.role) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

// --- Helpers ---
function logHistory(contractId, userId, username, action, details) {
  const sql = `INSERT INTO history (contract_id, user_id, username, timestamp, action, details) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [contractId, userId, username, new Date().toISOString(), action, details], (err) => {
    if (err) console.error("Error logging history:", err);
  });
}

// --- Routes ---

// Login
app.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Internal Server Error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    try {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role || 'viewer';

        res.json({
          message: 'Login successful',
          user: {
            username: user.username,
            role: req.session.role,
            isAdmin: user.role === 'admin',
            full_name: user.full_name,
            phone: user.phone,
            email: user.email
          }
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (e) {
      res.status(500).json({ error: 'Auth error' });
    }
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Could not log out' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Get Active Contracts
app.get('/api/contracts', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM contracts WHERE is_archived = 0 ORDER BY galiojaIki ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const contracts = rows.map(row => ({
      ...row,
      notes: row.notes ? JSON.parse(row.notes) : [],
      is_archived: !!row.is_archived
    }));

    res.json(contracts);
  });
});

// Get Archived Contracts
app.get('/api/contracts/archived', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM contracts WHERE is_archived = 1 ORDER BY atnaujinimoData DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const contracts = rows.map(row => ({
      ...row,
      notes: row.notes ? JSON.parse(row.notes) : [],
      is_archived: !!row.is_archived
    }));

    res.json(contracts);
  });
});

// Get Contract History
app.get('/api/contracts/:id/history', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM history WHERE contract_id = ? ORDER BY timestamp DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create/Update Contract
app.post('/api/contracts', isAuthenticated, hasRole(['admin', 'sales']), (req, res) => {
  const c = req.body;
  const username = req.session.username || 'admin';
  const userId = req.session.userId || 0;

  if (!c.draudejas || !c.policyNo || !c.galiojaIki) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const notesStr = JSON.stringify(c.notes || []);

  if (c.id) {
    db.get('SELECT * FROM contracts WHERE id = ?', [c.id], (err, oldContract) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!oldContract) return res.status(404).json({ error: 'Contract not found' });

      const changes = [];
      const fieldsToCheck = [
        { key: 'draudejas', label: 'Client' },
        { key: 'pardavejas', label: 'Salesperson' },
        { key: 'ldGrupe', label: 'Type' },
        { key: 'policyNo', label: 'Policy No' },
        { key: 'galiojaNuo', label: 'Valid From' },
        { key: 'galiojaIki', label: 'Valid Until' },
        { key: 'valstybinisNr', label: 'Reg No' },
        { key: 'metineIsmoka', label: 'Yearly Price' },
        { key: 'ismoka', label: 'Payout' }
      ];

      fieldsToCheck.forEach(field => {
        if (String(oldContract[field.key]) !== String(c[field.key])) {
          changes.push(`${field.label}: ${oldContract[field.key]} -> ${c[field.key]}`);
        }
      });

      if (oldContract.notes !== notesStr) {
        const oldNotes = JSON.parse(oldContract.notes || '[]');
        const newNotes = c.notes || [];
        if (newNotes.length > oldNotes.length) changes.push(`Added note: "${newNotes[newNotes.length - 1]}"`);
        else if (newNotes.length < oldNotes.length) changes.push(`Removed note`);
        else changes.push('Notes updated');
      }

      const sql = `UPDATE contracts SET 
        draudejas = ?, pardavejas = ?, ldGrupe = ?, policyNo = ?, 
        galiojaNuo = ?, galiojaIki = ?, valstybinisNr = ?, 
        metineIsmoka = ?, ismoka = ?, notes = ?, atnaujinimoData = ?
        WHERE id = ?`;

      const params = [
        c.draudejas, c.pardavejas, c.ldGrupe, c.policyNo,
        c.galiojaNuo, c.galiojaIki, c.valstybinisNr,
        c.metineIsmoka, c.ismoka, notesStr, new Date().toISOString(),
        c.id
      ];

      db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (changes.length > 0) logHistory(c.id, userId, username, 'UPDATED', changes.join('; '));
        res.json({ message: 'Updated', id: c.id });
      });
    });

  } else {
    // Check for duplicates before creating
    db.get('SELECT id FROM contracts WHERE policyNo = ? AND valstybinisNr = ?', [c.policyNo, c.valstybinisNr], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) {
        return res.status(409).json({ error: 'Sutartis su tokiu poliso numeriu ir objektu jau egzistuoja.' });
      }

      const sql = `INSERT INTO contracts (
        draudejas, pardavejas, ldGrupe, policyNo, 
        galiojaNuo, galiojaIki, valstybinisNr, 
        metineIsmoka, ismoka, notes, atnaujinimoData, is_archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`;

      const params = [
        c.draudejas, c.pardavejas, c.ldGrupe, c.policyNo,
        c.galiojaNuo, c.galiojaIki, c.valstybinisNr,
        c.metineIsmoka, c.ismoka, notesStr, new Date().toISOString()
      ];

      db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logHistory(this.lastID, userId, username, 'CREATED', 'Contract created');
        res.json({ message: 'Created', id: this.lastID });
      });
    });
  }
});


// Toggle Archive Status
app.post('/api/contracts/:id/archive', isAuthenticated, hasRole(['admin', 'sales']), (req, res) => {
  const id = req.params.id;
  const username = req.session.username || 'admin';
  const userId = req.session.userId || 0;

  db.get('SELECT is_archived FROM contracts WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Contract not found' });

    const newStatus = row.is_archived === 1 ? 0 : 1;
    const action = newStatus === 1 ? 'ARCHIVED' : 'RESTORED';

    db.run('UPDATE contracts SET is_archived = ?, atnaujinimoData = ? WHERE id = ?',
      [newStatus, new Date().toISOString(), id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logHistory(id, userId, username, action, `Contract ${action.toLowerCase()}`);
        res.json({ message: action, is_archived: !!newStatus });
      }
    );
  });
});

// Delete Contract
app.delete('/api/contracts/:id', isAuthenticated, hasRole(['admin']), (req, res) => {
  const id = req.params.id;
  const username = req.session.username || 'admin';
  const userId = req.session.userId || 0;

  db.run('DELETE FROM contracts WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logHistory(id, userId, username, 'DELETED', 'Contract permanently deleted');
    res.json({ message: 'Deleted' });
  });
});

// --- User Management API ---
app.get('/api/users', isAuthenticated, (req, res) => {
  db.all('SELECT id, username, role, full_name, phone, email FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', isAuthenticated, hasRole(['admin']), async (req, res) => {
  const { username, password, role, full_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)", [username, hash, role || 'viewer', full_name || null], function (err) {
      if (err) return res.status(400).json({ error: 'Username likely exists' });
      res.json({ message: 'User created' });
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update User
app.put('/api/users/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
  const userId = req.params.id;
  const { username, password, role, full_name } = req.body;

  if (!username || !role) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Check for username collision with other users
    db.get("SELECT id FROM users WHERE username = ? AND id != ?", [username, userId], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(400).json({ error: 'Username taken by another user' });

      if (password && password.trim() !== "") {
        // Update with new password
        const hash = await bcrypt.hash(password, 10);
        db.run("UPDATE users SET username = ?, password = ?, role = ?, full_name = ? WHERE id = ?", [username, hash, role, full_name, userId], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'User updated' });
        });
      } else {
        // Update without changing password
        db.run("UPDATE users SET username = ?, role = ?, full_name = ? WHERE id = ?", [username, role, full_name, userId], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'User updated' });
        });
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', isAuthenticated, hasRole(['admin']), (req, res) => {
  if (req.params.id == req.session.userId) return res.status(400).json({ error: "Cannot delete yourself" });
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User deleted' });
  });
});

// --- User Profile API (Self-Service) ---
app.get('/api/profile', isAuthenticated, (req, res) => {
  const userId = req.session.userId;
  db.get('SELECT id, username, role, full_name, phone, email FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

app.put('/api/profile', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const { full_name, phone, email, password } = req.body;

  // Username cannot be changed here, only by admin in /api/users/:id

  try {
    if (password && password.trim() !== "") {
      const hash = await bcrypt.hash(password, 10);
      db.run("UPDATE users SET full_name = ?, phone = ?, email = ?, password = ? WHERE id = ?",
        [full_name, phone, email, hash, userId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Profile updated' });
        }
      );
    } else {
      db.run("UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?",
        [full_name, phone, email, userId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Profile updated' });
        }
      );
    }
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Task Management API ---
app.get('/api/tasks', isAuthenticated, (req, res) => {
  const role = req.session.role;
  const username = req.session.username;

  // 1. Auto-delete old completed tasks (older than 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cleanupDate = sevenDaysAgo.toISOString();

  db.run("DELETE FROM tasks WHERE status = 'completed' AND completed_at < ?", [cleanupDate], (err) => {
    if (err) console.error("Error cleaning up old tasks:", err);

    // 2. Fetch remaining tasks
    let sql = `SELECT * FROM tasks ORDER BY 
               CASE WHEN status = 'completed' THEN 1 ELSE 0 END, 
               due_date ASC`;
    let params = [];

    if (role !== 'admin') {
      sql = `SELECT * FROM tasks WHERE assigned_to = ? ORDER BY 
             CASE WHEN status = 'completed' THEN 1 ELSE 0 END, 
             due_date ASC`;
      params = [username];
    }

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const tasks = rows.map(row => ({
        ...row,
        comments: row.comments ? JSON.parse(row.comments) : []
      }));

      res.json(tasks);
    });
  });
});

app.post('/api/tasks', isAuthenticated, hasRole(['admin']), (req, res) => {
  const { title, description, assigned_to, due_date } = req.body;
  const created_by = req.session.username || 'admin';

  db.run(
    "INSERT INTO tasks (title, description, assigned_to, created_by, due_date, created_at, comments) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, description, assigned_to, created_by, due_date, new Date().toISOString(), '[]'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Task created', id: this.lastID });
    }
  );
});

app.put('/api/tasks/:id', isAuthenticated, hasRole(['admin']), (req, res) => {
  const { title, description, assigned_to, due_date } = req.body;

  db.run(
    "UPDATE tasks SET title = ?, description = ?, assigned_to = ?, due_date = ? WHERE id = ?",
    [title, description, assigned_to, due_date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Task updated' });
    }
  );
});

app.patch('/api/tasks/:id/status', isAuthenticated, (req, res) => {
  const { status } = req.body;
  const completedAt = status === 'completed' ? new Date().toISOString() : null;

  db.run("UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?", [status, completedAt, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Status updated' });
  });
});

app.post('/api/tasks/:id/comments', isAuthenticated, (req, res) => {
  const { text } = req.body;
  const username = req.session.username;
  const taskId = req.params.id;

  if (!text) return res.status(400).json({ error: 'Comment text required' });

  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Check permissions: Admin or Assigned User
    if (req.session.role !== 'admin' && task.assigned_to !== username) {
      return res.status(403).json({ error: 'Not authorized to comment on this task' });
    }

    // Fetch user to get full name
    db.get('SELECT full_name FROM users WHERE id = ?', [req.session.userId], (err, user) => {
      const authorName = (user && user.full_name) ? user.full_name : username;

      const comments = task.comments ? JSON.parse(task.comments) : [];
      const newComment = {
        id: Date.now(),
        text,
        author: authorName,
        timestamp: new Date().toISOString()
      };

      // ... rest of logic
      comments.push(newComment);
      db.run('UPDATE tasks SET comments = ? WHERE id = ?', [JSON.stringify(comments), taskId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Comment added', comment: newComment });
      });
    });
  });
});


app.delete('/api/tasks/:id', isAuthenticated, hasRole(['admin']), (req, res) => {
  db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Task deleted' });
  });
});

// --- Webhook for n8n ---
// --- Webhook for n8n ---
app.post('/api/webhook/n8n', async (req, res) => {
  const data = req.body;
  console.log("Received n8n webhook data:", JSON.stringify(data).substring(0, 200) + "...");

  // Ensure data is an array
  const contracts = Array.isArray(data) ? data : [data];

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  // Helper to convert Excel serial date to ISO string (YYYY-MM-DD)
  // Also handles standard date strings if passed instead of serials
  const parseDate = (input) => {
    if (!input) return new Date().toISOString().split('T')[0];

    // If it's a number (Excel Serial)
    const serial = Number(input);
    if (!isNaN(serial) && serial > 20000) { // check > 20000 to avoid confusing small numbers with dates (Excel 30000 is ~1982)
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }

    // Try parsing as standard date string
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0]; // Fallback
  };

  // Helper to get value from object case-insensitively
  const getValue = (obj, key) => {
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    return foundKey ? obj[foundKey] : undefined;
  };

  for (const item of contracts) {
    try {
      // --- NEW MAPPING CODE START ---

      // 1. Try to find Policy Number using multiple common Lithuanian variations
      const policyNo = getValue(item, 'Poliso Nr.') ||
        getValue(item, 'Poliso Nr') ||
        getValue(item, 'POLISO_NR') ||
        getValue(item, 'policyNo');

      if (!policyNo) {
        // Skip empty rows
        continue;
      }

      const contract = {
        // Look for "Draudėjo pavadinimas" OR "Klientas" OR "draudejas"
        draudejas: getValue(item, 'Draudėjo pavadinimas') || getValue(item, 'KLIENTAS') || getValue(item, 'draudejas') || 'Unknown',

        // Look for "Kuratorius" OR "Brokeris" OR "Pardavejas"
        pardavejas: getValue(item, 'Kuratorius') || getValue(item, 'BROKERIS') || getValue(item, 'pardavejas') || '',

        // Look for "Draudimo rūšis" OR "Draudimo produktas"
        ldGrupe: (getValue(item, 'Draudimo rūšis') || getValue(item, 'Draudimo produktas') || getValue(item, 'DRAUDIMO_PRODUKTAS') || getValue(item, 'ldGrupe') || '').trim(),

        policyNo: String(policyNo).trim(),

        // Look for "Galioja nuo"
        galiojaNuo: parseDate(getValue(item, 'Galioja nuo') || getValue(item, 'POLISO_PRADZIA') || getValue(item, 'galiojaNuo')),

        // Look for "Galioja iki"
        galiojaIki: parseDate(getValue(item, 'Galioja iki') || getValue(item, 'POLISO_PABAIGA') || getValue(item, 'galiojaIki')),

        // Look for "Valstybinis Nr."
        valstybinisNr: (getValue(item, 'Valstybinis Nr.') || getValue(item, 'Valstybinis Nr') || getValue(item, 'VALSTYBINIS_NR') || getValue(item, 'valstybinisNr') || '').trim(),

        // Look for "Metinė įmoka" or "Pasirašyta įmoka"
        metineIsmoka: Number(getValue(item, 'Metinė įmoka') || getValue(item, 'Pasirašyta įmoka') || getValue(item, 'METINE_IMOKA') || getValue(item, 'metineIsmoka')) || 0,

        // Look for "Draudimo suma"
        ismoka: Number(getValue(item, 'Draudimo suma') || getValue(item, 'ISMOKA') || getValue(item, 'ismoka')) || 0,

        // Look for specific typo from your logs "Atnaujini-mo data"
        atnaujinimoData: parseDate(getValue(item, 'Atnaujini-mo data') || getValue(item, 'Atnaujinimo data') || getValue(item, 'ATNAUJINIMO_DATA')),

        is_archived: 0
      };
      // --- NEW MAPPING CODE END ---

      // Check if contract with this policyNo AND valstybinisNr already exists
      const existing = await new Promise((resolve, reject) => {
        db.get('SELECT id, notes FROM contracts WHERE policyNo = ? AND valstybinisNr = ?',
          [contract.policyNo, contract.valstybinisNr],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existing) {
        // Update existing contract
        await new Promise((resolve, reject) => {
          const sql = `UPDATE contracts SET 
            draudejas = ?, pardavejas = ?, ldGrupe = ?, 
            galiojaNuo = ?, galiojaIki = ?, valstybinisNr = ?, 
            metineIsmoka = ?, ismoka = ?, atnaujinimoData = ?
            WHERE id = ?`;
          const params = [
            contract.draudejas, contract.pardavejas, contract.ldGrupe,
            contract.galiojaNuo, contract.galiojaIki, contract.valstybinisNr,
            contract.metineIsmoka, contract.ismoka, contract.atnaujinimoData,
            existing.id
          ];
          db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        // Insert new contract
        await new Promise((resolve, reject) => {
          const sql = `INSERT INTO contracts (
            draudejas, pardavejas, ldGrupe, policyNo, 
            galiojaNuo, galiojaIki, valstybinisNr, 
            metineIsmoka, ismoka, notes, atnaujinimoData, is_archived
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`;
          const params = [
            contract.draudejas, contract.pardavejas, contract.ldGrupe, contract.policyNo,
            contract.galiojaNuo, contract.galiojaIki, contract.valstybinisNr,
            contract.metineIsmoka, contract.ismoka, '[]', contract.atnaujinimoData
          ];
          db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      results.success++;
    } catch (e) {
      console.error("Error processing item:", item, e);
      results.failed++;
      results.errors.push(e.message);
    }
  }

  res.json(results);
});

// --- Static File Serving (VPS Optimized) ---
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');

  if (fs.existsSync(distPath)) {
    // 1. Standard Production Build (if 'dist' exists)
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // 2. VPS No-Build Fallback (serves root files directly if built frontend is missing)
    console.log("Serving static files from ROOT (No-Build Mode)");
    app.use(express.static(path.join(__dirname, '../')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../index.html'));
    });
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
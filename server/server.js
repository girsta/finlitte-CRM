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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            isAdmin: user.role === 'admin'
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
      const newId = this.lastID;
      logHistory(newId, userId, username, 'CREATED', 'Contract created');
      res.json({ message: 'Created', id: newId });
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
app.get('/api/users', isAuthenticated, hasRole(['admin']), (req, res) => {
  db.all('SELECT id, username, role FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', isAuthenticated, hasRole(['admin']), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role || 'viewer'], function (err) {
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
  const { username, password, role } = req.body;

  if (!username || !role) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Check for username collision with other users
    db.get("SELECT id FROM users WHERE username = ? AND id != ?", [username, userId], async (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(400).json({ error: 'Username taken by another user' });

      if (password && password.trim() !== "") {
        // Update with new password
        const hash = await bcrypt.hash(password, 10);
        db.run("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?", [username, hash, role, userId], function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'User updated' });
        });
      } else {
        // Update without changing password
        db.run("UPDATE users SET username = ?, role = ? WHERE id = ?", [username, role, userId], function (err) {
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

// --- Task Management API ---
app.get('/api/tasks', isAuthenticated, (req, res) => {
  const role = req.session.role;
  const username = req.session.username;

  let sql = 'SELECT * FROM tasks ORDER BY created_at DESC';
  let params = [];

  if (role !== 'admin') {
    sql = 'SELECT * FROM tasks WHERE assigned_to = ? ORDER BY created_at DESC';
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
  // TODO: Add check to ensure user is assigned to task or is admin
  db.run("UPDATE tasks SET status = ? WHERE id = ?", [status, req.params.id], function (err) {
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

    const comments = task.comments ? JSON.parse(task.comments) : [];
    const newComment = {
      id: Date.now(),
      text,
      author: username,
      timestamp: new Date().toISOString()
    };

    comments.push(newComment);

    db.run('UPDATE tasks SET comments = ? WHERE id = ?', [JSON.stringify(comments), taskId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Comment added', comment: newComment });
    });
  });
});

app.delete('/api/tasks/:id', isAuthenticated, hasRole(['admin']), (req, res) => {
  db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Task deleted' });
  });
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
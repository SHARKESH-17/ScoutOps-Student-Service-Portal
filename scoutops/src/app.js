const express = require('express');
const path = require('path');
const crypto = require('crypto');
const client = require('prom-client');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'scoutops_' });

const httpRequestsTotal = new client.Counter({
  name: 'scoutops_http_requests_total',
  help: 'Total HTTP requests processed by ScoutOps.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});
const httpRequestDurationSeconds = new client.Histogram({
  name: 'scoutops_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});
const httpErrorsTotal = new client.Counter({
  name: 'scoutops_http_errors_total',
  help: 'Count of HTTP errors by method and route.',
  labelNames: ['method', 'route'],
  registers: [register],
});

const allowedCategories = ['ELECTRICAL', 'PLUMBING', 'INTERNET', 'CLEANING', 'FURNITURE', 'EQUIPMENT', 'SECURITY', 'OTHER'];
const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const allowedStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const roles = ['reporter', 'staff', 'admin'];
const normalizeEnum = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const validateIssuePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Issue payload must be a JSON object.';
  }

  for (const field of ['title', 'description', 'category', 'location', 'priority', 'reporter_name']) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === '') {
      return `Field "${field}" is required.`;
    }
  }

  if (!allowedCategories.includes(normalizeEnum(payload.category))) {
    return `Category must be one of: ${allowedCategories.join(', ')}`;
  }
  if (!allowedPriorities.includes(normalizeEnum(payload.priority))) {
    return `Priority must be one of: ${allowedPriorities.join(', ')}`;
  }
  if (payload.status !== undefined && !allowedStatuses.includes(normalizeEnum(payload.status))) {
    return `Status must be one of: ${allowedStatuses.join(', ')}`;
  }

  return null;
};

const issueSelect = `
  SELECT i.*, u.username AS assigned_to_username
  FROM issues i
  LEFT JOIN users u ON u.id = i.assigned_to
`;

const authenticationRequired = (req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    return res.status(503).json({ error: 'Authentication is not configured.' });
  }

  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Bearer token required.' });
  }

  try {
    const decoded = jwt.verify(token, secret, { issuer: 'scoutops', audience: 'scoutops-api' });
    if (!roles.includes(decoded.role) || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid access token.' });
    }
    req.user = { id: Number(decoded.sub), role: decoded.role, username: decoded.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token.' });
  }
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  return next();
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests. Try again later.' }),
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Too many login attempts. Try again later.' }),
});

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = String(res.statusCode);
    const routeName = req.route && req.route.path ? req.route.path : req.path;
    httpRequestsTotal.inc({ method: req.method, route: routeName, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route: routeName, status_code: statusCode }, duration);
    if (res.statusCode >= 400) httpErrorsTotal.inc({ method: req.method, route: routeName });
  });
  next();
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/api', (req, res) => res.json({ app: 'ScoutOps', tagline: 'Find. Track. Resolve.', status: 'UP' }));
app.get('/health', (req, res) => res.json({ status: 'UP', service: 'scoutops' }));
app.get('/health/db', async (req, res, next) => {
  try {
    await db.testConnection();
    res.json({ status: 'UP', service: 'scoutops', database: 'connected' });
  } catch (error) {
    next(error);
  }
});

app.get('/metrics', async (req, res, next) => {
  const expected = process.env.METRICS_TOKEN;
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: 'Metrics access is not configured.' });
  }
  const supplied = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(401).json({ error: 'Metrics authorization required.' });
  }
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || username.trim().length > 100
      || typeof password !== 'string' || !password || password.length > 72) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const result = await db.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1 AND active = TRUE',
      [username.trim()],
    );
    const user = result.rows[0];
    const valid = user && await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return res.status(503).json({ error: 'Authentication is not configured.' });
    const token = jwt.sign({ role: user.role, username: user.username }, secret, {
      subject: String(user.id),
      expiresIn: '8h',
      issuer: 'scoutops',
      audience: 'scoutops-api',
    });
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

app.use('/api', apiLimiter, authenticationRequired);

app.get('/api/auth/me', (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

app.get('/api/issues', async (req, res, next) => {
  try {
    const result = await db.query(`${issueSelect} ORDER BY i.created_at DESC`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/issues/:id', async (req, res, next) => {
  try {
    const result = await db.query(`${issueSelect} WHERE i.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Issue not found.' });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/issues', requireRole('reporter', 'staff', 'admin'), async (req, res, next) => {
  try {
    const validationError = validateIssuePayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const payload = [
      String(req.body.title).trim(),
      String(req.body.description).trim(),
      normalizeEnum(req.body.category),
      String(req.body.location).trim(),
      normalizeEnum(req.body.priority),
      String(req.body.reporter_name).trim(),
    ];
    const result = await db.query(
      `INSERT INTO issues (title, description, category, location, priority, status, reporter_name, reporter_id)
       VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7) RETURNING *`,
      [...payload, req.user.id],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.put('/api/issues/:id', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const validationError = validateIssuePayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const payload = [
      String(req.body.title).trim(),
      String(req.body.description).trim(),
      normalizeEnum(req.body.category),
      String(req.body.location).trim(),
      normalizeEnum(req.body.priority),
      normalizeEnum(req.body.status || 'OPEN'),
      String(req.body.reporter_name).trim(),
      req.params.id,
    ];
    const result = await db.withTransaction(async (connection) => {
      await connection.query("SELECT set_config('app.user_id', $1, true)", [String(req.user.id)]);
      return connection.query(
        `UPDATE issues SET title = $1, description = $2, category = $3, location = $4,
         priority = $5, status = $6, reporter_name = $7, updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        payload,
      );
    });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Issue not found.' });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/issues/:id/status', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const status = normalizeEnum(req.body && req.body.status);
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }
    const result = await db.withTransaction(async (connection) => {
      await connection.query("SELECT set_config('app.user_id', $1, true)", [String(req.user.id)]);
      return connection.query(
        'UPDATE issues SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.id],
      );
    });
    if (result.rows.length === 0) return res.status(404).json({ error: 'Issue not found.' });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/issues/:id/assignment', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const assignedTo = req.body && req.body.assigned_to;
    if (assignedTo !== null && !Number.isSafeInteger(Number(assignedTo))) {
      return res.status(400).json({ error: 'assigned_to must be a valid user id or null.' });
    }
    const result = await db.query(
      `UPDATE issues SET assigned_to = $1, updated_at = NOW()
       WHERE id = $2 AND ($1::integer IS NULL OR EXISTS (
         SELECT 1 FROM users WHERE id = $1 AND role IN ('staff', 'admin') AND active = TRUE
       )) RETURNING *`,
      [assignedTo === null ? null : Number(assignedTo), req.params.id],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Issue or assignee not found.' });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/issues/:id/history', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT h.id, h.issue_id, h.old_status, h.new_status, h.changed_at,
              u.username AS changed_by
       FROM issue_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.issue_id = $1 ORDER BY h.changed_at DESC`,
      [req.params.id],
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/users', requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT id, username, role FROM users WHERE active = TRUE AND role IN ('staff', 'admin') ORDER BY username",
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/users', requireRole('admin'), async (req, res, next) => {
  try {
    const { username, password, role } = req.body || {};
    if (typeof username !== 'string' || username.trim().length < 3
      || typeof password !== 'string' || password.length < 12 || password.length > 72
      || !['reporter', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Provide a username (3+ characters), password (12+ characters), and reporter or staff role.' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username.trim(), hash, role],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/issues/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM issues WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Issue not found.' });
    return res.json({ message: 'Issue deleted successfully', deleted: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

app.use(express.static(path.join(__dirname, '../public')));
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (error && error.code === '23505') return res.status(409).json({ error: 'Duplicate record detected.' });
  if (error && error.code === '23503') return res.status(400).json({ error: 'Referenced data is invalid.' });
  return res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;

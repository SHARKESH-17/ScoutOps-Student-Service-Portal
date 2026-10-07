const express = require('express');
const path = require('path');
const client = require('prom-client');
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

const normalizeEnum = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

const validateIssuePayload = (payload, { requireAllFields = false } = {}) => {
  if (!payload || typeof payload !== 'object') {
    return 'Issue payload must be a JSON object.';
  }

  const requiredFields = requireAllFields
    ? ['title', 'description', 'category', 'location', 'priority', 'status', 'reporter_name']
    : ['title', 'description', 'category', 'location', 'priority', 'reporter_name'];

  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === '') {
      return `Field "${field}" is required.`;
    }
  }

  const category = normalizeEnum(payload.category);
  const priority = normalizeEnum(payload.priority);
  const status = normalizeEnum(payload.status || 'OPEN');

  if (payload.category !== undefined && !allowedCategories.includes(category)) {
    return `Category must be one of: ${allowedCategories.join(', ')}`;
  }

  if (payload.priority !== undefined && !allowedPriorities.includes(priority)) {
    return `Priority must be one of: ${allowedPriorities.join(', ')}`;
  }

  if (payload.status !== undefined && !allowedStatuses.includes(status)) {
    return `Status must be one of: ${allowedStatuses.join(', ')}`;
  }

  return null;
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  const routeName = req.route && req.route.path ? req.route.path : req.path;

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = String(res.statusCode);
    httpRequestsTotal.inc({ method: req.method, route: routeName, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route: routeName, status_code: statusCode }, duration);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc({ method: req.method, route: routeName });
    }
  });

  next();
});

app.get('/', (req, res) => {
  res.json({
    app: 'ScoutOps',
    tagline: 'Find. Track. Resolve.',
    status: 'UP',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'scoutops',
  });
});

app.get('/health/db', async (req, res, next) => {
  try {
    await db.testConnection();
    res.json({
      status: 'UP',
      service: 'scoutops',
      database: 'connected',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/issues', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM issues ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/issues/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM issues WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/issues', async (req, res, next) => {
  try {
    const validationError = validateIssuePayload(req.body, { requireAllFields: true });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const payload = {
      title: String(req.body.title).trim(),
      description: String(req.body.description).trim(),
      category: normalizeEnum(req.body.category),
      location: String(req.body.location).trim(),
      priority: normalizeEnum(req.body.priority),
      status: normalizeEnum(req.body.status),
      reporter_name: String(req.body.reporter_name).trim(),
    };

    const result = await db.query(
      `INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [payload.title, payload.description, payload.category, payload.location, payload.priority, payload.status, payload.reporter_name],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.put('/api/issues/:id', async (req, res, next) => {
  try {
    const validationError = validateIssuePayload(req.body, { requireAllFields: true });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const payload = {
      title: String(req.body.title).trim(),
      description: String(req.body.description).trim(),
      category: normalizeEnum(req.body.category),
      location: String(req.body.location).trim(),
      priority: normalizeEnum(req.body.priority),
      status: normalizeEnum(req.body.status),
      reporter_name: String(req.body.reporter_name).trim(),
    };

    const id = req.params.id;
    const result = await db.query(
      `UPDATE issues
       SET title = $1,
           description = $2,
           category = $3,
           location = $4,
           priority = $5,
           status = $6,
           reporter_name = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [payload.title, payload.description, payload.category, payload.location, payload.priority, payload.status, payload.reporter_name, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/issues/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const normalizedStatus = normalizeEnum(status);

    if (!status || !allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        error: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const result = await db.query(
      'UPDATE issues SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [normalizedStatus, req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/issues/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM issues WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    return res.json({
      message: 'Issue deleted successfully',
      deleted: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found.',
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error && error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }

  if (error && error.code === '23505') {
    return res.status(409).json({ error: 'Duplicate record detected.' });
  }

  if (error && error.code === '23503') {
    return res.status(400).json({ error: 'Referenced data is invalid.' });
  }

  return res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;

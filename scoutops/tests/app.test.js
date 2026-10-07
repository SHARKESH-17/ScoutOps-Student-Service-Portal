jest.mock('../src/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
  testConnection: jest.fn(),
  closePool: jest.fn(),
}));

process.env.JWT_SECRET = 'unit-test-jwt-secret-that-is-at-least-32-characters';
process.env.METRICS_TOKEN = 'unit-test-metrics-token-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/db');

const tokenFor = (role = 'admin') => jwt.sign(
  { role, username: 'test-user' },
  process.env.JWT_SECRET,
  { subject: '1', issuer: 'scoutops', audience: 'scoutops-api', expiresIn: '1h' },
);
const auth = (role = 'admin') => ({ Authorization: `Bearer ${tokenFor(role)}` });

const seedIssues = [
  {
    id: 1,
    title: 'Broken light',
    description: 'Lighting issue in the west wing.',
    category: 'ELECTRICAL',
    location: 'West Hallway B',
    priority: 'HIGH',
    status: 'OPEN',
    reporter_name: 'Alicia Stone',
    created_at: '2024-01-01T12:00:00.000Z',
    updated_at: '2024-01-01T12:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  db.testConnection.mockResolvedValue({ ok: 1 });
  db.query.mockImplementation((sql) => {
    const statement = String(sql).toLowerCase();
    if (statement.includes('select i.*') && statement.includes('order by i.created_at')) {
      return Promise.resolve({ rows: seedIssues });
    }
    if (statement.includes('select i.*') && statement.includes('where i.id')) {
      return Promise.resolve({ rows: [seedIssues[0]] });
    }
    if (statement.includes('insert into issues')) {
      return Promise.resolve({ rows: [{ ...seedIssues[0], id: 2, title: 'New campus issue' }] });
    }
    if (statement.includes('update issues')) {
      return Promise.resolve({ rows: [{ ...seedIssues[0], status: 'RESOLVED' }] });
    }
    if (statement.includes('delete from issues')) {
      return Promise.resolve({ rows: [seedIssues[0]] });
    }
    if (statement.includes('select h.id')) {
      return Promise.resolve({ rows: [{ old_status: 'OPEN', new_status: 'RESOLVED' }] });
    }
    return Promise.resolve({ rows: [] });
  });
  db.withTransaction.mockImplementation((callback) => callback({ query: db.query }));
});

describe('ScoutOps API', () => {
  test('GET / serves the ScoutOps dashboard', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('SCOUTOPS');
  });

  test('GET /health returns status UP', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
  });

  test('GET /health/db checks database connectivity', async () => {
    const response = await request(app).get('/health/db');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });

  test('API rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/issues');
    expect(response.status).toBe(401);
  });

  test('API rejects unauthorized status changes for reporters', async () => {
    const response = await request(app)
      .patch('/api/issues/1/status')
      .set(auth('reporter'))
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(403);
  });

  test('GET /api/issues returns issues to authenticated users', async () => {
    const response = await request(app).get('/api/issues').set(auth('reporter'));
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  test('POST /api/issues rejects invalid payload', async () => {
    const response = await request(app)
      .post('/api/issues')
      .set(auth('reporter'))
      .send({ title: 'Bad request' });
    expect(response.status).toBe(400);
  });

  test('GET /api/issues/:id returns an issue', async () => {
    const response = await request(app).get('/api/issues/1').set(auth());
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
  });

  test('POST /api/issues creates an issue with an authenticated reporter', async () => {
    const response = await request(app)
      .post('/api/issues')
      .set(auth('reporter'))
      .send({
        title: 'New campus issue',
        description: 'Issue created via the API.',
        category: 'ELECTRICAL',
        location: 'Main Quad',
        priority: 'MEDIUM',
        reporter_name: 'Demo User',
      });
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('New campus issue');
  });

  test('PATCH /api/issues/:id/status updates issue status', async () => {
    const response = await request(app)
      .patch('/api/issues/1/status')
      .set(auth('staff'))
      .send({ status: 'RESOLVED' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('RESOLVED');
    expect(db.withTransaction).toHaveBeenCalled();
  });

  test('GET /metrics requires a bearer token', async () => {
    const rejected = await request(app).get('/metrics');
    const accepted = await request(app).get('/metrics')
      .set('Authorization', `Bearer ${process.env.METRICS_TOKEN}`);
    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(200);
    expect(accepted.text).toContain('scoutops_http_requests_total');
  });
});

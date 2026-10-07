jest.mock('../src/db', () => ({
  query: jest.fn(),
  testConnection: jest.fn(),
  closePool: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

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
  {
    id: 2,
    title: 'Bathroom leak',
    description: 'Restroom water leak.',
    category: 'PLUMBING',
    location: 'Library Annex',
    priority: 'CRITICAL',
    status: 'ASSIGNED',
    reporter_name: 'Marcus Lee',
    created_at: '2024-01-02T12:00:00.000Z',
    updated_at: '2024-01-02T12:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();

  db.testConnection.mockResolvedValue({ ok: 1 });
  db.query.mockImplementation((sql) => {
    const statement = String(sql).toLowerCase();

    if (statement.includes('select 1')) {
      return Promise.resolve({ rows: [{ ok: 1 }] });
    }

    if (statement.includes('select * from issues order by created_at desc')) {
      return Promise.resolve({ rows: seedIssues });
    }

    if (statement.includes('select * from issues where id = $1')) {
      const id = Number(sql.match(/\$1/) ? undefined : 1);
      const issue = seedIssues.find((item) => item.id === Number(id));
      return Promise.resolve({ rows: issue ? [issue] : [] });
    }

    if (statement.includes('insert into issues')) {
      const payload = {
        id: 3,
        title: 'New campus issue',
        description: 'Issue created via the API.',
        category: 'ELECTRICAL',
        location: 'Main Quad',
        priority: 'MEDIUM',
        status: 'OPEN',
        reporter_name: 'Demo User',
        created_at: '2024-01-03T00:00:00.000Z',
        updated_at: '2024-01-03T00:00:00.000Z',
      };
      seedIssues.push(payload);
      return Promise.resolve({ rows: [payload] });
    }

    if (statement.includes('update issues')) {
      const updated = {
        ...seedIssues[0],
        title: 'Updated issue',
        description: 'Updated description',
        category: 'PLUMBING',
        location: 'Updated Location',
        priority: 'LOW',
        status: 'RESOLVED',
        reporter_name: 'Updated User',
        updated_at: '2024-01-04T00:00:00.000Z',
      };
      return Promise.resolve({ rows: [updated] });
    }

    if (statement.includes('delete from issues')) {
      return Promise.resolve({ rows: [seedIssues[0]] });
    }

    if (statement.includes('patch') || statement.includes('status')) {
      return Promise.resolve({ rows: [{ ...seedIssues[0], status: 'RESOLVED' }] });
    }

    return Promise.resolve({ rows: [] });
  });
});

describe('ScoutOps API', () => {
  test('GET / returns app metadata', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.app).toBe('ScoutOps');
  });

  test('GET /health returns status UP', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('UP');
    expect(response.body.service).toBe('scoutops');
  });

  test('GET /health/db checks database connectivity', async () => {
    const response = await request(app).get('/health/db');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });

  test('GET /api/issues returns issues', async () => {
    const response = await request(app).get('/api/issues');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('POST /api/issues rejects invalid payload', async () => {
    const response = await request(app)
      .post('/api/issues')
      .send({ title: 'Bad request' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  test('GET /api/issues/:id returns 404 for missing issue', async () => {
    const response = await request(app).get('/api/issues/999');
    expect(response.status).toBe(404);
  });

  test('POST /api/issues creates a new issue', async () => {
    const response = await request(app)
      .post('/api/issues')
      .send({
        title: 'New campus issue',
        description: 'Issue created via the API.',
        category: 'ELECTRICAL',
        location: 'Main Quad',
        priority: 'MEDIUM',
        status: 'OPEN',
        reporter_name: 'Demo User',
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('New campus issue');
  });

  test('PUT /api/issues/:id updates issue details', async () => {
    const response = await request(app)
      .put('/api/issues/1')
      .send({
        title: 'Updated issue',
        description: 'Updated description',
        category: 'PLUMBING',
        location: 'Updated Location',
        priority: 'LOW',
        status: 'RESOLVED',
        reporter_name: 'Updated User',
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated issue');
  });

  test('PATCH /api/issues/:id/status updates issue status', async () => {
    const response = await request(app)
      .patch('/api/issues/1/status')
      .send({ status: 'RESOLVED' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('RESOLVED');
  });
});

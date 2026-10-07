const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

describe('ScoutOps PostgreSQL integration', () => {
  let token;
  let issueId;
  const title = `integration-${Date.now()}`;

  beforeAll(async () => {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD for integration tests.');
    }
    await db.testConnection();
    const login = await request(app).post('/api/auth/login').send({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    });
    expect(login.status).toBe(200);
    token = login.body.token;
  });

  afterAll(async () => {
    if (issueId && token) {
      await request(app).delete(`/api/issues/${issueId}`).set('Authorization', `Bearer ${token}`);
    }
    await db.closePool();
  });

  test('persists issues and records status changes in PostgreSQL', async () => {
    const authorization = { Authorization: `Bearer ${token}` };
    const created = await request(app)
      .post('/api/issues')
      .set(authorization)
      .send({
        title,
        description: 'Created by the real PostgreSQL integration suite.',
        category: 'EQUIPMENT',
        location: 'Integration Test Lab',
        priority: 'LOW',
        reporter_name: 'Integration Test',
      });
    expect(created.status).toBe(201);
    issueId = created.body.id;

    const status = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set(authorization)
      .send({ status: 'IN_PROGRESS' });
    expect(status.status).toBe(200);
    expect(status.body.status).toBe('IN_PROGRESS');

    const history = await request(app)
      .get(`/api/issues/${issueId}/history`)
      .set(authorization);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ old_status: 'OPEN', new_status: 'IN_PROGRESS' });

    const persisted = await request(app).get(`/api/issues/${issueId}`).set(authorization);
    expect(persisted.status).toBe(200);
    expect(persisted.body.title).toBe(title);
  });
});

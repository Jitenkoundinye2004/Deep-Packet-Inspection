import request from 'supertest';
import app from '../src/app.js';
import { dbStore } from '../src/services/db-store.js';
import { connectDB } from '../src/config/db.js';
import { connectRedis } from '../src/config/redis.js';
import mongoose from 'mongoose';

describe('DPI Engine API & Core Tests', () => {
  let redis;

  beforeAll(async () => {
    // Connect to mock Redis/DB fallbacks automatically
    await connectDB();
    redis = connectRedis();
  });

  afterAll(async () => {
    if (redis && typeof redis.del === 'function') {
      try {
        await redis.del('dpi:stats');
      } catch (err) {
        // Ignored
      }
    }
    await mongoose.disconnect();
  });

  describe('Rules API endpoints', () => {
    let testRuleId;

    it('should fetch rules list', async () => {
      const res = await request(app).get('/api/rules');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should create a new blocking rule', async () => {
      const res = await request(app)
        .post('/api/rules')
        .send({ type: 'ip', value: '192.168.1.50' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('ip');
      expect(res.body.value).toBe('192.168.1.50');
      testRuleId = res.body._id;
    });

    it('should prevent duplicate rules', async () => {
      const res = await request(app)
        .post('/api/rules')
        .send({ type: 'ip', value: '192.168.1.50' });

      expect(res.status).toBe(400);
    });

    it('should delete a rule', async () => {
      const res = await request(app).delete(`/api/rules/${testRuleId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });
  });

  describe('System Statistics & Packets endpoints', () => {
    it('should fetch system statistics', async () => {
      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalPackets');
      expect(res.body).toHaveProperty('totalBytes');
    });

    it('should fetch empty flows list', async () => {
      const res = await request(app).get('/api/flows');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should fetch empty packets list', async () => {
      const res = await request(app).get('/api/packets');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

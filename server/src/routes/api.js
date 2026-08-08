import express from 'express';
import multer from 'multer';
import { dbStore } from '../services/db-store.js';
import { dpiService } from '../services/dpi.service.js';
import { getRedisClient } from '../config/redis.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET all rules
router.get('/rules', async (req, res) => {
  try {
    const rules = await dbStore.getRules();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add a rule
router.post('/rules', async (req, res) => {
  const { type, value } = req.body;
  if (!type || !value) {
    return res.status(400).json({ error: 'Type and value are required' });
  }
  if (!['ip', 'app', 'domain'].includes(type)) {
    return res.status(400).json({ error: 'Invalid rule type. Must be ip, app, or domain' });
  }

  try {
    const newRule = await dbStore.addRule(type, value);
    res.status(201).json(newRule);
  } catch (error) {
    if (error.message.includes('duplicate') || error.message.includes('exists')) {
      return res.status(400).json({ error: 'Rule already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE a rule
router.delete('/rules/:id', async (req, res) => {
  try {
    await dbStore.deleteRule(req.params.id);
    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST upload PCAP
router.post('/upload', upload.single('pcap'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PCAP file uploaded' });
  }

  if (dpiService.isProcessing()) {
    return res.status(429).json({ error: 'System is currently processing another PCAP file' });
  }

  try {
    const io = req.app.get('io');
    dpiService.processPCAP(req.file.buffer, io); // Starts asynchronously in worker thread
    res.json({ message: 'PCAP upload successful. Analysis started.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET current statistics
router.get('/stats', async (req, res) => {
  try {
    // Attempt to load from Redis cache first
    const redis = getRedisClient();
    const cachedStats = await redis.get('dpi:stats');
    
    if (cachedStats) {
      return res.json(JSON.parse(cachedStats));
    }

    // Cache miss, aggregate from DB
    const stats = await dbStore.getStats();
    await redis.set('dpi:stats', JSON.stringify(stats), 'EX', 300); // cache for 5 minutes
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET connection flows
router.get('/flows', async (req, res) => {
  try {
    const flows = await dbStore.getFlows();
    res.json(flows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET individual packets
router.get('/packets', async (req, res) => {
  const { flowId, limit } = req.query;
  const parseLimit = limit ? parseInt(limit, 10) : 500;
  
  try {
    const filter = flowId ? { flowId } : {};
    const packets = await dbStore.getPackets(filter, parseLimit);
    res.json(packets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET status of parser
router.get('/status', (req, res) => {
  res.json({
    processing: dpiService.isProcessing(),
    progress: dpiService.getCurrentProgress()
  });
});

export default router;

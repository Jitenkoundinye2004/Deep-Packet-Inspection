import Rule from '../models/Rule.js';
import Flow from '../models/Flow.js';
import Packet from '../models/Packet.js';
import { isMockDB } from '../config/db.js';

// In-Memory Database Fallbacks
const memoryDb = {
  rules: [
    { _id: 'mock-rule-1', type: 'app', value: 'TikTok', createdAt: new Date() },
    { _id: 'mock-rule-2', type: 'domain', value: 'doubleclick.net', createdAt: new Date() }
  ],
  flows: [],
  packets: [],
  stats: {
    totalPackets: 0,
    totalBytes: 0,
    forwardedPackets: 0,
    droppedPackets: 0,
    tcpPackets: 0,
    udpPackets: 0,
    otherPackets: 0,
    activeConnections: 0,
    appDistribution: {}
  }
};

export const dbStore = {
  // Rules CRUD
  async getRules() {
    if (isMockDB()) {
      return memoryDb.rules;
    }
    return await Rule.find({});
  },

  async addRule(type, value) {
    if (isMockDB()) {
      const exists = memoryDb.rules.some(r => r.type === type && r.value === value);
      if (exists) throw new Error('Rule already exists');
      const newRule = {
        _id: 'mock-rule-' + Math.random().toString(36).substr(2, 9),
        type,
        value,
        createdAt: new Date()
      };
      memoryDb.rules.push(newRule);
      return newRule;
    }
    const rule = new Rule({ type, value });
    return await rule.save();
  },

  async deleteRule(id) {
    if (isMockDB()) {
      const index = memoryDb.rules.findIndex(r => r._id === id);
      if (index === -1) throw new Error('Rule not found');
      const deleted = memoryDb.rules.splice(index, 1)[0];
      return deleted;
    }
    return await Rule.findByIdAndDelete(id);
  },

  // Packet & Flow Operations
  async clearCaptureData() {
    if (isMockDB()) {
      memoryDb.flows = [];
      memoryDb.packets = [];
      memoryDb.stats = {
        totalPackets: 0,
        totalBytes: 0,
        forwardedPackets: 0,
        droppedPackets: 0,
        tcpPackets: 0,
        udpPackets: 0,
        otherPackets: 0,
        activeConnections: 0,
        appDistribution: {}
      };
      return;
    }
    await Flow.deleteMany({});
    await Packet.deleteMany({});
  },

  async saveFlows(flows) {
    if (isMockDB()) {
      memoryDb.flows = flows;
      return;
    }
    // Bulk write is highly efficient
    const ops = flows.map(flow => ({
      updateOne: {
        filter: { flowId: flow.flowId },
        update: { $set: flow },
        upsert: true
      }
    }));
    if (ops.length > 0) {
      await Flow.bulkWrite(ops);
    }
  },

  async savePackets(packets) {
    if (isMockDB()) {
      memoryDb.packets = packets;
      return;
    }
    if (packets.length > 0) {
      // Chunk bulk inserts if array is too large for Mongo limits
      const chunkSize = 5000;
      for (let i = 0; i < packets.length; i += chunkSize) {
        const chunk = packets.slice(i, i + chunkSize);
        await Packet.insertMany(chunk, { ordered: false });
      }
    }
  },

  async getFlows() {
    if (isMockDB()) {
      return memoryDb.flows;
    }
    return await Flow.find({}).sort({ bytes: -1 });
  },

  async getPackets(filter = {}, limit = 500) {
    if (isMockDB()) {
      let result = [...memoryDb.packets];
      if (filter.flowId) {
        result = result.filter(p => p.flowId === filter.flowId);
      }
      return result.slice(0, limit);
    }
    return await Packet.find(filter).sort({ packetId: 1 }).limit(limit);
  },

  async getStats() {
    if (isMockDB()) {
      return memoryDb.stats;
    }

    // Aggregate statistics from database
    const packetsCount = await Packet.countDocuments();
    if (packetsCount === 0) {
      return {
        totalPackets: 0,
        totalBytes: 0,
        forwardedPackets: 0,
        droppedPackets: 0,
        tcpPackets: 0,
        udpPackets: 0,
        otherPackets: 0,
        activeConnections: 0,
        appDistribution: {}
      };
    }

    const trafficStats = await Packet.aggregate([
      {
        $group: {
          _id: null,
          totalBytes: { $sum: '$length' },
          dropped: { $sum: { $cond: ['$blocked', 1, 0] } },
          forwarded: { $sum: { $cond: ['$blocked', 0, 1] } },
          tcp: { $sum: { $cond: [{ $eq: ['$protocol', 'TCP'] }, 1, 0] } },
          udp: { $sum: { $cond: [{ $eq: ['$protocol', 'UDP'] }, 1, 0] } }
        }
      }
    ]);

    const appDistributionAgg = await Packet.aggregate([
      {
        $group: {
          _id: '$appType',
          count: { $sum: 1 }
        }
      }
    ]);

    const activeConnections = await Flow.countDocuments();

    const tStat = trafficStats[0] || {};
    const appDistribution = {};
    appDistributionAgg.forEach(item => {
      appDistribution[item._id] = item.count;
    });

    return {
      totalPackets: packetsCount,
      totalBytes: tStat.totalBytes || 0,
      forwardedPackets: tStat.forwarded || 0,
      droppedPackets: tStat.dropped || 0,
      tcpPackets: tStat.tcp || 0,
      udpPackets: tStat.udp || 0,
      otherPackets: packetsCount - (tStat.tcp || 0) - (tStat.udp || 0),
      activeConnections,
      appDistribution
    };
  },

  setMemoryStats(stats) {
    if (isMockDB()) {
      memoryDb.stats = stats;
    }
  }
};

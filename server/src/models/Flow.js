import mongoose from 'mongoose';

const flowSchema = new mongoose.Schema({
  flowId: {
    type: String,
    required: true,
    unique: true
  },
  srcIp: {
    type: String,
    required: true
  },
  destIp: {
    type: String,
    required: true
  },
  srcPort: {
    type: Number,
    required: true
  },
  destPort: {
    type: Number,
    required: true
  },
  protocol: {
    type: String,
    required: true,
    enum: ['TCP', 'UDP', 'UNKNOWN']
  },
  appType: {
    type: String,
    default: 'UNKNOWN'
  },
  sni: {
    type: String,
    default: ''
  },
  packets: {
    type: Number,
    default: 0
  },
  bytes: {
    type: Number,
    default: 0
  },
  blocked: {
    type: Boolean,
    default: false
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
});

flowSchema.index({ srcIp: 1, destIp: 1, srcPort: 1, destPort: 1, protocol: 1 });

const Flow = mongoose.model('Flow', flowSchema);
export default Flow;

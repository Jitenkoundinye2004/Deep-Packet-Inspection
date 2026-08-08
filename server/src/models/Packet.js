import mongoose from 'mongoose';

const packetSchema = new mongoose.Schema({
  packetId: {
    type: Number,
    required: true
  },
  flowId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  length: {
    type: Number,
    required: true
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
    type: Number
  },
  destPort: {
    type: Number
  },
  protocol: {
    type: String,
    required: true
  },
  appType: {
    type: String,
    default: 'UNKNOWN'
  },
  sni: {
    type: String,
    default: ''
  },
  blocked: {
    type: Boolean,
    default: false
  },
  summary: {
    type: String,
    default: ''
  }
});

// Compound indexes for fast querying of packets belonging to a flow or sorting by packetId
packetSchema.index({ flowId: 1, packetId: 1 });
packetSchema.index({ timestamp: -1 });

const Packet = mongoose.model('Packet', packetSchema);
export default Packet;

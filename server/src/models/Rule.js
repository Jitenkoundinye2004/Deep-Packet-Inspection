import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['ip', 'app', 'domain']
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid duplicate rules
ruleSchema.index({ type: 1, value: 1 }, { unique: true });

const Rule = mongoose.model('Rule', ruleSchema);
export default Rule;

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/packet_analyzer';

let isConnected = false;
let dbMockMode = false;

export async function connectDB() {
  if (isConnected) return;

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000 // Timeout after 3 seconds
    });
    isConnected = true;
    console.log('✔ MongoDB connected successfully to', MONGODB_URI);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️ Falling back to Database Mock Mode (In-memory storage) for smooth out-of-the-box run!');
    dbMockMode = true;
  }
}

export function isMockDB() {
  return dbMockMode;
}

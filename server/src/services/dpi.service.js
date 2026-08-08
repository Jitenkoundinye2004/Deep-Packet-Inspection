import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import { dbStore } from './db-store.js';
import { getRedisClient } from '../config/redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.resolve(__dirname, '../workers/pcap-parser.worker.js');

let isAnalyzing = false;
let currentProgress = 0;

export const dpiService = {
  isProcessing() {
    return isAnalyzing;
  },

  getCurrentProgress() {
    return currentProgress;
  },

  async processPCAP(fileBuffer, io) {
    if (isAnalyzing) {
      throw new Error('DPI Engine is already analyzing a PCAP file');
    }

    isAnalyzing = true;
    currentProgress = 0;

    try {
      // 1. Clear database flows and packets
      await dbStore.clearCaptureData();

      // 2. Fetch blocking rules from database
      const rules = await dbStore.getRules();

      // 3. Spawn Worker Thread
      const worker = new Worker(workerPath, {
        workerData: {
          fileBuffer: fileBuffer.buffer.slice(
            fileBuffer.byteOffset,
            fileBuffer.byteOffset + fileBuffer.byteLength
          ),
          rules: rules.map(r => ({ type: r.type, value: r.value }))
        }
      });

      console.log(`[DPI Orchestrator] Spawning parser worker thread...`);

      worker.on('message', async (message) => {
        if (message.type === 'progress') {
          currentProgress = message.progress;
          // Emit progress and stats live to client
          if (io) {
            io.emit('pcap:progress', {
              progress: message.progress,
              stats: message.stats
            });
          }
        } else if (message.type === 'done') {
          console.log(`[DPI Orchestrator] Parser worker complete. Saving records to database...`);
          
          const { packets, flows, stats } = message;

          // Save flows and packets to DB/Memory
          await dbStore.saveFlows(flows);
          await dbStore.savePackets(packets);
          dbStore.setMemoryStats(stats);

          // Cache final statistics in Redis
          const redis = getRedisClient();
          await redis.set('dpi:stats', JSON.stringify(stats), 'EX', 3600); // Cache for 1 hour

          currentProgress = 100;
          isAnalyzing = false;

          if (io) {
            io.emit('pcap:done', {
              stats,
              message: 'Analysis completed successfully!'
            });
          }
        } else if (message.type === 'error') {
          console.error(`[DPI Orchestrator] Parser worker error:`, message.error);
          isAnalyzing = false;
          if (io) {
            io.emit('pcap:error', { error: message.error });
          }
        }
      });

      worker.on('error', (err) => {
        console.error(`[DPI Orchestrator] Worker critical error:`, err.message);
        isAnalyzing = false;
        if (io) {
          io.emit('pcap:error', { error: err.message });
        }
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[DPI Orchestrator] Worker stopped with exit code ${code}`);
          isAnalyzing = false;
        }
      });

      return { success: true, message: 'PCAP Analysis started' };
    } catch (error) {
      isAnalyzing = false;
      console.error(`[DPI Orchestrator] Failed to start analysis:`, error.message);
      throw error;
    }
  }
};

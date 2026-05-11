const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nurse-capture';

/**
 * Reuse one connection across serverless invocations (Vercel) and avoid opening
 * a new pool on every cold start.
 */
async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  await mongoose.connect(MONGODB_URI);
  return mongoose.connection;
}

module.exports = { connectDb, MONGODB_URI };

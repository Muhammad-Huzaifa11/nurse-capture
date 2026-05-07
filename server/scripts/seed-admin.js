require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../models/user');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nurse-capture';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment.');
  }

  if (ADMIN_PASSWORD.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  await mongoose.connect(MONGODB_URI);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const result = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.trim().toLowerCase() },
    {
      $set: {
        passwordHash,
        role: 'admin',
        isActive: true,
      },
      $setOnInsert: {
        email: ADMIN_EMAIL.trim().toLowerCase(),
      },
    },
    {
      upsert: true,
      new: true,
    }
  );

  console.log(`Admin seeded: ${result.email}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

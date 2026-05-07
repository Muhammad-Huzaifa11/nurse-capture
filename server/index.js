require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Event, SIGNAL_TYPES, SHIFTS, UNIT_KEYS } = require('./models/event');
const { User } = require('./models/user');
const analytics = require('./analytics');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nurse-capture';
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

app.use(cors());
app.use(express.json());

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest('Optional string fields must be strings.');
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateEnumOrNull(fieldName, value, allowedValues) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} must be a string.`);
  }
  if (!allowedValues.includes(value)) {
    throw badRequest(`${fieldName} must be one of: ${allowedValues.join(', ')}.`);
  }
  return value;
}

function parseOccurredAt(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw badRequest('occurredAt must be an ISO timestamp string.');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest('occurredAt must be a valid ISO timestamp.');
  }
  return parsed;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

async function requireAdmin(req, _res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      const error = new Error('Missing authorization token.');
      error.status = 401;
      throw error;
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive || user.role !== 'admin') {
      const error = new Error('Unauthorized.');
      error.status = 401;
      throw error;
    }

    req.auth = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(Object.assign(new Error('Invalid or expired token.'), { status: 401 }));
    }
    return next(err);
  }
}

app.get('/health', (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ ok: true, db });
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest('Request body must be a JSON object.');
    }

    const email = normalizeOptionalString(body.email)?.toLowerCase();
    const password = normalizeOptionalString(body.password);
    if (!email || !password) {
      throw badRequest('email and password are required.');
    }

    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
    }

    const token = signAccessToken(user);

    return res.json({
      ok: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/auth/me', requireAdmin, (req, res) => {
  return res.json({ ok: true, user: req.auth });
});

app.get('/analytics/summary', requireAdmin, analytics.getSummary);
app.get('/analytics/timeseries', requireAdmin, analytics.getTimeseries);
app.get('/analytics/by-shift', requireAdmin, analytics.getByShift);

app.post('/events', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest('Request body must be a JSON object.');
    }

    const { signalType, shift, unitKey, note, occurredAt } = body;

    if (typeof signalType !== 'string' || !SIGNAL_TYPES.includes(signalType)) {
      throw badRequest(`signalType is required and must be one of: ${SIGNAL_TYPES.join(', ')}.`);
    }

    const normalizedShift = validateEnumOrNull('shift', shift, SHIFTS);
    const normalizedUnitKey = validateEnumOrNull('unitKey', unitKey, UNIT_KEYS);
    const normalizedNote = normalizeOptionalString(note);
    const normalizedOccurredAt = parseOccurredAt(occurredAt);

    if (normalizedNote !== null && normalizedNote.length > 500) {
      throw badRequest('note must be 500 characters or fewer.');
    }

    const event = await Event.create({
      signalType,
      shift: normalizedShift,
      unitKey: normalizedUnitKey,
      note: normalizedNote,
      occurredAt: normalizedOccurredAt,
      receivedAt: new Date(),
      schemaVersion: 1,
    });

    return res.status(201).json({
      ok: true,
      event: {
        id: event._id.toString(),
        receivedAt: event.receivedAt.toISOString(),
        schemaVersion: event.schemaVersion,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ ok: false, error: err.message });
  }
  const status = err?.status ?? 500;
  const message = status >= 500 ? 'Internal server error.' : err.message;
  return res.status(status).json({ ok: false, error: message });
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`API http://127.0.0.1:${PORT} (from Vite use /api → proxied here)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

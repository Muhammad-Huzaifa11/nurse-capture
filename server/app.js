require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Event, SIGNAL_TYPES, SHIFTS, UNIT_KEYS } = require('./models/event');
const { User } = require('./models/user');
const { Seat, buildSeatCode, buildSeatLabel, randomSuffix } = require('./models/seat');
const analytics = require('./analytics');
const { connectDb } = require('./db');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
/** Seat tokens are operational; longer-lived but still revocable per request via DB lookup. */
const SEAT_JWT_EXPIRES_IN = process.env.SEAT_JWT_EXPIRES_IN || '30d';
/** Minimum time between accepted captures for the same seat (any signal type). 15s — client `CAPTURE_COOLDOWN_MS` must match. */
const SEAT_CAPTURE_COOLDOWN_MS = 15 * 1000;
/** Reject occurredAt older than this (abuse / stale queue guard). */
const OCCURRED_AT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

app.set('trust proxy', 1);

app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Same-origin browser calls use `/api/...` on Vercel. The Vite dev proxy strips
 * `/api` before forwarding to Express, so this is a no-op locally.
 */
app.use((req, res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }
  next();
});

app.use(cors());
app.use(express.json());

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function notFound(message = 'Not found.') {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function unauthorized(message = 'Unauthorized.') {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest('Optional string fields must be strings.');
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateEnum(fieldName, value, allowedValues) {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
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

/**
 * Clock used for capture cooldown: client tap time when trustworthy, else server now.
 * Future client times clamp to now; very old times reject.
 */
function resolveCooldownAnchorTime(parsedOccurredAt, now) {
  let t = parsedOccurredAt != null ? new Date(parsedOccurredAt.getTime()) : new Date(now.getTime());
  if (t.getTime() > now.getTime()) {
    t = new Date(now.getTime());
  }
  const oldest = new Date(now.getTime() - OCCURRED_AT_MAX_AGE_MS);
  if (t.getTime() < oldest.getTime()) {
    throw badRequest('occurredAt is too far in the past.');
  }
  return t;
}

/**
 * JWT signing helpers. Both kinds share the same secret; the `kind` claim
 * stops a seat token from being used on admin endpoints (and vice versa).
 */
function signAdminToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      kind: 'admin',
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function signSeatToken(seat) {
  return jwt.sign(
    {
      sub: seat._id.toString(),
      kind: 'seat',
    },
    JWT_SECRET,
    { expiresIn: SEAT_JWT_EXPIRES_IN }
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function verifyTokenOrThrow(token, expectedKind) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      throw unauthorized('Invalid or expired token.');
    }
    throw err;
  }
  if (payload.kind !== expectedKind) {
    throw unauthorized('Token cannot be used for this resource.');
  }
  return payload;
}

async function requireAdmin(req, _res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized('Missing authorization token.');

    const payload = verifyTokenOrThrow(token, 'admin');
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive || user.role !== 'admin') {
      throw unauthorized();
    }

    req.auth = {
      kind: 'admin',
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Seat auth: verify JWT, then re-fetch the seat from the DB on every request.
 * That means deactivating a seat instantly revokes all its sessions, and any
 * edits to the seat (unit/shift) take effect on the very next event.
 */
async function requireSeat(req, _res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized('Missing seat token.');

    const payload = verifyTokenOrThrow(token, 'seat');
    const seat = await Seat.findById(payload.sub).lean();
    if (!seat || !seat.isActive) {
      throw unauthorized('This session is no longer active.');
    }

    req.auth = {
      kind: 'seat',
      seatId: seat._id.toString(),
      unitKey: seat.unitKey,
      shift: seat.shift,
      label: seat.label,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

app.get('/health', (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ ok: true, db });
});

/** ============================================================
 *  Admin auth (existing)
 *  ============================================================ */

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

    const token = signAdminToken(user);

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

/** ============================================================
 *  Seat auth (new) — anonymous, workflow-context credentials
 *  ============================================================ */

/** Public: redeem a code → seat JWT. */
app.post('/auth/seat/redeem', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest('Request body must be a JSON object.');
    }
    const rawCode = normalizeOptionalString(body.code);
    if (!rawCode) throw badRequest('code is required.');

    const code = rawCode.toUpperCase();
    const seat = await Seat.findOne({ code });
    if (!seat || !seat.isActive) {
      return res.status(401).json({ ok: false, error: 'Code not recognized or inactive.' });
    }

    /** Track usage so admins can see which codes are live. Best-effort, no-await. */
    Seat.updateOne({ _id: seat._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

    const token = signSeatToken(seat);
    return res.json({
      ok: true,
      token,
      seat: {
        id: seat._id.toString(),
        label: seat.label,
        unitKey: seat.unitKey,
        shift: seat.shift,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** Used by the client to validate a stored seat token on boot. */
app.get('/auth/seat/me', requireSeat, (req, res) => {
  return res.json({
    ok: true,
    seat: {
      id: req.auth.seatId,
      label: req.auth.label,
      unitKey: req.auth.unitKey,
      shift: req.auth.shift,
    },
  });
});

/** ============================================================
 *  Admin: manage seats
 *  ============================================================ */

app.get('/admin/seats', requireAdmin, async (_req, res, next) => {
  try {
    const seats = await Seat.find().sort({ createdAt: -1 }).lean();
    return res.json({
      ok: true,
      seats: seats.map((s) => ({
        id: s._id.toString(),
        code: s.code,
        label: s.label,
        unitKey: s.unitKey,
        shift: s.shift,
        isActive: s.isActive,
        notes: s.notes,
        lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
        createdAt: s.createdAt ? s.createdAt.toISOString() : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

app.post('/admin/seats', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const unitKey = validateEnum('unitKey', body.unitKey, UNIT_KEYS);
    const shift = validateEnum('shift', body.shift, SHIFTS);
    const notes = normalizeOptionalString(body.notes);
    if (notes && notes.length > 200) {
      throw badRequest('notes must be 200 characters or fewer.');
    }

    const code = await generateUniqueSeatCode(unitKey, shift);
    const label = buildSeatLabel(unitKey, shift);

    const seat = await Seat.create({
      code,
      label,
      unitKey,
      shift,
      notes,
      isActive: true,
    });

    return res.status(201).json({
      ok: true,
      seat: {
        id: seat._id.toString(),
        code: seat.code,
        label: seat.label,
        unitKey: seat.unitKey,
        shift: seat.shift,
        isActive: seat.isActive,
        notes: seat.notes,
        lastUsedAt: null,
        createdAt: seat.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
});

app.patch('/admin/seats/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid seat id.');

    const body = req.body ?? {};
    const update = {};
    if (typeof body.isActive === 'boolean') update.isActive = body.isActive;
    if ('notes' in body) {
      const notes = normalizeOptionalString(body.notes);
      if (notes && notes.length > 200) {
        throw badRequest('notes must be 200 characters or fewer.');
      }
      update.notes = notes;
    }

    if (Object.keys(update).length === 0) throw badRequest('No editable fields supplied.');

    const seat = await Seat.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!seat) throw notFound('Seat not found.');

    return res.json({
      ok: true,
      seat: serializeSeat(seat),
    });
  } catch (err) {
    return next(err);
  }
});

/** Rotate the code; existing JWTs continue to work (they reference seat id). */
app.post('/admin/seats/:id/rotate-code', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid seat id.');

    const seat = await Seat.findById(id);
    if (!seat) throw notFound('Seat not found.');

    seat.code = await generateUniqueSeatCode(seat.unitKey, seat.shift);
    await seat.save();

    return res.json({
      ok: true,
      seat: serializeSeat(seat.toObject()),
    });
  } catch (err) {
    return next(err);
  }
});

app.delete('/admin/seats/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) throw badRequest('Invalid seat id.');

    const seat = await Seat.findByIdAndDelete(id).lean();
    if (!seat) throw notFound('Seat not found.');

    return res.json({ ok: true, id });
  } catch (err) {
    return next(err);
  }
});

function serializeSeat(s) {
  return {
    id: s._id.toString(),
    code: s.code,
    label: s.label,
    unitKey: s.unitKey,
    shift: s.shift,
    isActive: s.isActive,
    notes: s.notes,
    lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
  };
}

async function generateUniqueSeatCode(unitKey, shift) {
  /** Up to 5 retries to handle the (extremely rare) collision on the random suffix. */
  for (let i = 0; i < 5; i++) {
    const candidate = buildSeatCode(unitKey, shift, randomSuffix(4));
    const existing = await Seat.findOne({ code: candidate }).lean();
    if (!existing) return candidate;
  }
  throw new Error('Failed to generate a unique seat code; please retry.');
}

/** ============================================================
 *  Analytics (admin)
 *  ============================================================ */

app.get('/analytics/summary', requireAdmin, analytics.getSummary);
app.get('/analytics/timeseries', requireAdmin, analytics.getTimeseries);
app.get('/analytics/by-shift', requireAdmin, analytics.getByShift);
app.get('/analytics/by-unit', requireAdmin, analytics.getByUnit);
app.get('/analytics/ratio-trend', requireAdmin, analytics.getRatioTrend);
app.get('/analytics/activity-feed', requireAdmin, analytics.getActivityFeed);
app.get('/analytics/export.csv', requireAdmin, analytics.exportSignalsCsv);

/** ============================================================
 *  Events (now seat-protected)
 *  ============================================================ */

app.post('/events', requireSeat, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest('Request body must be a JSON object.');
    }

    const { signalType, note, occurredAt } = body;

    if (typeof signalType !== 'string' || !SIGNAL_TYPES.includes(signalType)) {
      throw badRequest(`signalType is required and must be one of: ${SIGNAL_TYPES.join(', ')}.`);
    }

    const normalizedNote = normalizeOptionalString(note);
    const normalizedOccurredAt = parseOccurredAt(occurredAt);

    if (normalizedNote !== null && normalizedNote.length > 500) {
      throw badRequest('note must be 500 characters or fewer.');
    }

    const now = new Date();
    const cooldownAnchor = resolveCooldownAnchorTime(normalizedOccurredAt, now);
    const cutoffPriorTap = new Date(cooldownAnchor.getTime() - SEAT_CAPTURE_COOLDOWN_MS);

    /**
     * Shared cooldown per seat using tap-time (occurredAt), so offline-queued
     * replays that arrive together still succeed when taps were ≥ cooldown apart.
     * `lastCaptureOccurredAt` is separate from `lastUsedAt` (redeem / admin touch).
     */
    const seatBefore = await Seat.findOneAndUpdate(
      {
        _id: req.auth.seatId,
        $or: [
          { lastCaptureOccurredAt: null },
          { lastCaptureOccurredAt: { $lte: cutoffPriorTap } },
        ],
      },
      { $set: { lastCaptureOccurredAt: cooldownAnchor } }
    );

    if (!seatBefore) {
      const s = await Seat.findById(req.auth.seatId).select('lastCaptureOccurredAt').lean();
      const lastMs = s?.lastCaptureOccurredAt
        ? new Date(s.lastCaptureOccurredAt).getTime()
        : now.getTime() - SEAT_CAPTURE_COOLDOWN_MS;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((SEAT_CAPTURE_COOLDOWN_MS - (now.getTime() - lastMs)) / 1000)
      );
      return res.status(429).json({
        ok: false,
        error: 'Please wait before logging another event.',
        retryAfterSeconds,
      });
    }

    /**
     * Unit + shift come from the seat (req.auth) — never the client body.
     * This is the key privacy/integrity guarantee: the device cannot lie
     * about which unit/shift it is reporting from.
     */
    let event;
    try {
      event = await Event.create({
        signalType,
        shift: req.auth.shift,
        unitKey: req.auth.unitKey,
        note: normalizedNote,
        occurredAt: normalizedOccurredAt,
        receivedAt: new Date(),
        schemaVersion: 1,
      });
    } catch (createErr) {
      await Seat.updateOne(
        { _id: req.auth.seatId },
        { $set: { lastCaptureOccurredAt: seatBefore.lastCaptureOccurredAt ?? null } }
      ).catch(() => {});
      throw createErr;
    }

    /** Admin “last activity” — decoupled from cooldown anchor. */
    Seat.updateOne({ _id: req.auth.seatId }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

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

/** ============================================================
 *  Error handler
 *  ============================================================ */

app.use((err, _req, res, _next) => {
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ ok: false, error: err.message });
  }
  const status = err?.status ?? 500;
  const message = status >= 500 ? 'Internal server error.' : err.message;
  return res.status(status).json({ ok: false, error: message });
});

module.exports = app;

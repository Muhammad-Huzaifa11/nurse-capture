const { Event } = require('./models/event');

/** Dashboard unit filter → Mongo query on unitKey */
function unitFilterQuery(unit) {
  if (!unit || unit === 'all') return {};
  if (unit === 'nicu') return { unitKey: { $in: ['nicu-a', 'nicu-b'] } };
  if (unit === 'icu') return { unitKey: 'stepdown' };
  if (unit === 'ed') return { unitKey: 'other' };
  return {};
}

function rangeToDays(range) {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return null;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

/** Event “when” timestamp: occurredAt if set, else receivedAt */
function timestampExpr() {
  return { $ifNull: ['$occurredAt', '$receivedAt'] };
}

function matchTimeRange(start, end) {
  return {
    $expr: {
      $and: [
        { $gte: [timestampExpr(), start] },
        { $lte: [timestampExpr(), end] },
      ],
    },
  };
}

async function countSignals(matchExtra, start, end, signalType) {
  return Event.countDocuments({
    signalType,
    ...matchExtra,
    ...matchTimeRange(start, end),
  });
}

/**
 * GET /analytics/summary
 */
async function getSummary(req, res, next) {
  try {
    const range = req.query.range || '7d';
    const unit = req.query.unit || 'all';
    const days = rangeToDays(range);
    if (days === null) throw badRequest('range must be 7d, 30d, or 90d.');

    const unitQ = unitFilterQuery(unit);
    const now = new Date();
    const end = now;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const priorEnd = start;
    const priorStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    const [total, interruptions, compensations, priorTotal] = await Promise.all([
      Event.countDocuments({ ...unitQ, ...matchTimeRange(start, end) }),
      countSignals(unitQ, start, end, 'interruption'),
      countSignals(unitQ, start, end, 'compensation'),
      Event.countDocuments({ ...unitQ, ...matchTimeRange(priorStart, priorEnd) }),
    ]);

    const interruptionPct = total > 0 ? Math.round((interruptions / total) * 100) : 0;
    const compensationPct = total > 0 ? Math.round((compensations / total) * 100) : 0;

    let deltaPct = 0;
    if (priorTotal === 0 && total > 0) deltaPct = 100;
    else if (priorTotal > 0) {
      deltaPct = Math.round(((total - priorTotal) / priorTotal) * 100);
    }
    const deltaLabel = `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`;

    return res.json({
      ok: true,
      range,
      unit,
      current: {
        total,
        interruptions,
        compensations,
        interruptionPct,
        compensationPct,
      },
      prior: {
        total: priorTotal,
      },
      deltaPct,
      deltaLabel,
    });
  } catch (err) {
    return next(err);
  }
}

function startOfDayUtc(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function formatMonthLabel(isoMonth) {
  const [y, m] = isoMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short' });
}

/**
 * GET /analytics/timeseries?range=7d&granularity=day|week|month&unit=all
 */
async function getTimeseries(req, res, next) {
  try {
    const range = req.query.range || '7d';
    const granularity = req.query.granularity || 'day';
    const unit = req.query.unit || 'all';
    const days = rangeToDays(range);
    if (days === null) throw badRequest('range must be 7d, 30d, or 90d.');
    if (!['day', 'week', 'month'].includes(granularity)) {
      throw badRequest('granularity must be day, week, or month.');
    }

    const unitQ = unitFilterQuery(unit);
    const now = new Date();
    const end = now;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const match = { ...unitQ, ...matchTimeRange(start, end) };

    let groupId;
    let sortStage = { $sort: { _id: 1 } };

    if (granularity === 'day') {
      groupId = {
        $dateToString: { format: '%Y-%m-%d', date: timestampExpr(), timezone: 'UTC' },
      };
    } else if (granularity === 'week') {
      groupId = {
        year: { $isoWeekYear: { date: timestampExpr(), timezone: 'UTC' } },
        week: { $isoWeek: { date: timestampExpr(), timezone: 'UTC' } },
      };
      sortStage = { $sort: { '_id.year': 1, '_id.week': 1 } };
    } else {
      groupId = {
        $dateToString: { format: '%Y-%m', date: timestampExpr(), timezone: 'UTC' },
      };
    }

    const rows = await Event.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          interruptions: {
            $sum: { $cond: [{ $eq: ['$signalType', 'interruption'] }, 1, 0] },
          },
          compensations: {
            $sum: { $cond: [{ $eq: ['$signalType', 'compensation'] }, 1, 0] },
          },
        },
      },
      sortStage,
    ]);

    const bucketMap = new Map();
    for (const row of rows) {
      let key;
      let label;
      if (granularity === 'day') {
        key = row._id;
        const [y, mo, da] = row._id.split('-').map(Number);
        const dt = new Date(Date.UTC(y, mo - 1, da));
        label = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      } else if (granularity === 'week') {
        key = `${row._id.year}-W${String(row._id.week).padStart(2, '0')}`;
        label = `W${row._id.week}`;
      } else {
        key = row._id;
        label = formatMonthLabel(row._id);
      }
      bucketMap.set(key, {
        key,
        label,
        interruptions: row.interruptions,
        compensations: row.compensations,
      });
    }

    /** Fill missing buckets from start to end */
    const points = [];
    if (granularity === 'day') {
      let cursor = startOfDayUtc(start);
      const endDay = startOfDayUtc(end);
      while (cursor <= endDay) {
        const key = cursor.toISOString().slice(0, 10);
        const existing = bucketMap.get(key);
        const label = cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        points.push(
          existing || {
            key,
            label,
            interruptions: 0,
            compensations: 0,
          }
        );
        cursor = addDays(cursor, 1);
      }
    } else if (granularity === 'week') {
      for (const [, v] of [...bucketMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        points.push({
          label: v.label,
          interruptions: v.interruptions,
          compensations: v.compensations,
        });
      }
      if (points.length === 0) {
        points.push({ label: '—', interruptions: 0, compensations: 0 });
      }
    } else {
      let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      while (cursor <= endMonth) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
        const existing = bucketMap.get(key);
        const label = cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        points.push(
          existing
            ? { label: existing.label, interruptions: existing.interruptions, compensations: existing.compensations }
            : { label, interruptions: 0, compensations: 0 }
        );
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }
    }

    return res.json({
      ok: true,
      granularity,
      range,
      unit,
      points: points.map((p) => ({
        label: p.label,
        interruptions: p.interruptions,
        compensations: p.compensations,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /analytics/by-shift?range=7d&unit=all
 */
async function getByShift(req, res, next) {
  try {
    const range = req.query.range || '7d';
    const unit = req.query.unit || 'all';
    const days = rangeToDays(range);
    if (days === null) throw badRequest('range must be 7d, 30d, or 90d.');

    const unitQ = unitFilterQuery(unit);
    const now = new Date();
    const end = now;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const match = {
      ...unitQ,
      ...matchTimeRange(start, end),
      shift: { $in: ['night', 'day', 'evening'] },
    };

    const rows = await Event.aggregate([
      { $match: match },
      {
        $group: {
          _id: { shift: '$shift', signalType: '$signalType' },
          count: { $sum: 1 },
        },
      },
    ]);

    const order = ['Night', 'Day', 'Evening'];
    const acc = {
      night: { interruptions: 0, compensations: 0 },
      day: { interruptions: 0, compensations: 0 },
      evening: { interruptions: 0, compensations: 0 },
    };

    for (const row of rows) {
      const s = row._id.shift;
      const st = row._id.signalType;
      if (!acc[s]) continue;
      if (st === 'interruption') acc[s].interruptions = row.count;
      if (st === 'compensation') acc[s].compensations = row.count;
    }

    const maxInt = Math.max(...order.map((lbl) => acc[lbl.toLowerCase()]?.interruptions ?? 0), 1);
    const maxComp = Math.max(...order.map((lbl) => acc[lbl.toLowerCase()]?.compensations ?? 0), 1);

    const shifts = order.map((label) => {
      const key = label.toLowerCase();
      const interruptions = acc[key].interruptions;
      const compensations = acc[key].compensations;
      return {
        label,
        interruptions,
        compensations,
        interruptionIntensity: interruptions / maxInt,
        compensationIntensity: compensations / maxComp,
      };
    });

    return res.json({ ok: true, range, unit, shifts });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSummary,
  getTimeseries,
  getByShift,
  unitFilterQuery,
  rangeToDays,
};

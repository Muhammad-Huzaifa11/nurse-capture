const { Event } = require('./models/event');
const { unitLabel, shiftLabel } = require('./constants/labels');

/** Dashboard unit filter → Mongo query on unitKey */
function unitFilterQuery(unit) {
  if (!unit || unit === 'all') return {};
  if (unit === 'icu') return { unitKey: { $in: ['icu', 'nicu-a', 'nicu-b'] } };
  return { unitKey: unit };
}

function rangeToDays(range) {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return null;
}

function parseIsoDate(value, fieldName) {
  if (!value || typeof value !== 'string') throw badRequest(`${fieldName} must be an ISO date string.`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`${fieldName} must be a valid ISO date string.`);
  return d;
}

function startOfCurrentMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function resolveTimeWindow(query) {
  const now = new Date();
  const end = query.end ? parseIsoDate(query.end, 'end') : now;
  if (query.start || query.end) {
    const start = parseIsoDate(query.start, 'start');
    if (start > end) throw badRequest('start must be before end.');
    return { start, end, windowLabel: 'custom' };
  }

  const preset = query.preset;
  if (preset === 'this-month') {
    return { start: startOfCurrentMonthUtc(now), end, windowLabel: 'this-month' };
  }

  const range = query.range || '7d';
  const days = rangeToDays(range);
  if (days === null) throw badRequest('range must be 7d, 30d, or 90d.');
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, windowLabel: range };
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
    const unit = req.query.unit || 'all';
    const { start, end, windowLabel } = resolveTimeWindow(req.query);
    const unitQ = unitFilterQuery(unit);
    const windowMs = end.getTime() - start.getTime();
    const priorEnd = start;
    const priorStart = new Date(start.getTime() - windowMs);

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
      range: windowLabel,
      unit,
      start: start.toISOString(),
      end: end.toISOString(),
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

function granularityGroupConfig(granularity) {
  if (granularity === 'day') {
    return {
      groupId: {
        $dateToString: { format: '%Y-%m-%d', date: timestampExpr(), timezone: 'UTC' },
      },
      sortStage: { $sort: { _id: 1 } },
    };
  }
  if (granularity === 'week') {
    return {
      groupId: {
        year: { $isoWeekYear: { date: timestampExpr(), timezone: 'UTC' } },
        week: { $isoWeek: { date: timestampExpr(), timezone: 'UTC' } },
      },
      sortStage: { $sort: { '_id.year': 1, '_id.week': 1 } },
    };
  }
  return {
    groupId: {
      $dateToString: { format: '%Y-%m', date: timestampExpr(), timezone: 'UTC' },
    },
    sortStage: { $sort: { _id: 1 } },
  };
}

function buildSignalGroupPipeline(match, groupId, sortStage) {
  return [
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
  ];
}

function labelForGranularity(granularity, groupId) {
  if (granularity === 'day') {
    const [y, mo, da] = groupId.split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, da));
    return dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  }
  if (granularity === 'week') return `W${groupId.week}`;
  return formatMonthLabel(groupId);
}

/**
 * GET /analytics/timeseries?range=7d&granularity=day|week|month&unit=all
 */
async function getTimeseries(req, res, next) {
  try {
    const granularity = req.query.granularity || 'day';
    const unit = req.query.unit || 'all';
    const { start, end, windowLabel } = resolveTimeWindow(req.query);
    if (!['day', 'week', 'month'].includes(granularity)) {
      throw badRequest('granularity must be day, week, or month.');
    }

    const unitQ = unitFilterQuery(unit);

    const match = { ...unitQ, ...matchTimeRange(start, end) };

    const { groupId, sortStage } = granularityGroupConfig(granularity);
    const rows = await Event.aggregate(buildSignalGroupPipeline(match, groupId, sortStage));

    const bucketMap = new Map();
    for (const row of rows) {
      const key =
        granularity === 'week'
          ? `${row._id.year}-W${String(row._id.week).padStart(2, '0')}`
          : row._id;
      const label = labelForGranularity(granularity, row._id);
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
      range: windowLabel,
      unit,
      start: start.toISOString(),
      end: end.toISOString(),
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
    const unit = req.query.unit || 'all';
    const { start, end, windowLabel } = resolveTimeWindow(req.query);
    const unitQ = unitFilterQuery(unit);

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

    return res.json({
      ok: true,
      range: windowLabel,
      unit,
      start: start.toISOString(),
      end: end.toISOString(),
      shifts,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /analytics/by-unit?range=7d
 */
async function getByUnit(req, res, next) {
  try {
    const unit = req.query.unit || 'all';
    const { start, end, windowLabel } = resolveTimeWindow(req.query);
    const unitQ = unitFilterQuery(unit);

    const normalizedUnitExpr = {
      $switch: {
        branches: [
          { case: { $in: ['$unitKey', ['icu', 'nicu-a', 'nicu-b']] }, then: 'icu' },
          { case: { $eq: ['$unitKey', 'med-surg'] }, then: 'med-surg' },
          { case: { $eq: ['$unitKey', 'ed'] }, then: 'ed' },
          { case: { $eq: ['$unitKey', 'stepdown'] }, then: 'stepdown' },
          { case: { $eq: ['$unitKey', 'other'] }, then: 'other' },
        ],
        default: 'other',
      },
    };

    const rows = await Event.aggregate([
      { $match: { ...unitQ, ...matchTimeRange(start, end) } },
      {
        $project: {
          unitKeyNormalized: normalizedUnitExpr,
        },
      },
      {
        $group: {
          _id: '$unitKeyNormalized',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const unitLabelMap = {
      icu: 'ICU',
      'med-surg': 'Med surg',
      ed: 'ED',
      stepdown: 'Stepdown',
      other: 'Other',
    };

    const units = rows.map((row) => ({
      key: row._id,
      label: unitLabelMap[row._id] ?? row._id,
      count: row.count,
    }));

    return res.json({
      ok: true,
      range: windowLabel,
      unit,
      start: start.toISOString(),
      end: end.toISOString(),
      units,
    });
  } catch (err) {
    return next(err);
  }
}

async function getRatioTrend(req, res, next) {
  try {
    req.query.granularity = req.query.granularity || 'day';
    const unit = req.query.unit || 'all';
    const granularity = req.query.granularity;
    const { start, end, windowLabel } = resolveTimeWindow(req.query);
    const unitQ = unitFilterQuery(unit);

    const { groupId, sortStage } = granularityGroupConfig(granularity);
    const rows = await Event.aggregate(
      buildSignalGroupPipeline({ ...unitQ, ...matchTimeRange(start, end) }, groupId, sortStage)
    );

    const points = rows.map((row) => {
      const label = labelForGranularity(granularity, row._id);
      const ratio = row.interruptions > 0 ? Number((row.compensations / row.interruptions).toFixed(2)) : 0;
      return { label, interruptions: row.interruptions, compensations: row.compensations, ratio };
    });

    return res.json({
      ok: true,
      granularity,
      range: windowLabel,
      unit,
      start: start.toISOString(),
      end: end.toISOString(),
      points,
    });
  } catch (err) {
    return next(err);
  }
}

async function getActivityFeed(req, res, next) {
  try {
    const unit = req.query.unit || 'all';
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 25)));
    const { start, end, windowLabel } = resolveTimeWindow(req.query);
    const unitQ = unitFilterQuery(unit);

    const [items, total] = await Promise.all([
      Event.find({ ...unitQ, ...matchTimeRange(start, end) })
        .sort({ receivedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Event.countDocuments({ ...unitQ, ...matchTimeRange(start, end) }),
    ]);

    const rows = items.map((e) => {
      const when = e.occurredAt || e.receivedAt;
      return {
        id: e._id.toString(),
        timestamp: when ? new Date(when).toISOString() : null,
        signalType: e.signalType,
        unit: unitLabel(e.unitKey),
        shift: shiftLabel(e.shift),
        noteSnippet: e.note ? String(e.note).slice(0, 80) : '',
        seatLabel: e.unitKey && e.shift ? `${unitLabel(e.unitKey)} · ${shiftLabel(e.shift)}` : null,
      };
    });

    return res.json({
      ok: true,
      range: windowLabel,
      unit,
      start: start.toISOString(),
      end: end.toISOString(),
      page,
      pageSize,
      total,
      items: rows,
    });
  } catch (err) {
    return next(err);
  }
}

function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

async function exportSignalsCsv(req, res, next) {
  try {
    const unit = req.query.unit || 'all';
    const { start, end } = resolveTimeWindow(req.query);
    const unitQ = unitFilterQuery(unit);
    const events = await Event.find({ ...unitQ, ...matchTimeRange(start, end) })
      .sort({ receivedAt: -1 })
      .lean();

    const header = ['timestamp', 'signalType', 'unit', 'shift', 'note', 'seatLabel'];
    const lines = [header.join(',')];
    for (const e of events) {
      const ts = e.occurredAt || e.receivedAt;
      const row = [
        ts ? new Date(ts).toISOString() : '',
        e.signalType || '',
        unitLabel(e.unitKey),
        shiftLabel(e.shift),
        e.note || '',
        e.unitKey && e.shift ? `${unitLabel(e.unitKey)} · ${shiftLabel(e.shift)}` : '',
      ].map(csvEscape);
      lines.push(row.join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="signals-export.csv"');
    return res.status(200).send(lines.join('\n'));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSummary,
  getTimeseries,
  getByShift,
  getByUnit,
  getRatioTrend,
  getActivityFeed,
  exportSignalsCsv,
  unitFilterQuery,
  rangeToDays,
};

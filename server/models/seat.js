const crypto = require('crypto');
const mongoose = require('mongoose');
const { SHIFTS, UNIT_KEYS } = require('./event');

const UNIT_LABELS = {
  icu: 'ICU',
  'med-surg': 'Med surg',
  ed: 'ED',
  stepdown: 'Stepdown',
  other: 'Other',
};

const SHIFT_LABELS = {
  night: 'Night',
  day: 'Day',
  evening: 'Evening',
};

/** Build a human-readable label like "NICU A · Day". */
function buildSeatLabel(unitKey, shift) {
  const u = UNIT_LABELS[unitKey] ?? unitKey;
  const s = SHIFT_LABELS[shift] ?? shift;
  return `${u} · ${s}`;
}

/**
 * Code alphabet excludes visually ambiguous characters (I, O, 0, 1) so codes
 * are easy to read from posters and easy to type on a phone keyboard.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 4) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Build a code like "NICU-A-DAY-7K3F" from the unit/shift + a random suffix. */
function buildSeatCode(unitKey, shift, suffix = randomSuffix()) {
  const unitToken = (UNIT_LABELS[unitKey] ?? unitKey).toUpperCase().replace(/\s+/g, '-');
  const shiftToken = (SHIFT_LABELS[shift] ?? shift).toUpperCase();
  return `${unitToken}-${shiftToken}-${suffix}`;
}

const seatSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    unitKey: {
      type: String,
      enum: UNIT_KEYS,
      required: true,
      index: true,
    },
    shift: {
      type: String,
      enum: SHIFTS,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 200,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

seatSchema.index({ code: 1 }, { unique: true });
seatSchema.index({ unitKey: 1, shift: 1 });

const Seat = mongoose.model('Seat', seatSchema);

module.exports = {
  Seat,
  buildSeatCode,
  buildSeatLabel,
  randomSuffix,
  UNIT_LABELS,
  SHIFT_LABELS,
};

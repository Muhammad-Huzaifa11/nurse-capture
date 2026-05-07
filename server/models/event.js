const mongoose = require('mongoose');

const SIGNAL_TYPES = ['interruption', 'compensation'];
const SHIFTS = ['night', 'day', 'evening'];
const UNIT_KEYS = ['nicu-a', 'nicu-b', 'stepdown', 'other'];

const eventSchema = new mongoose.Schema(
  {
    signalType: {
      type: String,
      enum: SIGNAL_TYPES,
      required: true,
      index: true,
    },
    shift: {
      type: String,
      enum: SHIFTS,
      default: null,
      index: true,
    },
    unitKey: {
      type: String,
      enum: UNIT_KEYS,
      default: null,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    occurredAt: {
      type: Date,
      default: null,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    schemaVersion: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

const Event = mongoose.model('Event', eventSchema);

module.exports = {
  Event,
  SIGNAL_TYPES,
  SHIFTS,
  UNIT_KEYS,
};

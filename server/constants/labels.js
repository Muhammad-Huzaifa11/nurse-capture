const UNIT_LABELS = {
  icu: 'ICU',
  'med-surg': 'Med surg',
  ed: 'ED',
  stepdown: 'Stepdown',
  other: 'Other',
  /** Legacy unit keys from earlier pilots */
  'nicu-a': 'ICU',
  'nicu-b': 'ICU',
};

const SHIFT_LABELS = {
  night: 'Night',
  day: 'Day',
  evening: 'Evening',
};

function unitLabel(unitKey) {
  return UNIT_LABELS[unitKey] || unitKey || 'Unknown';
}

function shiftLabel(shift) {
  return SHIFT_LABELS[shift] || shift || 'Unknown';
}

module.exports = {
  UNIT_LABELS,
  SHIFT_LABELS,
  unitLabel,
  shiftLabel,
};


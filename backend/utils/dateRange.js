const env = require('../config/env');
const ApiError = require('./ApiError');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_RANGE_DAYS = 366;
const RANGE_NAMES = ['today', 'yesterday', 'this_week', 'this_month', 'custom'];

/** Start (00:00 business time) of the day containing `date`, as a UTC Date. */
const startOfBusinessDay = (date, offsetMinutes = env.businessUtcOffsetMinutes) => {
  const offsetMs = offsetMinutes * 60000;
  return new Date(Math.floor((date.getTime() + offsetMs) / DAY_MS) * DAY_MS - offsetMs);
};

/** "YYYY-MM-DD" -> that day's midnight expressed as UTC milliseconds (calendar-validated). */
const parseDateOnly = (value, label) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) throw ApiError.badRequest(`${label} must be in YYYY-MM-DD format`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw ApiError.badRequest(`${label} is not a valid date`);
  }
  return utc.getTime();
};

/**
 * Turns a named range into { range, start, end } where start is inclusive and end is exclusive.
 * Weeks start on Monday. All boundaries follow the shop's timezone (BUSINESS_UTC_OFFSET_MINUTES).
 *
 *   resolveDateRange({ range: 'today' })
 *   resolveDateRange({ range: 'custom', from: '2026-10-01', to: '2026-10-03' })  // "to" is inclusive
 */
const resolveDateRange = (
  { range = 'today', from, to } = {},
  { now = new Date(), offsetMinutes = env.businessUtcOffsetMinutes } = {}
) => {
  const offsetMs = offsetMinutes * 60000;
  const todayStart = startOfBusinessDay(now, offsetMinutes);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

  switch (range) {
    case 'today':
      return { range, start: todayStart, end: tomorrowStart };

    case 'yesterday':
      return { range, start: new Date(todayStart.getTime() - DAY_MS), end: todayStart };

    case 'this_week': {
      const localMidnight = new Date(todayStart.getTime() + offsetMs);
      const daysSinceMonday = (localMidnight.getUTCDay() + 6) % 7;
      return {
        range,
        start: new Date(todayStart.getTime() - daysSinceMonday * DAY_MS),
        end: tomorrowStart,
      };
    }

    case 'this_month': {
      const local = new Date(todayStart.getTime() + offsetMs);
      const startMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offsetMs;
      return { range, start: new Date(startMs), end: tomorrowStart };
    }

    case 'custom': {
      if (!from || !to) throw ApiError.badRequest('Both from and to dates are required for a custom range');

      const startMs = parseDateOnly(from, 'from') - offsetMs;
      const endMs = parseDateOnly(to, 'to') - offsetMs + DAY_MS; // include the whole "to" day

      if (endMs <= startMs) throw ApiError.badRequest('The from date must not be after the to date');
      if ((endMs - startMs) / DAY_MS > MAX_CUSTOM_RANGE_DAYS) {
        throw ApiError.badRequest(`Date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`);
      }
      return { range, start: new Date(startMs), end: new Date(endMs) };
    }

    default:
      throw ApiError.badRequest(`Invalid date range. Use one of: ${RANGE_NAMES.join(', ')}`);
  }
};

/** { start, end } -> MongoDB condition: { createdAt: toDateFilter(range) } */
const toDateFilter = ({ start, end }) => ({ $gte: start, $lt: end });

/** 360 -> "+06:00" (the format MongoDB aggregations expect for the `timezone` option) */
const toTimezoneString = (offsetMinutes = env.businessUtcOffsetMinutes) => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
};

module.exports = {
  RANGE_NAMES,
  DAY_MS,
  startOfBusinessDay,
  resolveDateRange,
  toDateFilter,
  toTimezoneString,
};
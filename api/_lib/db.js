const { sql } = require("@vercel/postgres");

const RESERVATION_PRODUCTION_ROOM_IDS = Array.from({ length: 8 }, (_, index) => `생산실${index + 1}`);

const ensureTables = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS visit_period_stats (
      period_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      total_visits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (period_type, period_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS visit_daily_city_stats (
      period_key TEXT NOT NULL,
      city TEXT NOT NULL,
      total_visits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (period_key, city)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS visit_report_dispatches (
      report_type TEXT NOT NULL,
      report_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_type, report_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interaction_detail_daily_stats (
      period_key TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_label TEXT NOT NULL,
      page_path TEXT NOT NULL,
      total_events INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (period_key, event_name, event_label, page_path)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reservation_users (
      room_id TEXT PRIMARY KEY,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reservation_account_settings (
      room_id TEXT PRIMARY KEY,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      pin_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reservation_bookings (
      id BIGSERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      slot_hour INTEGER NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT reservation_bookings_unique_slot UNIQUE (booking_date, slot_hour)
    )
  `;

  for (const roomId of RESERVATION_PRODUCTION_ROOM_IDS) {
    await sql`
      INSERT INTO reservation_account_settings (room_id)
      VALUES (${roomId})
      ON CONFLICT (room_id) DO NOTHING
    `;
  }
};

const incrementPeriodCount = async (periodType, periodKey, amount) => {
  await sql`
    INSERT INTO visit_period_stats (period_type, period_key, total_visits)
    VALUES (${periodType}, ${periodKey}, ${amount})
    ON CONFLICT (period_type, period_key)
    DO UPDATE SET
      total_visits = visit_period_stats.total_visits + EXCLUDED.total_visits,
      updated_at = NOW()
  `;
};

const incrementCityCount = async (periodKey, city, amount) => {
  await sql`
    INSERT INTO visit_daily_city_stats (period_key, city, total_visits)
    VALUES (${periodKey}, ${city}, ${amount})
    ON CONFLICT (period_key, city)
    DO UPDATE SET
      total_visits = visit_daily_city_stats.total_visits + EXCLUDED.total_visits,
      updated_at = NOW()
  `;
};

const incrementInteractionCount = async (periodKey, eventName, eventLabel, pagePath, amount) => {
  await sql`
    INSERT INTO interaction_detail_daily_stats (period_key, event_name, event_label, page_path, total_events)
    VALUES (${periodKey}, ${eventName}, ${eventLabel}, ${pagePath}, ${amount})
    ON CONFLICT (period_key, event_name, event_label, page_path)
    DO UPDATE SET
      total_events = interaction_detail_daily_stats.total_events + EXCLUDED.total_events,
      updated_at = NOW()
  `;
};

const getPeriodTotal = async (periodType, periodKey) => {
  const { rows } = await sql`
    SELECT total_visits
    FROM visit_period_stats
    WHERE period_type = ${periodType}
      AND period_key = ${periodKey}
    LIMIT 1
  `;

  return rows[0] ? Number(rows[0].total_visits) : 0;
};

const getDailyCityCounts = async (periodKey) => {
  const { rows } = await sql`
    SELECT city, total_visits
    FROM visit_daily_city_stats
    WHERE period_key = ${periodKey}
    ORDER BY total_visits DESC, city ASC
  `;

  return rows.map((row) => ({
    city: String(row.city || "Unknown"),
    count: Number(row.total_visits || 0)
  }));
};

const hasSentReport = async (reportType, reportKey) => {
  const { rows } = await sql`
    SELECT 1
    FROM visit_report_dispatches
    WHERE report_type = ${reportType}
      AND report_key = ${reportKey}
    LIMIT 1
  `;

  return rows.length > 0;
};

const markReportSent = async (reportType, reportKey) => {
  await sql`
    INSERT INTO visit_report_dispatches (report_type, report_key)
    VALUES (${reportType}, ${reportKey})
    ON CONFLICT (report_type, report_key) DO NOTHING
  `;
};

const getReservationUser = async (roomId) => {
  const { rows } = await sql`
    SELECT room_id, pin_salt, pin_hash, created_at, updated_at
    FROM reservation_users
    WHERE room_id = ${roomId}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    roomId: String(row.room_id),
    pinSalt: String(row.pin_salt),
    pinHash: String(row.pin_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const listReservationUserRoomIds = async () => {
  const { rows } = await sql`
    SELECT room_id
    FROM reservation_users
    ORDER BY room_id ASC
  `;

  return rows.map((row) => String(row.room_id));
};

const getReservationAccountSetting = async (roomId) => {
  const { rows } = await sql`
    SELECT room_id, is_active, pin_reset_required, created_at, updated_at
    FROM reservation_account_settings
    WHERE room_id = ${roomId}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return {
      roomId,
      isActive: true,
      pinResetRequired: false,
      createdAt: null,
      updatedAt: null
    };
  }

  return {
    roomId: String(row.room_id),
    isActive: Boolean(row.is_active),
    pinResetRequired: Boolean(row.pin_reset_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const listReservationAccountSettings = async () => {
  const { rows } = await sql`
    SELECT room_id, is_active, pin_reset_required, created_at, updated_at
    FROM reservation_account_settings
    ORDER BY room_id ASC
  `;

  const settingsMap = new Map(
    rows.map((row) => [
      String(row.room_id),
      {
        roomId: String(row.room_id),
        isActive: Boolean(row.is_active),
        pinResetRequired: Boolean(row.pin_reset_required),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    ])
  );

  return RESERVATION_PRODUCTION_ROOM_IDS.map((roomId) =>
    settingsMap.get(roomId) || {
      roomId,
      isActive: true,
      pinResetRequired: false,
      createdAt: null,
      updatedAt: null
    }
  );
};

const setReservationAccountActive = async (roomId, isActive) => {
  const { rows } = await sql`
    INSERT INTO reservation_account_settings (room_id, is_active)
    VALUES (${roomId}, ${isActive})
    ON CONFLICT (room_id)
    DO UPDATE SET
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING room_id, is_active, pin_reset_required, created_at, updated_at
  `;

  const row = rows[0];

  return {
    roomId: String(row.room_id),
    isActive: Boolean(row.is_active),
    pinResetRequired: Boolean(row.pin_reset_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const setReservationAccountPinResetRequired = async (roomId, pinResetRequired) => {
  const { rows } = await sql`
    INSERT INTO reservation_account_settings (room_id, pin_reset_required)
    VALUES (${roomId}, ${pinResetRequired})
    ON CONFLICT (room_id)
    DO UPDATE SET
      pin_reset_required = EXCLUDED.pin_reset_required,
      updated_at = NOW()
    RETURNING room_id, is_active, pin_reset_required, created_at, updated_at
  `;

  const row = rows[0];

  return {
    roomId: String(row.room_id),
    isActive: Boolean(row.is_active),
    pinResetRequired: Boolean(row.pin_reset_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const upsertReservationUser = async (roomId, pinSalt, pinHash) => {
  const { rows } = await sql`
    INSERT INTO reservation_users (room_id, pin_salt, pin_hash)
    VALUES (${roomId}, ${pinSalt}, ${pinHash})
    ON CONFLICT (room_id)
    DO UPDATE SET
      pin_salt = EXCLUDED.pin_salt,
      pin_hash = EXCLUDED.pin_hash,
      updated_at = NOW()
    RETURNING room_id, created_at, updated_at
  `;

  const row = rows[0];

  return {
    roomId: String(row.room_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const listReservationBookings = async (bookingDate) => {
  const { rows } = await sql`
    SELECT id, room_id, booking_date, slot_hour, note, created_at
    FROM reservation_bookings
    WHERE booking_date = ${bookingDate}
    ORDER BY slot_hour ASC, created_at ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  }));
};

const listReservationBookingsInRange = async (dateFrom, dateTo) => {
  const { rows } = await sql`
    SELECT id, room_id, booking_date, slot_hour, note, created_at
    FROM reservation_bookings
    WHERE booking_date >= ${dateFrom}
      AND booking_date <= ${dateTo}
    ORDER BY booking_date ASC, slot_hour ASC, created_at ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  }));
};

const getReservationBookingById = async (bookingId) => {
  const { rows } = await sql`
    SELECT id, room_id, booking_date, slot_hour, note, created_at
    FROM reservation_bookings
    WHERE id = ${bookingId}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  };
};

const createReservationBooking = async (roomId, bookingDate, slotHour, startAt, endAt, note) => {
  const { rows } = await sql`
    INSERT INTO reservation_bookings (room_id, booking_date, slot_hour, start_at, end_at, note)
    VALUES (${roomId}, ${bookingDate}, ${slotHour}, ${startAt}, ${endAt}, ${note})
    RETURNING id, room_id, booking_date, slot_hour, note, created_at
  `;

  const row = rows[0];

  return {
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  };
};

const updateReservationBooking = async (bookingId, roomId, bookingDate, slotHour, startAt, endAt, note) => {
  const { rows } = await sql`
    UPDATE reservation_bookings
    SET room_id = ${roomId},
        booking_date = ${bookingDate},
        slot_hour = ${slotHour},
        start_at = ${startAt},
        end_at = ${endAt},
        note = ${note}
    WHERE id = ${bookingId}
    RETURNING id, room_id, booking_date, slot_hour, note, created_at
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  };
};

const deleteReservationBooking = async (bookingId, roomId) => {
  const { rows } = await sql`
    DELETE FROM reservation_bookings
    WHERE id = ${bookingId}
      AND room_id = ${roomId}
    RETURNING id, room_id, booking_date, slot_hour, note, created_at
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  };
};

const deleteReservationBookingById = async (bookingId) => {
  const { rows } = await sql`
    DELETE FROM reservation_bookings
    WHERE id = ${bookingId}
    RETURNING id, room_id, booking_date, slot_hour, note, created_at
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    roomId: String(row.room_id),
    bookingDate: String(row.booking_date),
    slotHour: Number(row.slot_hour),
    note: String(row.note || ""),
    createdAt: row.created_at
  };
};

const countActiveReservationUsers = async () => {
  const { rows } = await sql`
    SELECT COUNT(*) AS total
    FROM reservation_account_settings account_settings
    INNER JOIN reservation_users users
      ON users.room_id = account_settings.room_id
    WHERE account_settings.is_active = TRUE
      AND account_settings.pin_reset_required = FALSE
  `;

  return Number(rows[0] ? rows[0].total : 0);
};

const countRoomBookingsForWeekSlot = async (roomId, dateFrom, dateTo, slotHour, excludeBookingId = null) => {
  const { rows } = excludeBookingId
    ? await sql`
        SELECT COUNT(*) AS total
        FROM reservation_bookings
        WHERE room_id = ${roomId}
          AND booking_date >= ${dateFrom}
          AND booking_date <= ${dateTo}
          AND slot_hour = ${slotHour}
          AND id <> ${excludeBookingId}
      `
    : await sql`
        SELECT COUNT(*) AS total
        FROM reservation_bookings
        WHERE room_id = ${roomId}
          AND booking_date >= ${dateFrom}
          AND booking_date <= ${dateTo}
          AND slot_hour = ${slotHour}
      `;

  return Number(rows[0] ? rows[0].total : 0);
};

module.exports = {
  countActiveReservationUsers,
  countRoomBookingsForWeekSlot,
  ensureTables,
  createReservationBooking,
  deleteReservationBooking,
  deleteReservationBookingById,
  getReservationAccountSetting,
  getReservationBookingById,
  getReservationUser,
  listReservationUserRoomIds,
  incrementCityCount,
  incrementInteractionCount,
  incrementPeriodCount,
  getPeriodTotal,
  getDailyCityCounts,
  hasSentReport,
  listReservationAccountSettings,
  listReservationBookingsInRange,
  listReservationBookings,
  markReportSent,
  setReservationAccountActive,
  setReservationAccountPinResetRequired,
  updateReservationBooking,
  upsertReservationUser
};

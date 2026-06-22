const {
  countActiveReservationUsers,
  countRoomBookingsForWeekSlot,
  createReservationBooking,
  deleteReservationBooking,
  deleteReservationBookingById,
  ensureTables,
  getReservationAccountSetting,
  getReservationBookingById,
  getReservationUser,
  listReservationBookingsInRange,
  listReservationBookings,
  updateReservationBooking
} = require("../_lib/db");
const {
  OPERATING_HOURS,
  formatDateKeyKst,
  getAuthenticatedSession,
  getSlotEndDate,
  getSlotStartDate,
  isAdminRoomId,
  isAllowedRoomId,
  isValidDateKey,
  parseJsonBody,
  sendJson
} = require("../_lib/reservation");

const getDateFromRequest = (req) => {
  if (req.query && typeof req.query.date === "string") {
    return req.query.date;
  }

  const queryIndex = String(req.url || "").indexOf("?");

  if (queryIndex === -1) {
    return "";
  }

  const params = new URLSearchParams(String(req.url).slice(queryIndex + 1));
  return String(params.get("date") || "");
};

const getRangeFromRequest = (req) => {
  if (req.query && typeof req.query.from === "string" && typeof req.query.to === "string") {
    return {
      dateFrom: req.query.from,
      dateTo: req.query.to
    };
  }

  const queryIndex = String(req.url || "").indexOf("?");

  if (queryIndex === -1) {
    return {
      dateFrom: "",
      dateTo: ""
    };
  }

  const params = new URLSearchParams(String(req.url).slice(queryIndex + 1));

  return {
    dateFrom: String(params.get("from") || ""),
    dateTo: String(params.get("to") || "")
  };
};

const serializeBookings = (bookings, currentRoomId) =>
  bookings.map((booking) => ({
    id: booking.id,
    bookingDate: booking.bookingDate,
    roomId: booking.roomId,
    slotHour: booking.slotHour,
    note: booking.note,
    isMine: booking.roomId === currentRoomId
  }));

const getWeekRange = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  const start = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
  date.setDate(date.getDate() + 6);
  const end = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");

  return { weekStart: start, weekEnd: end };
};

const resolveReservationCap = async (roomId, bookingDate, slotHour, excludeBookingId = null) => {
  const activeUserCount = await countActiveReservationUsers();

  if (!activeUserCount || isAdminRoomId(roomId)) {
    return null;
  }

  const { weekStart, weekEnd } = getWeekRange(bookingDate);
  const maxAllowed = Math.max(1, Math.floor(7 / activeUserCount));
  const existingCount = await countRoomBookingsForWeekSlot(roomId, weekStart, weekEnd, slotHour, excludeBookingId);

  return {
    activeUserCount,
    existingCount,
    maxAllowed,
    weekStart,
    weekEnd
  };
};

const validateReservationCap = async (roomId, bookingDate, slotHour, excludeBookingId = null) => {
  const cap = await resolveReservationCap(roomId, bookingDate, slotHour, excludeBookingId);

  if (!cap) {
    return null;
  }

  if (cap.existingCount >= cap.maxAllowed) {
    return {
      allowed: false,
      message: `같은 주 같은 시간대는 계정당 최대 ${cap.maxAllowed}회까지 예약할 수 있습니다.`
    };
  }

  return {
    allowed: true
  };
};

const validateTargetAccount = async (roomId) => {
  if (isAdminRoomId(roomId)) {
    return {
      allowed: false,
      message: "예약할 계정이 올바르지 않습니다."
    };
  }

  const accountSetting = await getReservationAccountSetting(roomId);

  if (!accountSetting.isActive) {
    return {
      allowed: false,
      message: "비활성화된 계정에는 예약할 수 없습니다."
    };
  }

  const existingUser = await getReservationUser(roomId);

  if (!existingUser || accountSetting.pinResetRequired) {
    return {
      allowed: false,
      message: "가입이 완료된 활성 계정에만 예약할 수 있습니다."
    };
  }

  return {
    allowed: true
  };
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    await ensureTables();

    if (req.method === "GET") {
      const session = getAuthenticatedSession(req);
      const currentRoomId = session ? session.roomId : null;
      const { dateFrom, dateTo } = getRangeFromRequest(req);

      if (dateFrom && dateTo) {
        if (!isValidDateKey(dateFrom) || !isValidDateKey(dateTo) || dateFrom > dateTo) {
          sendJson(res, 400, { message: "조회 기간 형식이 올바르지 않습니다." });
          return;
        }

        const bookings = await listReservationBookingsInRange(dateFrom, dateTo);
        sendJson(res, 200, {
          dateFrom,
          dateTo,
          hours: OPERATING_HOURS,
          bookings: serializeBookings(bookings, currentRoomId)
        });
        return;
      }

      const bookingDate = String(getDateFromRequest(req) || "").trim() || formatDateKeyKst();

      if (!isValidDateKey(bookingDate)) {
        sendJson(res, 400, { message: "날짜 형식이 올바르지 않습니다." });
        return;
      }

      const bookings = await listReservationBookings(bookingDate);
      sendJson(res, 200, {
        bookingDate,
        hours: OPERATING_HOURS,
        bookings: serializeBookings(bookings, currentRoomId)
      });
      return;
    }

    const session = getAuthenticatedSession(req);

    if (!session || !session.roomId) {
      sendJson(res, 401, { message: "로그인이 필요합니다." });
      return;
    }

    const currentRoomId = session.roomId;
    const currentUserIsAdmin = Boolean(session.isAdmin);

    if (req.method === "POST") {
      let payload;

      try {
        payload = parseJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { message: "잘못된 요청 형식입니다." });
        return;
      }

      const bookingDate = String(payload.date || "").trim();
      const slotHour = Number(payload.slotHour);
      const note = String(payload.note || "").trim().slice(0, 80);
      const targetRoomId = currentUserIsAdmin
        ? String(payload.roomId || currentRoomId).trim()
        : currentRoomId;

      if (!isValidDateKey(bookingDate)) {
        sendJson(res, 400, { message: "예약 날짜를 다시 확인해주세요." });
        return;
      }

      if (!OPERATING_HOURS.includes(slotHour)) {
        sendJson(res, 400, { message: "운영 시간 내 슬롯만 예약할 수 있습니다." });
        return;
      }

      if (!targetRoomId) {
        sendJson(res, 400, { message: "예약할 계정을 확인해주세요." });
        return;
      }

      if (!isAllowedRoomId(targetRoomId) || isAdminRoomId(targetRoomId)) {
        sendJson(res, 400, { message: "예약할 계정이 올바르지 않습니다." });
        return;
      }

      const targetAccountValidation = await validateTargetAccount(targetRoomId);

      if (!targetAccountValidation.allowed) {
        sendJson(res, 400, { message: targetAccountValidation.message });
        return;
      }

      const slotStart = getSlotStartDate(bookingDate, slotHour);
      const slotEnd = getSlotEndDate(bookingDate, slotHour);

      if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
        sendJson(res, 400, { message: "예약 시간을 해석하지 못했습니다." });
        return;
      }

      if (slotStart <= new Date()) {
        sendJson(res, 400, { message: "지난 시간대는 예약할 수 없습니다." });
        return;
      }

      const capResult = await validateReservationCap(targetRoomId, bookingDate, slotHour);

      if (capResult && !capResult.allowed) {
        sendJson(res, 409, { message: capResult.message });
        return;
      }

      try {
        const booking = await createReservationBooking(targetRoomId, bookingDate, slotHour, slotStart, slotEnd, note);
        sendJson(res, 201, {
          ok: true,
          booking: {
            id: booking.id,
            roomId: booking.roomId,
            bookingDate: booking.bookingDate,
            slotHour: booking.slotHour,
            note: booking.note,
            isMine: booking.roomId === currentRoomId
          }
        });
      } catch (error) {
        if (error && typeof error === "object" && error.code === "23505") {
          sendJson(res, 409, { message: "이미 예약된 시간입니다." });
          return;
        }

        throw error;
      }

      return;
    }

    if (req.method === "PATCH") {
      if (!currentUserIsAdmin) {
        sendJson(res, 403, { message: "관리자만 예약을 수정할 수 있습니다." });
        return;
      }

      let payload;

      try {
        payload = parseJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { message: "잘못된 요청 형식입니다." });
        return;
      }

      const bookingId = Number(payload.id);
      const bookingDate = String(payload.date || "").trim();
      const slotHour = Number(payload.slotHour);
      const note = String(payload.note || "").trim().slice(0, 80);
      const targetRoomId = String(payload.roomId || "").trim();

      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        sendJson(res, 400, { message: "수정할 예약 정보가 올바르지 않습니다." });
        return;
      }

      if (
        !isValidDateKey(bookingDate)
        || !OPERATING_HOURS.includes(slotHour)
        || !targetRoomId
        || !isAllowedRoomId(targetRoomId)
        || isAdminRoomId(targetRoomId)
      ) {
        sendJson(res, 400, { message: "수정할 예약 정보를 다시 확인해주세요." });
        return;
      }

      const targetAccountValidation = await validateTargetAccount(targetRoomId);

      if (!targetAccountValidation.allowed) {
        sendJson(res, 400, { message: targetAccountValidation.message });
        return;
      }

      const existingBooking = await getReservationBookingById(bookingId);

      if (!existingBooking) {
        sendJson(res, 404, { message: "수정할 예약을 찾지 못했습니다." });
        return;
      }

      const slotStart = getSlotStartDate(bookingDate, slotHour);
      const slotEnd = getSlotEndDate(bookingDate, slotHour);

      if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
        sendJson(res, 400, { message: "예약 시간을 해석하지 못했습니다." });
        return;
      }

      const capResult = await validateReservationCap(targetRoomId, bookingDate, slotHour, bookingId);

      if (capResult && !capResult.allowed) {
        sendJson(res, 409, { message: capResult.message });
        return;
      }

      try {
        const booking = await updateReservationBooking(bookingId, targetRoomId, bookingDate, slotHour, slotStart, slotEnd, note);

        if (!booking) {
          sendJson(res, 404, { message: "수정할 예약을 찾지 못했습니다." });
          return;
        }

        sendJson(res, 200, {
          ok: true,
          booking: {
            id: booking.id,
            roomId: booking.roomId,
            bookingDate: booking.bookingDate,
            slotHour: booking.slotHour,
            note: booking.note,
            isMine: booking.roomId === currentRoomId
          }
        });
      } catch (error) {
        if (error && typeof error === "object" && error.code === "23505") {
          sendJson(res, 409, { message: "이미 예약된 시간입니다." });
          return;
        }

        throw error;
      }

      return;
    }

    if (req.method === "DELETE") {
      let payload;

      try {
        payload = parseJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { message: "잘못된 요청 형식입니다." });
        return;
      }

      const bookingId = Number(payload.id);

      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        sendJson(res, 400, { message: "취소할 예약 정보가 올바르지 않습니다." });
        return;
      }

      const existingBooking = await getReservationBookingById(bookingId);

      if (!existingBooking) {
        sendJson(res, 404, { message: "취소할 예약을 찾지 못했습니다." });
        return;
      }

      const slotStart = getSlotStartDate(existingBooking.bookingDate, existingBooking.slotHour);

      if (!currentUserIsAdmin) {
        if (existingBooking.roomId !== currentRoomId) {
          sendJson(res, 403, { message: "본인 예약만 취소할 수 있습니다." });
          return;
        }

        if (slotStart <= new Date()) {
          sendJson(res, 403, { message: "지난 일정은 관리자만 삭제할 수 있습니다." });
          return;
        }
      }

      const deleted = currentUserIsAdmin
        ? await deleteReservationBookingById(bookingId)
        : await deleteReservationBooking(bookingId, currentRoomId);

      if (!deleted) {
        sendJson(res, 404, { message: "취소할 예약을 찾지 못했습니다." });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    sendJson(res, 405, { message: "Method not allowed" });
  } catch (error) {
    console.error("api/reservation/bookings failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      method: req.method
    });
    sendJson(res, 500, { message: "예약 정보를 처리하지 못했습니다." });
  }
};

const crypto = require("crypto");

const RESERVATION_COOKIE_NAME = "post_haccp_reservation_session";
const SESSION_MAX_AGE_SECONDS = 60 * 5;
const ADMIN_ROOM_ID = "관리자";
const PRODUCTION_ROOM_IDS = Array.from({ length: 8 }, (_, index) => `생산실${index + 1}`);
const ALLOWED_ROOM_IDS = [...PRODUCTION_ROOM_IDS, ADMIN_ROOM_ID];
const OPERATING_HOURS = Array.from({ length: 16 }, (_, index) => index + 6);

const getSessionSecret = () => process.env.RESERVATION_SESSION_SECRET || "post-haccp-reservation-dev-secret";

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const parseJsonBody = (req) => {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  if (typeof req.body === "object") {
    return req.body;
  }

  return {};
};

const parseCookies = (cookieHeader = "") =>
  String(cookieHeader)
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});

const isAllowedRoomId = (roomId) => ALLOWED_ROOM_IDS.includes(roomId);
const isAdminRoomId = (roomId) => roomId === ADMIN_ROOM_ID;

const isValidPin = (pin) => /^\d{4}$/.test(pin);

const hashPin = (pin) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return { salt, hash };
};

const verifyPin = (pin, salt, expectedHash) => {
  const actualHash = crypto.scryptSync(pin, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualHash, expectedBuffer);
};

const createSessionToken = (roomId) => {
  const payload = Buffer.from(
    JSON.stringify({
      roomId,
      issuedAt: Date.now()
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

const readSessionToken = (token) => {
  if (!token || !String(token).includes(".")) {
    return null;
  }

  const [payload, signature] = String(token).split(".");
  const expectedSignature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));

    if (!parsed || !isAllowedRoomId(parsed.roomId)) {
      return null;
    }

    const issuedAt = Number(parsed.issuedAt || 0);

    if (!issuedAt || Date.now() - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) {
      return null;
    }

    return {
      roomId: parsed.roomId,
      issuedAt,
      isAdmin: isAdminRoomId(parsed.roomId)
    };
  } catch (error) {
    return null;
  }
};

const shouldUseSecureCookie = (req) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const host = String(req.headers.host || "");

  if (forwardedProto === "https") {
    return true;
  }

  return !host.startsWith("localhost") && !host.startsWith("127.0.0.1");
};

const buildSessionCookie = (req, token) => {
  const parts = [
    `${RESERVATION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ];

  if (shouldUseSecureCookie(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const buildClearSessionCookie = (req) => {
  const parts = [
    `${RESERVATION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];

  if (shouldUseSecureCookie(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const getAuthenticatedRoomId = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[RESERVATION_COOKIE_NAME];
  const session = readSessionToken(sessionToken);
  return session ? session.roomId : null;
};

const getAuthenticatedSession = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[RESERVATION_COOKIE_NAME];
  return readSessionToken(sessionToken);
};

const requireAuthenticatedRoomId = (req, res) => {
  const roomId = getAuthenticatedRoomId(req);

  if (!roomId) {
    sendJson(res, 401, { message: "로그인이 필요합니다." });
    return null;
  }

  return roomId;
};

const formatDateKeyKst = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
};

const isValidDateKey = (dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey);

const getSlotStartDate = (dateKey, slotHour) =>
  new Date(`${dateKey}T${String(slotHour).padStart(2, "0")}:00:00+09:00`);

const getSlotEndDate = (dateKey, slotHour) =>
  new Date(getSlotStartDate(dateKey, slotHour).getTime() + 60 * 60 * 1000);

module.exports = {
  ADMIN_ROOM_ID,
  ALLOWED_ROOM_IDS,
  OPERATING_HOURS,
  PRODUCTION_ROOM_IDS,
  SESSION_MAX_AGE_SECONDS,
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  formatDateKeyKst,
  getAuthenticatedRoomId,
  getAuthenticatedSession,
  getSlotEndDate,
  getSlotStartDate,
  hashPin,
  isAdminRoomId,
  isAllowedRoomId,
  isValidDateKey,
  isValidPin,
  parseJsonBody,
  requireAuthenticatedRoomId,
  sendJson,
  verifyPin
};

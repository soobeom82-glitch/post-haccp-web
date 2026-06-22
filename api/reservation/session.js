const {
  ALLOWED_ROOM_IDS,
  OPERATING_HOURS,
  PRODUCTION_ROOM_IDS,
  formatDateKeyKst,
  getAuthenticatedSession,
  ADMIN_ROOM_ID,
  isAdminRoomId,
  SESSION_MAX_AGE_SECONDS,
  sendJson
} = require("../_lib/reservation");
const {
  ensureTables,
  getReservationUser,
  listReservationAccountSettings,
  listReservationUserRoomIds
} = require("../_lib/db");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  try {
    const session = getAuthenticatedSession(req);
    await ensureTables();
    const accountSettings = await listReservationAccountSettings();
    const userRoomIds = new Set(await listReservationUserRoomIds());
    const adminUser = await getReservationUser(ADMIN_ROOM_ID);
    const productionAccountStates = PRODUCTION_ROOM_IDS.map((roomId) => {
      const account = accountSettings.find((entry) => entry.roomId === roomId) || {
        roomId,
        isActive: true,
        pinResetRequired: false
      };
      const hasPassword = userRoomIds.has(roomId);
      const needsSetup = account.isActive && (!hasPassword || account.pinResetRequired);
      const canLogin = account.isActive && hasPassword && !account.pinResetRequired;

      return {
        roomId,
        isActive: account.isActive,
        hasPassword,
        pinResetRequired: account.pinResetRequired,
        needsSetup,
        canLogin
      };
    });
    const roomOptions = [
      ...productionAccountStates.filter((account) => account.canLogin).map((account) => account.roomId),
      ...ALLOWED_ROOM_IDS.filter((roomId) => isAdminRoomId(roomId))
    ];

    const loginAccounts = [
      ...productionAccountStates,
      {
        roomId: ADMIN_ROOM_ID,
        isActive: true,
        hasPassword: Boolean(adminUser),
        pinResetRequired: false,
        needsSetup: !adminUser,
        canLogin: Boolean(adminUser)
      }
    ];

    sendJson(res, 200, {
      authenticated: Boolean(session),
      roomId: session ? session.roomId : null,
      isAdmin: Boolean(session && isAdminRoomId(session.roomId)),
      roomOptions,
      accountSettings: productionAccountStates,
      loginAccounts,
      hours: OPERATING_HOURS,
      today: formatDateKeyKst(),
      expiresAt: session ? session.issuedAt + SESSION_MAX_AGE_SECONDS * 1000 : null,
      sessionMaxAgeSeconds: SESSION_MAX_AGE_SECONDS
    });
  } catch (error) {
    console.error("api/reservation/session failed", {
      message: error instanceof Error ? error.message : "unknown_error"
    });
    sendJson(res, 500, { message: "세션 정보를 불러오지 못했습니다." });
  }
};

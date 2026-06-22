const {
  ensureTables,
  listReservationAccountSettings,
  setReservationAccountActive,
  setReservationAccountPinResetRequired
} = require("../_lib/db");
const {
  PRODUCTION_ROOM_IDS,
  getAuthenticatedSession,
  parseJsonBody,
  sendJson
} = require("../_lib/reservation");

const serializeAccounts = (accounts) =>
  PRODUCTION_ROOM_IDS.map((roomId) =>
    accounts.find((account) => account.roomId === roomId) || {
      roomId,
      isActive: true,
      pinResetRequired: false
    }
  );

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const session = getAuthenticatedSession(req);

  if (!session || !session.isAdmin) {
    sendJson(res, 403, { message: "관리자만 계정을 관리할 수 있습니다." });
    return;
  }

  try {
    await ensureTables();

    if (req.method === "GET") {
      const accounts = await listReservationAccountSettings();
      sendJson(res, 200, {
        accounts: serializeAccounts(accounts)
      });
      return;
    }

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH");
      sendJson(res, 405, { message: "Method not allowed" });
      return;
    }

    let payload;

    try {
      payload = parseJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { message: "잘못된 요청 형식입니다." });
      return;
    }

    const roomId = String(payload.roomId || "").trim();

    if (!PRODUCTION_ROOM_IDS.includes(roomId)) {
      sendJson(res, 400, { message: "관리할 계정을 다시 확인해주세요." });
      return;
    }

    if (typeof payload.isActive === "boolean") {
      await setReservationAccountActive(roomId, payload.isActive);
    }

    if (payload.resetPin === true) {
      await setReservationAccountPinResetRequired(roomId, true);
    }

    const accounts = await listReservationAccountSettings();
    sendJson(res, 200, {
      ok: true,
      accounts: serializeAccounts(accounts)
    });
  } catch (error) {
    console.error("api/reservation/accounts failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      method: req.method
    });
    sendJson(res, 500, { message: "계정 설정을 처리하지 못했습니다." });
  }
};

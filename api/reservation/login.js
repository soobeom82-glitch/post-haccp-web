const {
  ensureTables,
  getReservationAccountSetting,
  getReservationUser,
  setReservationAccountPinResetRequired,
  upsertReservationUser
} = require("../_lib/db");
const {
  buildSessionCookie,
  createSessionToken,
  hashPin,
  isAdminRoomId,
  isAllowedRoomId,
  isValidPin,
  parseJsonBody,
  SESSION_MAX_AGE_SECONDS,
  sendJson,
  verifyPin
} = require("../_lib/reservation");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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
  const pin = String(payload.pin || "").trim();
  const confirmPin = String(payload.confirmPin || "").trim();

  if (!isAllowedRoomId(roomId)) {
    sendJson(res, 400, { message: "로그인 가능한 계정을 선택해주세요." });
    return;
  }

  if (!isValidPin(pin)) {
    sendJson(res, 400, { message: "비밀번호는 숫자 4자리여야 합니다." });
    return;
  }

  try {
    await ensureTables();
    const accountSetting = !isAdminRoomId(roomId) ? await getReservationAccountSetting(roomId) : null;
    const existingUser = await getReservationUser(roomId);

    if (!existingUser || (accountSetting && accountSetting.pinResetRequired)) {
      if (!confirmPin) {
        sendJson(res, 409, {
          setupRequired: true,
          message: existingUser
            ? "비밀번호가 초기화되었습니다. 새 비밀번호를 한 번 더 입력해 설정을 완료해주세요."
            : "최초 로그인입니다. 비밀번호를 한 번 더 입력해 설정을 완료해주세요."
        });
        return;
      }

      if (pin !== confirmPin) {
        sendJson(res, 400, { message: "비밀번호가 일치하지 않습니다." });
        return;
      }

      const { salt, hash } = hashPin(pin);
      await upsertReservationUser(roomId, salt, hash);
      if (accountSetting && accountSetting.pinResetRequired) {
        await setReservationAccountPinResetRequired(roomId, false);
      }
    } else if (!verifyPin(pin, existingUser.pinSalt, existingUser.pinHash)) {
      sendJson(res, 401, { message: "비밀번호가 올바르지 않습니다." });
      return;
    }

    res.setHeader("Set-Cookie", buildSessionCookie(req, createSessionToken(roomId)));
    const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
    sendJson(res, 200, {
      ok: true,
      roomId,
      isAdmin: isAdminRoomId(roomId),
      expiresAt,
      sessionMaxAgeSeconds: SESSION_MAX_AGE_SECONDS
    });
  } catch (error) {
    console.error("api/reservation/login failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      roomId
    });
    sendJson(res, 500, { message: "로그인을 처리하지 못했습니다." });
  }
};

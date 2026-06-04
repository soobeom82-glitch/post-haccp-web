module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "텔레그램 연동 설정이 아직 완료되지 않았습니다." }));
    return;
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "잘못된 요청 형식입니다." }));
      return;
    }
  }

  const payload = body && typeof body === "object" ? body : {};
  const phone = String(payload.phone || "").trim();
  const website = String(payload.website || "").trim();

  if (website) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!phone) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "연락처는 필수입니다." }));
    return;
  }

  const company = String(payload.company || "").trim();
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const product = String(payload.product || "").trim();
  const stage = String(payload.stage || "").trim();
  const haccpNeed = String(payload.haccpNeed || "").trim();
  const message = String(payload.message || "").trim();
  const branches = Array.isArray(payload.branches)
    ? payload.branches.map((value) => String(value).trim()).filter(Boolean)
    : [];

  const lines = [
    "새 입점 상담 신청이 접수되었습니다.",
    "",
    `연락처: ${phone}`,
    `회사명: ${company || "-"}`,
    `담당자명: ${name || "-"}`,
    `이메일: ${email || "-"}`,
    `생산 예정 품목: ${product || "-"}`,
    `현재 사업 단계: ${stage || "-"}`,
    `HACCP 인증 필요 여부: ${haccpNeed || "-"}`,
    `관심 지점: ${branches.length ? branches.join(", ") : "-"}`,
    `희망 상담 내용: ${message || "-"}`
  ];

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n")
      })
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      throw new Error("telegram_send_failed");
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: "상담 내용을 전송하지 못했습니다. 잠시 후 다시 시도해주세요." }));
  }
};

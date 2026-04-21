const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const year = document.querySelector("#year");
const form = document.querySelector(".contact-form");
const nextInput = document.querySelector('input[name="_next"]');
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("open", !expanded);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (year) {
  year.textContent = String(new Date().getFullYear());
}

if (form && nextInput) {
  const thanksUrl = new URL("./thanks.html", window.location.href);
  nextInput.value = thanksUrl.toString();
}

if (form && submitButton) {
  form.addEventListener("submit", () => {
    submitButton.disabled = true;
    submitButton.textContent = "문의 전송 중...";
  });
}

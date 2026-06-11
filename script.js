const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const year = document.querySelector("#year");
const carousels = Array.from(document.querySelectorAll("[data-carousel]"));
const branchTabs = Array.from(document.querySelectorAll("[data-branch-tab]"));
const branchPanels = Array.from(document.querySelectorAll("[data-branch-panel]"));
const contactForm = document.querySelector("#contact-form");
const contactFormStatus = document.querySelector("#contact-form-status");
const visitSessionKey = "post-haccp-visit-notified";
let hasTrackedContactFormStart = false;

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

const shouldSendVisitSignal = () => {
  if (window.location.protocol !== "https:" && window.location.protocol !== "http:") {
    return false;
  }

  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return false;
  }

  if (window.sessionStorage.getItem(visitSessionKey) === "1") {
    return false;
  }

  return true;
};

const sendVisitSignal = () => {
  if (!shouldSendVisitSignal()) {
    return;
  }

  const payload = {
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer
  };

  try {
    window.sessionStorage.setItem(visitSessionKey, "1");
  } catch (error) {
    return;
  }

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/visit", blob);
    return;
  }

  fetch("/api/visit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {});
};

const shouldTrackInteraction = () => {
  if (window.location.protocol !== "https:" && window.location.protocol !== "http:") {
    return false;
  }

  const host = window.location.hostname;

  return host !== "localhost" && host !== "127.0.0.1";
};

const sendInteractionEvent = (eventName, eventLabel = "") => {
  if (!shouldTrackInteraction() || !eventName) {
    return;
  }

  const payload = {
    eventName,
    eventLabel,
    path: window.location.pathname
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/event", blob);
    return;
  }

  fetch("/api/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {});
};

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const trackTarget = event.target.closest("[data-track-event]");

  if (!trackTarget) {
    return;
  }

  const eventName = String(trackTarget.dataset.trackEvent || "").trim();
  const eventLabel = String(
    trackTarget.dataset.trackLabel || trackTarget.textContent || ""
  ).replace(/\s+/g, " ").trim().slice(0, 120);

  sendInteractionEvent(eventName, eventLabel);
});

if (branchTabs.length && branchPanels.length) {
  const setActiveBranch = (branchId) => {
    branchTabs.forEach((tabButton) => {
      const isActive = tabButton.dataset.branchTab === branchId;
      tabButton.classList.toggle("is-active", isActive);
      tabButton.setAttribute("aria-selected", String(isActive));
    });

    branchPanels.forEach((panel) => {
      const isActive = panel.dataset.branchPanel === branchId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  };

  branchTabs.forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      setActiveBranch(tabButton.dataset.branchTab);
    });
  });
}

carousels.forEach((carousel) => {
  const carouselTrack = carousel.querySelector(".carousel-track");
  const carouselDots = Array.from(carousel.querySelectorAll(".carousel-dot"));
  const carouselButtons = Array.from(carousel.querySelectorAll(".carousel-button"));
  const captionTitle = carousel.querySelector(".carousel-caption-title");
  const captionAddress = carousel.querySelector(".carousel-caption-address");

  if (!carouselTrack || !carouselDots.length) {
    return;
  }

  const slides = Array.from(carouselTrack.children);

  const syncCaption = (index) => {
    const activeSlide = slides[index];

    if (!activeSlide) {
      return;
    }

    if (captionTitle && activeSlide.dataset.captionTitle) {
      captionTitle.textContent = activeSlide.dataset.captionTitle;
    }

    if (captionAddress && activeSlide.dataset.captionAddress) {
      captionAddress.textContent = activeSlide.dataset.captionAddress;
    }
  };

  const setActiveSlide = (index) => {
    carouselDots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
    syncCaption(index);
  };

  const getSlideIndex = () => {
    const slideWidth = slides[0] ? slides[0].getBoundingClientRect().width : 1;
    const index = Math.round(carouselTrack.scrollLeft / slideWidth);
    return Math.max(0, Math.min(index, slides.length - 1));
  };

  carouselDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      slides[index].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      setActiveSlide(index);
    });
  });

  carouselButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const currentIndex = getSlideIndex();
      const nextIndex = button.dataset.direction === "next"
        ? Math.min(currentIndex + 1, slides.length - 1)
        : Math.max(currentIndex - 1, 0);

      slides[nextIndex].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      setActiveSlide(nextIndex);
    });
  });

  carouselTrack.addEventListener("scroll", () => {
    window.requestAnimationFrame(() => {
      setActiveSlide(getSlideIndex());
    });
  });

  setActiveSlide(0);
});

if (contactForm && contactFormStatus) {
  const submitButton = contactForm.querySelector('button[type="submit"]');

  const setFormStatus = (message, isError = false) => {
    contactFormStatus.textContent = message;
    contactFormStatus.classList.toggle("is-error", isError);
  };

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const phone = String(formData.get("phone") || "").trim();

    if (!phone) {
      setFormStatus("연락처를 입력해주세요.", true);
      return;
    }

    const payload = {
      company: String(formData.get("company") || "").trim(),
      name: String(formData.get("name") || "").trim(),
      phone,
      email: String(formData.get("email") || "").trim(),
      product: String(formData.get("product") || "").trim(),
      stage: String(formData.get("stage") || "").trim(),
      haccpNeed: String(formData.get("haccp_need") || "").trim(),
      branches: formData.getAll("branches").map((value) => String(value).trim()).filter(Boolean),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim()
    };

    setFormStatus("상담 내용을 전송하고 있습니다...");

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "전송에 실패했습니다.");
      }

      contactForm.reset();
      hasTrackedContactFormStart = false;
      sendInteractionEvent("contact_form_submit_success", "무료 상담 신청 완료");
      setFormStatus("상담 접수가 완료되었습니다. 확인 후 연락드리겠습니다.");
    } catch (error) {
      setFormStatus(error instanceof Error ? error.message : "전송 중 문제가 발생했습니다.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  const trackFormStart = () => {
    if (hasTrackedContactFormStart) {
      return;
    }

    hasTrackedContactFormStart = true;
    sendInteractionEvent("contact_form_start", "무료 상담 폼 입력 시작");
  };

  contactForm.addEventListener("focusin", trackFormStart);
  contactForm.addEventListener("input", trackFormStart);
}

sendVisitSignal();

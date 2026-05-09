const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const year = document.querySelector("#year");
const form = document.querySelector(".contact-form");
const nextInput = document.querySelector('input[name="_next"]');
const submitButton = form ? form.querySelector('button[type="submit"]') : null;
const carousels = Array.from(document.querySelectorAll("[data-carousel]"));
const branchTabs = Array.from(document.querySelectorAll("[data-branch-tab]"));
const branchPanels = Array.from(document.querySelectorAll("[data-branch-panel]"));

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

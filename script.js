const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
const themeIcon = document.querySelector(".theme-icon");
const themeLabel = document.querySelector(".theme-label");
const themeColor = document.querySelector('meta[name="theme-color"]');
const nav = document.querySelector(".site-nav");
const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const sections = [...document.querySelectorAll("main section[id]")];

function syncThemeControl() {
  const dark = root.dataset.theme === "dark";
  themeIcon.textContent = dark ? "☼" : "☾";
  themeLabel.textContent = dark ? "Light" : "Dark";
  themeButton.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme",
  );
  themeColor.setAttribute("content", dark ? "#1b2118" : "#fcfbf7");
}

themeButton.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", root.dataset.theme);
  syncThemeControl();
});

function syncNavBorder() {
  nav.classList.toggle("is-scrolled", window.scrollY > 12);
}

const sectionObserver = new IntersectionObserver(
  (entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!active) return;

    sectionLinks.forEach((link) => {
      const isCurrent = link.getAttribute("href") === `#${active.target.id}`;
      if (isCurrent) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  },
  {
    rootMargin: "-18% 0px -64% 0px",
    threshold: [0.08, 0.3, 0.6],
  },
);

sections.forEach((section) => sectionObserver.observe(section));
window.addEventListener("scroll", syncNavBorder, { passive: true });

syncThemeControl();
syncNavBorder();

const paperVideos = [...document.querySelectorAll(".paper-video")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (paperVideos.length && !reduceMotion.matches) {
  const paperVideoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;

        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { rootMargin: "160px 0px", threshold: 0.12 },
  );

  paperVideos.forEach((video) => paperVideoObserver.observe(video));
}

const visitorCountLine = document.querySelector(".visitor-count");
const visitorCountValue = document.querySelector("[data-visitor-count]");
const visitorApiBase = "https://page-views-api.ratneshc.com/api/v1";
const visitorParams = new URLSearchParams({
  site: "divinyan.com",
  path: "/",
}).toString();
const productionHosts = new Set([
  "divinyan.com",
  "www.divinyan.com",
  "lylybig.github.io",
]);

async function syncVisitorCount() {
  if (!visitorCountLine || !visitorCountValue) return;

  try {
    if (productionHosts.has(window.location.hostname)) {
      await fetch(`${visitorApiBase}/track?${visitorParams}`, {
        cache: "no-store",
        keepalive: true,
      });
    }

    const response = await fetch(
      `${visitorApiBase}/views?${visitorParams}`,
      { cache: "no-store" },
    );

    if (!response.ok) throw new Error("Visitor count request failed");

    const data = await response.json();
    const views = Number(data.views);

    if (!Number.isFinite(views) || views < 0) {
      throw new Error("Visitor count response was invalid");
    }

    visitorCountValue.textContent = new Intl.NumberFormat("en-US").format(views);
    visitorCountLine.hidden = false;
  } catch {
    visitorCountLine.hidden = true;
  }
}

syncVisitorCount();

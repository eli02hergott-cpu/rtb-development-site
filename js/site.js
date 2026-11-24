/* Shared helpers + site chrome (header, footer, mobile nav). */
(function () {
  const D = window.RTB;

  const STATUS = {
    available: { label: "Available", hex: "#1f5b3a" },
    contract: { label: "Under contract", hex: "#b3741a" },
    sold: { label: "Sold", hex: "#d2cfc7" },
    planned: { label: "Planned", hex: "#3f6f95" },   // platted, not released for sale yet
    presale: { label: "Presale", hex: "#2e7d5b" },   // open to reserve now, before the lots are finished
    later: { label: "Later release", hex: "#3f6f95" }   // held back; released after the presale lots
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const money = (n) => (n == null ? "Call for pricing" : "$" + Number(n).toLocaleString("en-US"));
  const moneyShort = (n) => (n == null ? "Call" : n >= 1000 ? "$" + Math.round(n / 1000) + "K" : money(n));
  const acres = (a) => (a == null ? "—" : Number(a).toFixed(2) + " ac");
  const sqft = (a) => (a == null ? "—" : Math.round(a * 43560).toLocaleString("en-US") + " sq ft");
  const status = (s) => `<span class="status status-${esc(s)}">${esc(STATUS[s]?.label || s)}</span>`;
  const fullName = (c) => c.name + (c.phase ? " " + c.phase : "");
  const photo = (url) => (url ? ` style="background-image:url('${esc(url)}')"` : "");

  function communityStats(c) {
    const lots = Array.isArray(c.lots) ? c.lots : [];   // past projects use `lots` as a homesite count
    const avail = lots.filter((l) => l.status === "available");
    const prices = avail.map((l) => l.price).filter((p) => p != null);
    return {
      total: lots.length,
      available: avail.length,
      contract: lots.filter((l) => l.status === "contract").length,
      sold: lots.filter((l) => l.status === "sold").length,
      presale: lots.filter((l) => l.status === "presale").length,
      // A community-wide "lots from" price (c.priceFrom) stands in until lots are priced one by one.
      priceFrom: prices.length ? Math.min(...prices) : (c.priceFrom ?? null),
      sizeMin: lots.length ? Math.min(...lots.map((l) => l.acres)) : null,
      sizeMax: lots.length ? Math.max(...lots.map((l) => l.acres)) : null
    };
  }

  /* ---------- chrome ---------- */
  const NAV = [
    { href: "inventory.html", label: "Current Projects", key: "inventory" },
    { href: "projects.html", label: "Past Projects", key: "projects" },
    { href: "about.html", label: "About", key: "about" },
    { href: "contact.html", label: "Contact", key: "contact" }
  ];

  function header(active) {
    return `
      <div class="wrap">
        <a class="brand" href="index.html">RTB <span>Development</span></a>
        <button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h16M3 15h16"/></svg>
        </button>
        <nav class="nav" id="site-nav">
          ${NAV.map((n) => `<a href="${n.href}"${n.key === active ? ' aria-current="page"' : ""}>${n.label}</a>`).join("")}
        </nav>
      </div>`;
  }

  function footer() {
    const c = D.company;
    const offices = c.offices || [];
    return `
      <div class="wrap">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="brand" href="index.html">RTB Development</a>
            ${c.tagline ? `<p>${esc(c.tagline)}</p>` : ""}
          </div>
          <div class="footer-col">
            <h5>Explore</h5>
            <ul>${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
          </div>
          ${offices.length ? `<div class="footer-col wide"><h5>Offices</h5><ul>${offices.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>` : ""}
          <div class="footer-col wide">
            <h5>Contact</h5>
            <ul>
              ${c.emails.map((e) => `<li><a href="mailto:${esc(e)}">${esc(e)}</a></li>`).join("")}
              ${c.phone ? `<li><a href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">${esc(c.phone)}</a></li>` : ""}
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${esc(c.legalName)}</span>
          <span>Availability and pricing subject to change.</span>
        </div>
      </div>`;
  }

  function initChrome() {
    const page = document.body.dataset.page;
    const active = page === "community" ? "inventory" : page;
    document.querySelector(".site-header").innerHTML = header(active);
    document.querySelector(".site-footer").innerHTML = footer();

    // Home header floats over the hero; turn solid once the hero scrolls away.
    if (page === "home") {
      const h = document.querySelector(".site-header");
      const onScroll = () => h.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.6);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    const toggle = document.querySelector(".nav-toggle");
    const nav = document.getElementById("site-nav");
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      document.querySelector(".site-header").classList.toggle("is-solid", open || window.scrollY > window.innerHeight * 0.6);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  window.RTBUI = { STATUS, esc, money, moneyShort, acres, sqft, status, fullName, photo, communityStats };

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("is-in"));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -10% 0px" });
    els.forEach((e) => io.observe(e));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initChrome();
    const page = document.body.dataset.page;
    if (window.RTBPages && window.RTBPages[page]) window.RTBPages[page]();
    initReveal();
  });
})();

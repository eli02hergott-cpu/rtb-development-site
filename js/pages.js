/* Page renderers. Each key matches <body data-page="...">. */
(function () {
  const D = window.RTB;
  const U = window.RTBUI;
  const { esc, money, moneyShort, acres, sqft, status, fullName, communityStats } = U;
  const $ = (s, root = document) => root.querySelector(s);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const PHASE = { selling: "Now selling", presale: "Presaling now", construction: "Under construction", "coming-soon": "Coming soon", completed: "Completed" };
  const slug = (t) => t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Past projects get a page too: give each an id and a "completed" status.
  D.pastProjects.forEach((p) => { p.id = p.id || slug(p.name + (p.phase ? " " + p.phase : "")); p.status = "completed"; });
  const projectHref = (p) => `community.html?id=${encodeURIComponent(p.id)}`;
  const lotsOf = (c) => (Array.isArray(c.lots) ? c.lots : []);
  const allLots = () => D.communities.flatMap(lotsOf);
  const byStatus = (st) => D.communities.filter((c) => c.status === st).length;

  // Street frontage: "50 ft", "≈ 63 ft" when measured from the site plan, or a label such as "On cul-de-sac".
  const frontText = (l) => l.frontageLabel ? esc(l.frontageLabel) : l.frontage ? (l.frontageApprox ? "≈ " : "") + esc(l.frontage) + " ft" : "—";

  // Photo, or an intentional empty slot until one is supplied.
  // `note` = a small disclaimer shown on the photo (e.g. "Artist's rendering ...").
  function tileMedia(name, image, flag = "", note = "") {
    return image
      ? `<div class="tile-media" role="img" aria-label="${esc(name)}">${flag}<div class="img" style="background-image:url('${esc(image)}')"></div>${note ? `<span class="photo-note">${esc(note)}</span>` : ""}</div>`
      : `<div class="tile-media no-photo">${flag}<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="17" cy="17" r="16"/><path d="M17 5v24M5 17h24" opacity=".5"/><path d="M17 7l3 10-3-2-3 2z" fill="currentColor"/></svg><small>Photo coming soon</small></div>`;
  }

  function tileBody(name, location, right) {
    return `
        <div class="tile-body">
          <div><h3>${esc(name)}</h3>${location ? `<p class="tile-loc">${esc(location)}</p>` : ""}</div>
          <div class="tile-meta">${right}<span class="tile-go">→</span></div>
        </div>`;
  }

  function communityTile(c) {
    const s = communityStats(c);
    const flag = s.available ? "" : `<span class="tile-flag phase-${esc(c.status)}">${esc(PHASE[c.status] || "")}</span>`;
    const right = s.available ? `<span class="avail">${s.available} of ${s.total} available</span>`
      : s.presale ? `<span class="avail">${s.presale} of ${s.total} open for presale</span>` : "";
    return `
      <a class="tile reveal" href="${projectHref(c)}">
        ${tileMedia(fullName(c), c.image, flag, c.imageNote)}
        ${tileBody(fullName(c), c.location, right)}
      </a>`;
  }

  function projectTile(p) {
    const name = p.name + (p.phase ? " " + p.phase : "");
    const right = [p.type, p.year].filter(Boolean).map(esc).join(" · ");
    return `
      <a class="tile tile-past reveal" href="${projectHref(p)}">
        ${tileMedia(name, p.image, "", p.imageNote)}
        ${tileBody(name, p.location, right)}
      </a>`;
  }

  /* Shared sortable lot table. rows: [{...lot, community}] */
  function lotTable(tbody, rows, { showCommunity = true, onPick, sort = "price" } = {}) {
    const state = { sort, dir: "asc", filter: () => true };
    const table = tbody.closest("table");
    if (!showCommunity) table.querySelectorAll(".col-comm").forEach((el) => el.remove());

    const sorters = {
      lot: (r) => r.community.name + (r.sortKey || String(r.id).padStart(4, "0")),
      community: (r) => r.community.name,
      acres: (r) => r.acres,
      frontage: (r) => r.frontage,
      price: (r) => (r.price == null ? Infinity : r.price),
      status: (r) => ["available", "presale", "contract", "later", "planned", "sold"].indexOf(r.status)
    };

    function render() {
      const list = rows.filter(state.filter);
      const key = sorters[state.sort];
      list.sort((a, b) => {
        const x = key(a), y = key(b);
        return (x < y ? -1 : x > y ? 1 : 0) * (state.dir === "asc" ? 1 : -1);
      });
      tbody.innerHTML = list.length
        ? list.map((r) => `
          <tr data-community="${esc(r.community.id)}" data-lot="${esc(r.id)}" tabindex="0">
            <td class="lot-id">${esc(r.label ? r.label.replace(/^Lot /, "") : r.id)}</td>
            ${showCommunity ? `<td class="col-comm">${esc(fullName(r.community))}</td>` : ""}
            <td class="num">${acres(r.acres)}</td>
            <td class="num col-front">${frontText(r)}</td>
            <td class="num">${r.status === "sold" ? "Sold" : r.status === "planned" || r.status === "later" ? "TBA" : r.price == null && r.community && r.community.priceFrom ? "From " + money(r.community.priceFrom) : money(r.price)}</td>
            <td>${status(r.status)}</td>
          </tr>`).join("")
        : `<tr><td colspan="6" class="empty">No lots match.</td></tr>`;
      table.querySelectorAll("th button").forEach((b) => {
        if (b.dataset.sort === state.sort) b.dataset.dir = state.dir; else delete b.dataset.dir;
        b.closest("th").setAttribute("aria-sort", b.dataset.sort === state.sort ? (state.dir === "asc" ? "ascending" : "descending") : "none");
      });
      return list.length;
    }

    table.querySelectorAll("th button").forEach((b) => b.addEventListener("click", () => {
      state.dir = state.sort === b.dataset.sort && state.dir === "asc" ? "desc" : "asc";
      state.sort = b.dataset.sort; render();
    }));
    const pick = (e) => {
      const tr = e.target.closest("tr[data-lot]");
      if (tr) onPick(tr.dataset.community, tr.dataset.lot);
    };
    tbody.addEventListener("click", pick);
    tbody.addEventListener("keydown", (e) => { if (e.key === "Enter") pick(e); });

    return { setFilter(fn) { state.filter = fn; return render(); }, render };
  }

  const goToLot = (cid, lid) => { location.href = `community.html?id=${encodeURIComponent(cid)}#lot-${encodeURIComponent(lid)}`; };

  /* ---------------- home ---------------- */
  function home() {
    $("#hero-reel").innerHTML = (D.company.heroImages || [])
      .map((src) => `<div class="shot" style="background-image:url('${esc(src)}')"></div>`).join("");
    $("#communities").innerHTML = D.communities.map(communityTile).join("");
    $("#past").innerHTML = [...D.pastProjects].sort((a, b) => !!b.image - !!a.image).slice(0, 6).map(projectTile).join("");

    const f = D.company.founder;
    if (f) {
      $("#teaser-name").textContent = f.name;
      $("#teaser-text").textContent = (f.bio || [])[0] || "";
    }
  }

  /* ---------------- inventory ---------------- */
  function inventory() {
    const s = allLots().filter((l) => l.status === "available").length;
    $("#summary").textContent = [
      s ? plural(s, "lot", "lots") + " available" : "",
      byStatus("construction") ? byStatus("construction") + " under construction" : "",
      byStatus("presale") ? byStatus("presale") + " presaling now" : "",
      byStatus("coming-soon") ? byStatus("coming-soon") + " coming soon" : ""
    ].filter(Boolean).join(" · ");
    $("#communities").innerHTML = D.communities.map(communityTile).join("");

    const rows = D.communities.flatMap((c) => lotsOf(c).map((l) => ({ ...l, community: c })));
    if (!rows.length) { $("#lots-section").hidden = true; return; }
    const table = lotTable($("#lot-rows"), rows, { onPick: goToLot });
    const f = { status: "available", community: "all" };

    $("#filter-community").innerHTML =
      `<option value="all">All communities</option>` +
      D.communities.filter((c) => lotsOf(c).length).map((c) => `<option value="${esc(c.id)}">${esc(fullName(c))}</option>`).join("");

    function apply() {
      const n = table.setFilter((r) =>
        (f.status === "all" || r.status === f.status || (f.status === "available" && r.status === "presale")) && (f.community === "all" || r.community.id === f.community));
      $("#lot-count").textContent = plural(n, "lot", "lots");
      document.querySelectorAll("#status-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === f.status)));
    }
    $("#status-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      f.status = b.dataset.status; apply();
    });
    $("#filter-community").addEventListener("change", (e) => { f.community = e.target.value; apply(); });
    apply();
  }

  /* ---------------- community ---------------- */

  // Auto-drawn site plan: a street with lots on both sides ending in a
  // cul-de-sac. Replace with a traced plat by giving the community a
  // sitePlan { image, width, height } and each lot a `points` polygon.
  function sitePlanSVG(c) {
    const lots = c.lots;

    if (c.sitePlan && c.sitePlan.image) {
      const w = c.sitePlan.width, h = c.sitePlan.height;
      const shapes = lots.filter((l) => l.points).map((l) => {
        const pts = l.points.trim().split(/\s+/).map((p) => p.split(",").map(Number));
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        // overlay: "outline" = soft status tint over a pre-rendered colored plan, no text labels.
        const sp = c.sitePlan, outline = sp.overlay === "outline";
        return outline
          ? lotShape(l, `<path class="outline" d="M${l.points.trim().split(/\s+/).join(" L")} Z" fill="${U.STATUS[l.status].hex}" stroke="${U.STATUS[l.status].hex}" style="--tint:${+(sp.tint || .35)};--outline:${+(sp.outline || 2)}"/>`, cx, cy, false)
          : lotShape(l, `<path d="M${l.points.trim().split(/\s+/).join(" L")} Z" fill="${U.STATUS[l.status].hex}" fill-opacity=".8"/>`, cx, cy);
      }).join("");
      return `<svg class="site-plan" viewBox="0 0 ${w} ${h}" role="group" aria-label="Site plan of ${esc(fullName(c))}">
        <image href="${esc(c.sitePlan.image)}" width="${w}" height="${h}"/>${shapes}</svg>`;
    }

    const W = 1000, H = 560;
    const topN = Math.ceil(lots.length / 2);
    const top = lots.slice(0, topN);
    const bottom = lots.slice(topN).reverse();
    const roadY = 280, roadH = 52, gap = 8;
    const x0 = 40, x1 = 800;
    const cx = 872, cr = 72;

    function row(group, y, dir) {
      const total = group.reduce((s, l) => s + (l.frontage || 80), 0);
      const avail = x1 - x0 - gap * (group.length - 1);
      let x = x0;
      return group.map((l) => {
        const w = (avail * (l.frontage || 80)) / total;
        const depth = 150 + Math.min(60, (l.acres || .4) * 60);
        const ry = dir < 0 ? y - depth : y;
        const out = lotShape(l, `<rect x="${x.toFixed(1)}" y="${ry.toFixed(1)}" width="${w.toFixed(1)}" height="${depth.toFixed(1)}" fill="${U.STATUS[l.status].hex}"/>`, x + w / 2, ry + depth / 2);
        x += w + gap;
        return out;
      }).join("");
    }

    return `
      <svg class="site-plan" viewBox="0 0 ${W} ${H}" role="group" aria-label="Site plan of ${esc(fullName(c))}">
        <rect x="0" y="${roadY - roadH / 2}" width="${cx}" height="${roadH}" fill="#dcd8cf"/>
        <circle cx="${cx}" cy="${roadY}" r="${cr}" fill="#dcd8cf"/>
        <text x="${(x0 + x1) / 2}" y="${roadY + 4}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" letter-spacing="1" fill="#6f736d">${esc(c.name)}</text>
        ${row(top, roadY - roadH / 2 - 10, -1)}
        ${row(bottom, roadY + roadH / 2 + 10, 1)}
        <g transform="translate(${W - 40} ${H - 44})" font-family="Inter, sans-serif" font-size="11" fill="#6f736d">
          <path d="M0 -14 L6 6 L0 2 L-6 6 Z"/><text y="22" text-anchor="middle">N</text>
        </g>
      </svg>`;
  }

  function lotShape(l, shape, cx, cy, labels = true) {
    return `<g class="lot lot-${esc(l.status)}" data-lot="${esc(l.id)}" tabindex="0" role="button" aria-label="Lot ${esc(l.id)}, ${esc(U.STATUS[l.status].label)}">
      ${shape}${labels ? `
      <text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle">${esc(l.id)}</text>
      <text class="sub" x="${cx.toFixed(1)}" y="${(cy + 24).toFixed(1)}" text-anchor="middle">${esc(acres(l.acres))}</text>` : ""}
    </g>`;
  }

  function community() {
    const id = new URLSearchParams(location.search).get("id");
    const c = D.communities.find((x) => x.id === id) || D.pastProjects.find((x) => x.id === id) || D.communities[0];
    const done = c.status === "completed";
    const s = communityStats(c);
    if (done) {
      $(".crumbs a").href = "projects.html";
      $(".crumbs a").textContent = "Past projects";
      document.querySelector('.nav a[href="projects.html"]')?.setAttribute("aria-current", "page");
      document.querySelector('.nav a[href="inventory.html"]')?.removeAttribute("aria-current");
    }
    document.title = `${fullName(c)} · ${D.company.name}`;

    $("#c-name").textContent = fullName(c);
    $("#c-crumb").textContent = fullName(c);
    $("#c-summary").innerHTML = [
      `<span class="where">${esc([PHASE[c.status], c.location].filter(Boolean).join(" · "))}</span>`,
      done ? "" : esc(c.summary || "")
    ].join("");
    const allPlanned = s.total && c.lots.every((l) => l.status === "planned");
    $("#c-facts").innerHTML = (s.presale && !s.available ? [
      [`${s.presale} of ${s.total}`, "Open for presale"],
      [`${s.sizeMin.toFixed(2)}–${s.sizeMax.toFixed(2)} ac`, "Lot sizes"],
      [s.priceFrom != null ? moneyShort(s.priceFrom) : "Call", "Starting at"],
      [c.acreage ? `${c.acreage} ac` : "", "Total acreage"]
    ] : allPlanned ? [
      [String(c.homesites || s.total), "Planned homesites"],
      [`${s.sizeMin.toFixed(2)}–${s.sizeMax.toFixed(2)} ac`, "Lot sizes"],
      [c.acreage ? `${c.acreage} ac` : "", "Total acreage"]
    ] : s.total ? [
      [`${s.available} / ${s.total}`, "Lots available"],
      [`${s.sizeMin.toFixed(2)}–${s.sizeMax.toFixed(2)} ac`, "Lot sizes"],
      [s.priceFrom != null ? moneyShort(s.priceFrom) : "Call", "Starting at"],
      [c.acreage ? `${c.acreage} ac` : "", "Total acreage"]
    ] : done ? [
      [c.year ? String(c.year) : "", "Completed"],
      [c.lots ? String(c.lots) : "", "Homesites"],
      [c.acreage ? `${c.acreage} ac` : "", "Total acreage"],
      [c.type || "", "Type"]
    ] : [
      [c.acreage ? `${c.acreage} ac` : "", "Total acreage"],
      [c.homesites ? String(c.homesites) : "", "Planned homesites"]
    ]).filter(([v]) => v).map(([v, l]) => `<div><div class="fact-value">${esc(v)}</div><div class="label">${l}</div></div>`).join("");

    $("#c-facts").hidden = !$("#c-facts").children.length;
    $("#features-section").hidden = !(c.highlights || []).length;
    // Project details: [[label, value], ...] from the plats, permits and covenants.
    // Overview: main photo with the subdivision details beside it, first thing under the banner.
    $("#interest-section").hidden = false;
    if (c.map) whereMap(c);
    $("#interest-photo").innerHTML = tileMedia(fullName(c), c.image, "", c.imageNote);
    if ((c.details || []).length) {
      $("#ov-details").hidden = false;
      $("#ov-details").innerHTML = c.details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    }
    if (s.total) {   // projects with a lot map: point down to it
      $("#interest-kicker").textContent = PHASE[c.status] || "";
      $("#interest-title").textContent = "Choose your homesite";
      $("#interest-text").textContent = "Click any lot on the site plan below to see its size and details.";
      $("#interest-btn").href = "#plan-grid";
      $("#interest-btn").textContent = "See the site plan";
    }
    if (c.image) $(".page-head").style.backgroundImage = `url('${c.image}')`;
    // Static site plan image (a colored layout rendering), shown above the photos.
    if (c.layout && c.layout.image) {
      $("#layout-section").hidden = false;
      $("#layout-link").href = c.layout.full || c.layout.image;
      $("#layout-img").src = c.layout.image;
      $("#layout-img").alt = `Site plan of ${fullName(c)}`;
      $("#layout-note").textContent = c.layout.note || "";
    }
    // Gallery entries are image paths, or videos: "x.mp4" or { video, poster }.
    const isVideo = (g) => typeof g === "object" || /\.(mp4|webm|mov)$/i.test(g);
    const gallery = (c.gallery || []).filter((g) => g !== c.image);
    if (gallery.length) {
      $("#gallery-section").hidden = false;
      $("#gallery").innerHTML = gallery.map((g) => {
        if (!isVideo(g)) return gallery.length === 1
          ? `<a href="${esc(g)}" target="_blank" rel="noopener" class="gallery-single"><img src="${esc(g)}" alt="${esc(fullName(c))}" loading="lazy"></a>`   // a lone image (often a plan) is shown whole
          : `<a href="${esc(g)}" target="_blank" rel="noopener" class="gallery-item" style="background-image:url('${esc(g)}')" aria-label="${esc(fullName(c))} photo"></a>`;
        const v = typeof g === "object" ? g : { video: g };
        return `<video class="gallery-video" src="${esc(v.video)}" ${v.poster ? `poster="${esc(v.poster)}"` : ""} controls muted loop playsinline preload="metadata" aria-label="${esc(fullName(c))} aerial video"></video>`;
      }).join("");
    }
    if (!s.total) {
      $("#plan-section").hidden = true;
      $("#lots-section").hidden = true;
      $("#interest-kicker").textContent = PHASE[c.status] || "";
      if (done) {
        $("#interest-title").textContent = fullName(c);
        $("#interest-text").textContent = c.summary || `A completed ${D.company.name} project${c.location ? " in " + c.location : ""}. Looking for lots like these? See what we have underway now.`;
        $("#interest-btn").href = "inventory.html";
        $("#interest-btn").textContent = "See current projects";
      } else if (c.cta) {
        // Per-project call to action, e.g. "Reserve your lot now"
        $("#interest-kicker").textContent = c.cta.kicker || PHASE[c.status] || "";
        $("#interest-title").textContent = c.cta.title;
        $("#interest-text").textContent = c.cta.text || "";
        $("#interest-btn").href = `contact.html?community=${encodeURIComponent(c.id)}${c.cta.intent ? "&intent=" + encodeURIComponent(c.cta.intent) : ""}`;
        $("#interest-btn").textContent = c.cta.button || `Ask about ${c.name}`;
      } else {
        $("#interest-title").textContent = `Interested in ${c.name}?`;
        $("#interest-text").textContent = `Lots at ${c.name} aren't listed yet. Ask about timing, lot sizes and pricing, and we'll keep you posted as it comes together.`;
        $("#interest-btn").href = `contact.html?community=${encodeURIComponent(c.id)}`;
        $("#interest-btn").textContent = `Ask about ${c.name}`;
      }
      $("#c-features").innerHTML = (c.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("");
      return;
    }

    $("#c-legend").innerHTML = (c.legend || ["available", "contract", "sold"]).map((k) => `${status(k)}`).join("") +
      // Extra, non-clickable areas drawn into a rendered plan (e.g. future phases).
      (c.legendExtra || []).map((x) => `<span class="legend-extra"><i style="background:${esc(x.color)}"></i>${esc(x.label)}</span>`).join("");
    $("#c-plan").innerHTML = sitePlanSVG(c);
    if (c.sitePlan && c.sitePlan.note) $("#c-plan").nextElementSibling.textContent = c.sitePlan.note;
    $("#c-features").innerHTML = (c.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("");
    if (c.plat) $("#c-plat").innerHTML = `<a class="text-link" href="${esc(c.plat)}" target="_blank" rel="noopener">Download plat (PDF)</a>`;

    function select(lotId, { scroll } = {}) {
      const l = c.lots.find((x) => x.id === lotId);
      if (!l) return;
      document.querySelectorAll(".site-plan .lot").forEach((g) => g.classList.toggle("is-selected", g.dataset.lot === lotId));
      history.replaceState(null, "", `#lot-${encodeURIComponent(lotId)}`);

      const utilities = l.utilities || c.utilities || [];
      const plat = l.plat || c.plat;
      $("#lot-detail").innerHTML = `
        <div class="top"><div class="name">${esc(l.label || "Lot " + l.id)}</div>${status(l.status)}</div>
        <div class="price">${l.status === "sold" ? "Sold" : l.status === "planned" ? "Coming soon" : l.status === "later" ? "Later release" : l.price == null && c.priceFrom ? "From " + money(c.priceFrom) : money(l.price)}</div>
        <ul class="spec">
          <li><span>Size</span><span>${acres(l.acres)} · ${l.sqft ? Math.round(l.sqft).toLocaleString("en-US") + " sq ft" : sqft(l.acres)}</span></li>
          ${l.phase ? `<li><span>Phase</span><span>${esc(l.phase)}</span></li>` : ""}
          <li><span>Frontage</span><span>${frontText(l)}</span></li>
          ${(l.setbacks || c.setbacks) ? `<li><span>Setbacks</span><span>${esc(l.setbacks || c.setbacks)}</span></li>` : ""}
          ${utilities.length ? `<li><span>Utilities</span><span>${utilities.map(esc).join("<br>")}</span></li>` : ""}
        </ul>
        ${l.notes ? `<p class="note">${esc(l.notes)}</p>` : ""}
        <div class="actions">
          ${l.status !== "sold" ? `<a class="btn" href="contact.html?community=${encodeURIComponent(c.id)}&lot=${encodeURIComponent(l.id)}">Ask about ${esc(l.label || "Lot " + l.id)}</a>` : ""}
          ${plat ? `<a class="btn btn-line" href="${esc(plat)}" target="_blank" rel="noopener">Plat (PDF)</a>` : ""}
        </div>`;
      if (scroll) $("#plan-grid").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const pick = (e) => {
      const el = e.target.closest("[data-lot]");
      if (el) select(el.dataset.lot, { scroll: window.matchMedia("(max-width: 1000px)").matches });
    };
    $("#c-plan").addEventListener("click", pick);
    $("#c-plan").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } });

    const rows = c.lots.map((l) => ({ ...l, community: c }));
    lotTable($("#lot-rows"), rows, { showCommunity: false, sort: "lot", onPick: (_, lid) => select(lid, { scroll: true }) }).render();

    const fromHash = decodeURIComponent((location.hash.match(/^#lot-(.+)$/) || [])[1] || "");
    const first = c.lots.find((l) => l.status === "available") || c.lots.find((l) => l.status === "presale") || c.lots[0];
    select(c.lots.some((l) => l.id === fromHash) ? fromHash : first.id);
  }

  // Location map: the site and nearby landmarks with driving distances (c.map).
  //   map: { site: [lat, lng], places: [{ name, lat, lng, miles, minutes, route: [[lat, lng], ...] }], text, note }
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    css.integrity = "sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=="; css.crossOrigin = "anonymous"; css.referrerPolicy = "no-referrer";
    document.head.appendChild(css);
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      // Subresource integrity: the browser refuses the file if the CDN copy is ever altered.
      s.integrity = "sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g=="; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
      s.onload = ok; s.onerror = fail; document.head.appendChild(s);
    });
  }
  function whereMap(c) {
    const m = c.map;
    $("#where-section").hidden = false;
    $("#where-title").textContent = m.title || `Where ${c.name} is`;
    $("#where-text").textContent = m.text || "";
    $("#where-note").textContent = m.note || "";
    $("#c-map").setAttribute("aria-label", `Map of ${c.name} and nearby places`);
    $("#where-list").innerHTML = m.places.map((p) =>
      `<li><span class="pl">${esc(p.name)}</span><span class="d">${esc(p.miles)} mi · about ${esc(p.minutes)} min</span></li>`).join("");
    loadLeaflet().then(() => {
      const L = window.L;
      const map = L.map("c-map", { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      const pts = [m.site];
      m.places.forEach((p) => {
        if (p.route) L.polyline(p.route, { color: "#6e2230", weight: 3, opacity: .55, dashArray: "6 6" }).addTo(map);
        L.circleMarker([p.lat, p.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#2a2723", fillOpacity: 1 })
          .addTo(map).bindTooltip(`${p.name} · ${p.miles} mi`, { permanent: true, direction: p.label || "right", className: "map-label" });
        pts.push([p.lat, p.lng]);
      });
      L.circleMarker(m.site, { radius: 10, color: "#fff", weight: 3, fillColor: "#6e2230", fillOpacity: 1 })
        .addTo(map).bindTooltip(c.name, { permanent: true, direction: "top", offset: [0, -8], className: "map-label map-label-site" });
      map.fitBounds(L.latLngBounds(pts).pad(0.12));
    }).catch(() => { $("#c-map").hidden = true; });
  }

  /* ---------------- past projects ---------------- */
  function projects() {
    $("#summary").textContent = `${plural(D.pastProjects.length, "completed project", "completed projects")}.`;
    // Projects with photos lead; the rest keep their slot until photos arrive.
    $("#project-index").innerHTML = [...D.pastProjects].sort((a, b) => !!b.image - !!a.image).map(projectTile).join("");
  }

  /* ---------------- about ---------------- */
  function about() {
    const f = D.company.founder;
    if (!f) return;
    const counts = { completed: D.pastProjects.length, current: D.communities.length };
    $("#founder-name").textContent = f.name;
    $("#founder-title").textContent = f.title || "";
    $("#founder-bio").innerHTML = (f.bio || [])
      .map((p) => `<p>${esc(p.replace(/\{(\w+)\}/g, (_, k) => counts[k] ?? ""))}</p>`).join("");
    const ph = $("#founder-photo");
    if (f.photo) {
      ph.style.backgroundImage = `url('${f.photo}')`;
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", f.photoAlt || f.name);
    } else {
      ph.classList.add("no-photo");
      ph.innerHTML = `<span>${esc(f.name)}</span>`;
    }
  }

  /* ---------------- contact ---------------- */
  function contact() {
    const q = new URLSearchParams(location.search);
    const sel = $("#f-community");
    sel.innerHTML = `<option value="">Any</option>` +
      D.communities.map((c) => `<option value="${esc(c.id)}">${esc(fullName(c))}</option>`).join("");
    if (q.get("community")) sel.value = q.get("community");
    if (q.get("intent") === "reserve") {
      const rc = D.communities.find((x) => x.id === q.get("community"));
      if (rc) $("#f-message").value = `I'd like to reserve a lot at ${fullName(rc)}. Please send me the available homesites, sizes and pricing.`;
    }
    if (q.get("lot")) {
      $("#f-lot").value = q.get("lot");
      const c = D.communities.find((x) => x.id === q.get("community"));
      $("#f-message").value = `I'd like more information about Lot ${q.get("lot")}${c ? " in " + fullName(c) : ""}.`;
    }

    $("#c-offices").innerHTML = (D.company.offices || []).map(esc).join("<br>");
    $("#c-emails").innerHTML = D.company.emails.map((e) => `<a href="mailto:${esc(e)}">${esc(e)}</a>`).join("<br>");
    if (D.company.phone) {
      $("#c-phone-row").hidden = false;
      $("#c-phone").innerHTML = `<a href="tel:${esc(D.company.phone.replace(/[^\d+]/g, ""))}">${esc(D.company.phone)}</a>`;
    }

    $("#contact-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = $("#form-status");
      const btn = form.querySelector("button[type=submit]");
      const data = Object.fromEntries(new FormData(form).entries());
      const c = D.communities.find((x) => x.id === data.community);
      data.community = c ? fullName(c) : "Any";

      if (D.company.formEndpoint) {
        msg.className = "form-status"; msg.textContent = "Sending…"; btn.disabled = true;
        try {
          const res = await fetch(D.company.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(data)
          });
          if (!res.ok) throw new Error(res.status);
          form.reset();
          msg.textContent = "Sent. We'll be in touch shortly.";
        } catch {
          msg.className = "form-status error";
          msg.textContent = `Couldn't send. Please email ${D.company.emails[0]} directly.`;
        } finally { btn.disabled = false; }
        return;
      }

      const subject = `Lot inquiry${data.lot ? " — Lot " + data.lot : ""}${c ? " — " + fullName(c) : ""}`;
      const body = [
        `Name: ${data.name}`, `Company: ${data.company || "—"}`, `Email: ${data.email}`, `Phone: ${data.phone || "—"}`,
        `I am a: ${data.role}`, `Community: ${data.community}`, `Lot: ${data.lot || "—"}`, "", data.message
      ].join("\n");
      location.href = `mailto:${D.company.emails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      msg.className = "form-status";
      msg.textContent = "Your email app should open with the message ready to send.";
    });
  }

  window.RTBPages = { home, inventory, community, projects, about, contact };
})();

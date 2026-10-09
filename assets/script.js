/* ============================================================
   CONFIG & STATE
   ============================================================ */
const PEXELS_KEY = "y6WP5reQNH7abdL2uzdLTyV8pq0kMmF3CHf7ZNkiHo98DXIvORUOBSfi";
const SLUG_DEFAULT = "";

let STATES_DATA = [];
let STATES_MAP = {};
let LOCATIONS_SUMMARY_MAP = {};
let LOCATIONS_CACHE = {};
let ALL_VILLAS_MAP = {};
let VILLAS = {};

/* ============================================================
   PEXELS — ONLY for State & Location cards (NEVER for Hotels)
   ============================================================ */
const cache = new Map();
function pexels(q){
  if(!PEXELS_KEY || !q) return Promise.resolve([]);
  const k = "px:v2:" + q;
  if(cache.has(k)) return cache.get(k);

  let hit;
  try {
    const val = sessionStorage.getItem(k);
    if(val){
      const parsed = JSON.parse(val);
      if(Array.isArray(parsed) && parsed.length > 0) hit = parsed;
    }
  } catch(e){}

  const p = hit ? Promise.resolve(hit) :
    fetch("https://api.pexels.com/v1/search?per_page=30&orientation=landscape&query=" + encodeURIComponent(q),
      { headers: { Authorization: PEXELS_KEY } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => {
        const a = (j.photos || []).map(x => ({
          src: x.src.medium || x.src.large,
          full: x.src.original || x.src.large2x,
          alt: x.alt || q
        }));
        if(a.length > 0) {
          try { sessionStorage.setItem(k, JSON.stringify(a)); } catch(e){}
        }
        return a;
      })
      .catch(err => {
        console.warn("[Pexels] Query failed for:", q, err);
        return [];
      });

  cache.set(k, p);
  return p;
}

const destinationPhotos = new Map();
const usedDestinationPhotos = new Set();
const destinationPhotoRequests = new Map();
function destinationPhoto(key, query) {
  if (destinationPhotos.has(key)) return Promise.resolve(destinationPhotos.get(key));
  if (destinationPhotoRequests.has(key)) return destinationPhotoRequests.get(key);
  const request = (async () => {
    for (const search of [query, `${query} scenery`]) {
      const photos = await pexels(search);
      const photo = photos.find(p => !usedDestinationPhotos.has((p.full || p.src).split('?')[0]));
      if (photo) {
        usedDestinationPhotos.add((photo.full || photo.src).split('?')[0]);
        destinationPhotos.set(key, photo);
        return photo;
      }
    }
    return null; // Keep the designed text fallback rather than repeat another destination's photo.
  })();
  destinationPhotoRequests.set(key, request);
  request.finally(() => destinationPhotoRequests.delete(key));
  return request;
}

const io = new IntersectionObserver(es => es.forEach(e => {
  if(!e.isIntersecting) return;
  io.unobserve(e.target);
  hydrate(e.target);
}), { rootMargin: "400px" });

async function hydrate(el){
  if(el.querySelector("img")){
    el.classList.remove("load");
    return;
  }
  const q = el.dataset.target, i = +el.dataset.i || 0;
  if(el.dataset.src){
    return swap(el, el.dataset.src, q, el.dataset.full || el.dataset.src);
  }
  // Pexels allowed ONLY if data-pexels="true" (for state/location cards only)
  if(el.dataset.pexels === "true"){
    const list = el.dataset.destination ? [] : await pexels(q);
    const chosen = el.dataset.destination ? await destinationPhoto(el.dataset.destination, q) : list[i % list.length];
    if(chosen) {
      swap(el, chosen.src, chosen.alt, chosen.full);
      return;
    }
  }
  el.classList.remove("load");
  if(!el.textContent.trim()) el.textContent = q;
}

function swap(el, src, alt, fullSrc){
  if(!el || !el.parentNode) return;
  const im = new Image();
  im.alt = alt || "";
  if(fullSrc) im.dataset.full = fullSrc;
  im.className = el.className.replace(/\b(ph|load)\b/g, "").trim();
  im.style.transition = "filter 0.3s ease, opacity 0.3s ease";
  
  im.onload = () => {
    if(el.parentNode){
      el.replaceWith(im);
      if(fullSrc && fullSrc !== src && !im.closest(".destination-card")){
        const fullIm = new Image();
        fullIm.onload = () => { im.src = fullSrc; };
        fullIm.src = fullSrc;
      }
    }
  };
  im.onerror = () => {
    el.classList.remove("load");
  };
  im.src = src;
}

/* Helper to render image container.
   allowPexels is ONLY true for state & location cards */
function pic(target, i = 0, cls = "", src = "", allowPexels = false) {
  if (src) {
    return `<div class="ph ${cls} has-img" data-target="${esc(target)}" data-i="${i}" data-src="${esc(src)}"><img src="${esc(src)}" alt="${esc(target)}" loading="lazy" data-full="${esc(src)}"></div>`;
  }
  if (allowPexels) {
    return `<div class="ph load ${cls}" data-target="${esc(target)}" data-i="${i}" data-pexels="true"></div>`;
  }
  return `<div class="ph ${cls}" data-target="${esc(target)}" data-i="${i}"></div>`;
}

function gal(target, n = 3, imgs = []) {
  const imgList = (imgs && imgs.length > 0) ? imgs : Array.from({length: n || 1}, () => "");
  const count = imgList.length;

  if (count <= 1) {
    return `<div class="gal one">${pic(target, 0, "", imgList[0] || "", false)}</div>`;
  }

  return `
  <div class="gal feature-thumbs-gal" data-target="${esc(target)}">
    <div class="gal-featured-container">
      <div class="swiper gal-featured-swiper">
        <div class="swiper-wrapper">
          ${imgList.map((imgUrl, i) => `
            <div class="swiper-slide gal-featured-slide">
              <div class="gal-featured-card">
                ${pic(target, i, "gal-featured-ph", imgUrl, false)}
                <div class="gal-featured-overlay">
                  <span class="gal-featured-badge">
                    <i data-lucide="camera"></i> Photo ${i + 1} of ${count}
                  </span>
                  <span class="gal-zoom-hint">
                    <i data-lucide="maximize-2"></i> Click to Expand
                  </span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
        <button class="swiper-nav-btn gal-prev" aria-label="Previous photo" type="button">
          <i data-lucide="chevron-left"></i>
        </button>
        <button class="swiper-nav-btn gal-next" aria-label="Next photo" type="button">
          <i data-lucide="chevron-right"></i>
        </button>
        <div class="swiper-pagination gal-pagination"></div>
      </div>
    </div>
    <div class="gal-thumbs-container">
      <div class="swiper gal-thumbs-swiper">
        <div class="swiper-wrapper">
          ${imgList.map((imgUrl, i) => `
            <div class="swiper-slide gal-thumb-slide ${i === 0 ? 'active-thumb' : ''}" data-index="${i}">
              <div class="gal-thumb-card">
                ${pic(target, i, "gal-thumb-ph", imgUrl, false)}
                <span class="gal-thumb-num">${String(i + 1).padStart(2, '0')}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const chips = a => `<div class="chips">${(a || []).map(x => `<span>${esc(x)}</span>`).join("")}</div>`;
const list = a => `<ul>${(a || []).map(([n, d]) => `<li>${esc(n)} <b>${esc(d)}</b></li>`).join("")}</ul>`;

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ============================================================
   AMENITIES & LUCIDE ICONS
   ============================================================ */
function cleanAmenityList(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = [];
  const seen = new Set();

  for (let item of list) {
    if (!item || typeof item !== "string") continue;
    let s = item.trim();
    
    // Discard scraped concatenated category headers
    if (/(SpacesSwimming|BathroomHair|Bedroom Comforts|EntertainmentWifi|ServicesHousekeeping|OutdoorTerrace|Parking and facilitiesParking|Scenic viewsGarden)/i.test(s)) {
      continue;
    }
    
    // Normalize simple duplicates
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(s);
  }
  return cleaned;
}

function getAmenityMeta(raw) {
  const name = String(raw || "").trim();
  const lower = name.toLowerCase();

  // 1. Leisure, Pool & Water
  if (/pool|swimming|jacuzzi|hot tub|plunge|hydrotherapy|water/i.test(lower)) {
    let icon = "waves";
    if (/jacuzzi|hot tub|hydrotherapy/i.test(lower)) icon = "sparkles";
    return { name, icon, category: "Leisure & Wellness" };
  }

  // 2. Bar & Cocktails
  if (/bar|cocktail|wine|beverage|cask/i.test(lower)) {
    return { name, icon: "wine", category: "Dining & Bar" };
  }

  // 3. Outdoor & Nature
  if (/gazebo|pavilion|terrace|patio|deck|balcony|lawn|garden|outdoor|meadow/i.test(lower)) {
    let icon = "sun";
    if (/lawn|garden|meadow/i.test(lower)) icon = "trees";
    if (/gazebo|pavilion/i.test(lower)) icon = "umbrella";
    return { name, icon, category: "Outdoor & Nature" };
  }

  // 4. Culinary & Kitchen
  if (/chef|kitchen|cooktop|gas|refrigerator|fridge|microwave|toaster|kettle|coffee|dishwasher|crockery|cutlery|dining|silverware|dishes|breakfast/i.test(lower)) {
    let icon = "utensils";
    if (/chef/i.test(lower)) icon = "chef-hat";
    if (/coffee/i.test(lower)) icon = "coffee";
    if (/refrigerator|fridge/i.test(lower)) icon = "refrigerator";
    if (/microwave|toaster/i.test(lower)) icon = "microwave";
    if (/kettle/i.test(lower)) icon = "cup-soda";
    return { name, icon, category: "Culinary & Dining" };
  }

  // 5. Tech & Entertainment
  if (/wifi|wi-fi|internet/i.test(lower)) {
    return { name, icon: "wifi", category: "Tech & Media" };
  }
  if (/tv|television|sound|music|audio|entertainment|game|pool table/i.test(lower)) {
    let icon = "tv";
    if (/game|pool table/i.test(lower)) icon = "gamepad-2";
    if (/music|sound|audio/i.test(lower)) icon = "music";
    return { name, icon, category: "Tech & Media" };
  }

  // 6. Climate & Comfort
  if (/air conditioning|airconditioning|air-conditioning|ac\b|fan|climate/i.test(lower)) {
    let icon = "wind";
    if (/fan/i.test(lower)) icon = "fan";
    return { name, icon, category: "Comfort & Climate" };
  }

  // 7. Staff & Services
  if (/housekeeping|cleaning|staff|host|butler|service/i.test(lower)) {
    return { name, icon: "concierge-bell", category: "Staff & Services" };
  }

  // 8. Pet
  if (/pet/i.test(lower)) {
    return { name, icon: "paw-print", category: "Pet-Friendly" };
  }

  // 9. Parking & Facilities
  if (/parking|garage/i.test(lower)) {
    return { name, icon: "car", category: "Facilities & Access" };
  }
  if (/power backup|generator/i.test(lower)) {
    return { name, icon: "zap", category: "Facilities & Access" };
  }

  // 10. Safety & Security
  if (/cctv|security|guard|surveillance|first aid|fire extinguisher|emergency|hygiene|safety/i.test(lower)) {
    let icon = "shield-check";
    if (/first aid/i.test(lower)) icon = "heart-pulse";
    if (/fire/i.test(lower)) icon = "flame-kindling";
    if (/cctv|surveillance/i.test(lower)) icon = "video";
    return { name, icon, category: "Safety & Security" };
  }

  // 11. Bath & Spa
  if (/bathtub|bath|shower|geyser|hot water|jet spray|commode|towel|soap|shampoo|conditioner|hair dryer|toiletries/i.test(lower)) {
    let icon = "bath";
    if (/shower/i.test(lower)) icon = "shower-head";
    if (/hair dryer/i.test(lower)) icon = "wind";
    if (/geyser|hot water/i.test(lower)) icon = "flame";
    if (/soap|shampoo|conditioner|toiletries/i.test(lower)) icon = "sparkles";
    return { name, icon, category: "Bath & Spa" };
  }

  // 12. Bedroom & Care
  if (/bed|linen|pillow|blanket|wardrobe|hanger|iron|clothes/i.test(lower)) {
    let icon = "bed-double";
    if (/wardrobe|hanger|iron|clothes/i.test(lower)) icon = "shirt";
    return { name, icon, category: "Bedroom & Care" };
  }

  if (/welcome|basket|gift/i.test(lower)) {
    return { name, icon: "gift", category: "Staff & Services" };
  }

  return { name, icon: "sparkles", category: "Curated Inclusions" };
}

function refreshLucide() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    try {
      window.lucide.createIcons();
    } catch(e) {
      console.warn("Lucide render error:", e);
    }
  }
}

function getHighlightIcon(text) {
  const t = String(text || "").toLowerCase();
  if (/bed|room|suite/i.test(t)) return "bed-double";
  if (/living|lounge|hall|salon/i.test(t)) return "sofa";
  if (/bar|drink|cocktail|wine|cask/i.test(t)) return "wine";
  if (/dining|kitchen|cook|culinary|chef|chamber/i.test(t)) return "utensils";
  if (/pool|jacuzzi|water|swim/i.test(t)) return "waves";
  if (/lawn|garden|outdoor|meadow|grounds|terrace|gazebo|pavilion/i.test(t)) return "trees";
  if (/bath|ensuite|shower/i.test(t)) return "bath";
  if (/sq\.?\s*ft|area|acre|spread|acres/i.test(t)) return "maximize-2";
  if (/view|scenic|mountain|sea|beach/i.test(t)) return "sun";
  return "sparkles";
}

function renderOverviewSection(v, spreadNum = 1) {
  const overviewImgs = v.overview_imgs || (v.images && v.images.length >= 3 ? v.images.slice(0, 3) : (v.spaces && v.spaces[0] ? (v.spaces[0].img || v.spaces[0].images || []) : []));
  const overviewCount = overviewImgs.length > 0 ? overviewImgs.length : 1;

  // Curated highlights from v.counts
  const rawCounts = (v.counts && v.counts.length > 0) ? v.counts : [
    `${v.config || "Luxury"} Residence`,
    "Curated Living Lounges",
    "Private Swimming Pool",
    "Landscaped Grounds & Lawns"
  ];

  const highlights = rawCounts.map(item => {
    return {
      text: item,
      icon: getHighlightIcon(item)
    };
  });

  const bedroomsDisplay = (v.suites && v.suites.length > 0)
    ? `${v.suites.length} Suites`
    : (v.config ? v.config : "Private Suites");

  const spacesCount = (v.spaces && v.spaces.length > 0)
    ? `${v.spaces.length} Zones`
    : "Curated";

  const stdGuests = v.std || 12;
  const maxGuests = v.max || (stdGuests + 4);

  return `
  <section class="brochure-spread overview-section" id="overview">
    <div class="spread-header">
      <div>
        <p class="kicker">Brochure Spread 0${spreadNum} · Estate Dossier &amp; Overview</p>
        <h2 class="t">The Estate Overview</h2>
        <div class="overview-sub-meta">
          ${v.code ? `<span class="overview-code-badge"><i data-lucide="shield-check"></i> ${esc(v.code)}</span>` : ""}
          ${v.place ? `<span class="overview-loc-badge"><i data-lucide="map-pin"></i> ${esc(v.place)}</span>` : ""}
          ${v.edition ? `<span class="overview-edition-pill"><i data-lucide="crown"></i> ${esc(v.edition)}</span>` : ""}
        </div>
      </div>
      <div class="spread-num">The Overview</div>
    </div>

    <!-- Editorial 3-Image Gallery Showcase -->
    <div class="overview-gallery-wrapper">
      ${gal(v.name, overviewCount, overviewImgs)}
    </div>

    <!-- Architectural Narrative & Story -->
    <div class="overview-story-card">
      <div class="overview-story-header">
        <span class="kicker">Architectural Narrative &amp; Essence</span>
        ${v.sig ? `<span class="overview-collection-tag">${esc(v.sig)}</span>` : `<span class="overview-collection-tag">Signature Portfolio</span>`}
      </div>
      <p class="overview-summary-text">${esc(v.summary || "A bespoke private sanctuary blending timeless architecture with refined contemporary luxury. Designed for effortless relaxation, lavish entertaining, and unforgettable moments in complete privacy.")}</p>
      
      ${(v.tagA && v.tagA.length) ? `
      <div class="overview-quote-banner">
        <i data-lucide="quote" class="overview-quote-icon"></i>
        <div class="overview-quote-content">
          <p class="overview-quote-primary">“${esc(v.tagA[0])}”</p>
          ${v.tagA[1] ? `<p class="overview-quote-secondary">${esc(v.tagA[1])}</p>` : ""}
        </div>
      </div>` : ""}
    </div>

    <!-- Key Estate Vital Metrics Bar -->
    <div class="overview-stats-grid">
      <div class="stat-card">
        <div class="stat-icon-box"><i data-lucide="users"></i></div>
        <div class="stat-content">
          <div class="stat-val">${stdGuests}</div>
          <div class="stat-label">Standard Capacity</div>
          <div class="stat-sub">Included base guests</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box"><i data-lucide="user-plus"></i></div>
        <div class="stat-content">
          <div class="stat-val">${maxGuests}</div>
          <div class="stat-label">Maximum Guests</div>
          <div class="stat-sub">With extra suite bedding</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box"><i data-lucide="bed-double"></i></div>
        <div class="stat-content">
          <div class="stat-val">${bedroomsDisplay}</div>
          <div class="stat-label">Suites &amp; Bedrooms</div>
          <div class="stat-sub">Luxury ensuite baths</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-box"><i data-lucide="sparkles"></i></div>
        <div class="stat-content">
          <div class="stat-val">${spacesCount}</div>
          <div class="stat-label">Living Spaces</div>
          <div class="stat-sub">Indoor &amp; outdoor zones</div>
        </div>
      </div>
    </div>

    <!-- Key Architectural Highlights Grid -->
    ${highlights.length > 0 ? `
    <div class="overview-highlights-block">
      <div class="overview-highlights-header">
        <div class="overview-highlights-title"><i data-lucide="sparkles"></i> Curated Property Highlights</div>
        <span class="overview-highlights-count">${highlights.length} Highlights</span>
      </div>
      <div class="overview-highlights-grid">
        ${highlights.map(h => `
          <div class="overview-highlight-pill">
            <div class="highlight-icon-box"><i data-lucide="${esc(h.icon)}"></i></div>
            <span class="highlight-text">${esc(h.text)}</span>
          </div>
        `).join("")}
      </div>
    </div>` : ""}
  </section>`;
}

function renderAmenitiesSection(amenitiesList, spreadNum = 1) {
  const items = cleanAmenityList(amenitiesList);
  if (!items || items.length === 0) return "";

  const categorized = items.map(getAmenityMeta);
  const totalCount = items.length;
  const hasExtra = totalCount > 5;

  return `
  <section class="brochure-spread amenities-section" id="amenities">
    <div class="spread-header">
      <div>
        <p class="kicker">Brochure Spread 0${spreadNum} · Inclusions &amp; Comforts</p>
        <h2 class="t">Amenities &amp; Features</h2>
        <p class="lead">Thoughtfully curated comforts, resort-grade leisure facilities, and bespoke private services tailored for an unforgettable stay.</p>
      </div>
      <div class="spread-num">${totalCount} Inclusions</div>
    </div>

    <div class="amenities-grid" id="amenitiesGrid">
      ${categorized.map((item, index) => `
        <div class="amenity-card ${index >= 5 ? 'amenity-extra-mobile' : ''}" data-category="${esc(item.category)}">
          <div class="amenity-icon-wrapper">
            <i data-lucide="${esc(item.icon)}" class="lucide-icon"></i>
          </div>
          <div class="amenity-content">
            <h4 class="amenity-title">${esc(item.name)}</h4>
            <span class="amenity-badge">${esc(item.category)}</span>
          </div>
        </div>
      `).join("")}
    </div>

    ${hasExtra ? `
    <div class="amenities-mobile-actions">
      <button type="button" class="amenities-view-more-btn" id="openAmenitiesModalBtn">
        <span>View all ${totalCount} amenities</span>
        <i data-lucide="arrow-right" class="lucide-icon"></i>
      </button>
    </div>

    <!-- Amenities Mobile Modal -->
    <div class="amenities-modal-backdrop" id="amenitiesModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="amenitiesModalTitle">
      <div class="amenities-modal-dialog">
        <div class="amenities-modal-header">
          <div>
            <span class="amenities-modal-kicker">All Inclusions (${totalCount})</span>
            <h3 class="amenities-modal-title" id="amenitiesModalTitle">Amenities &amp; Features</h3>
          </div>
          <button type="button" class="amenities-modal-close" id="closeAmenitiesModalBtn" aria-label="Close modal">
            <i data-lucide="x" class="lucide-icon"></i>
          </button>
        </div>
        <div class="amenities-modal-body">
          <div class="amenities-modal-grid">
            ${categorized.map(item => `
              <div class="amenity-card modal-variant" data-category="${esc(item.category)}">
                <div class="amenity-icon-wrapper">
                  <i data-lucide="${esc(item.icon)}" class="lucide-icon"></i>
                </div>
                <div class="amenity-content">
                  <h4 class="amenity-title">${esc(item.name)}</h4>
                  <span class="amenity-badge">${esc(item.category)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
    ` : ""}
  </section>`;
}

/* ============================================================
   VILLA SNAPSHOT & ALL IMAGES GALLERY
   ============================================================ */
function renderSnapshotSection(snapshotList, spreadNum = 1) {
  if (!snapshotList || snapshotList.length === 0) return "";

  const introParas = [];
  for (let raw of snapshotList) {
    const s = String(raw || "").trim();
    if (!s) continue;
    // Stop if repetitive room breakdown starts
    if (/^(Bedroom|Bathroom|Living|Bar|Dining|Kitchen|Entertainment|Terrace|Swimming|Garden|Gazebo|Sit-out|Recreation|Moonstone)/i.test(s) && s.length < 90) {
      break;
    }
    introParas.push(s);
  }

  if (introParas.length === 0) return "";

  return `
  <section class="brochure-spread snapshot-section" id="snapshot">
    <div class="spread-header">
      <div>
        <p class="kicker">Brochure Spread 0${spreadNum} · Property Dossier</p>
        <h2 class="t">Villa Snapshot</h2>
        <p class="lead">An architectural narrative and essence of the residence.</p>
      </div>
      <div class="spread-num">Snapshot</div>
    </div>

    <div class="snapshot-narrative">
      ${introParas.map(p => `<p class="lead" style="line-height:1.9;margin-bottom:18px;">${esc(p)}</p>`).join("")}
    </div>
  </section>`;
}



/* ============================================================
   DYNAMIC JSON PARSER FOR LOCATION/* FILES
   ============================================================ */
function convertDefaultJsonToVilla(d, filename = ""){
  const rawTitle = d.title || d.name || "Luxury Villa";
  const titleParts = rawTitle.split("|").map(p => p.trim()).filter(p => p && p.toLowerCase() !== "detail");
  const villaName = titleParts[0] || rawTitle;
  const villaSlug = (filename ? filename.replace(/\.json$/, "") : "") || d.slug || slugify(villaName) || "luxury-villa";

  const imgMap = {};
  (d.spaces || []).forEach(s => {
    if(s.title) imgMap[s.title.trim().toLowerCase()] = s.images || [];
  });

  const secDesc = {};
  (d.description_sections || []).forEach(sec => {
    if(sec.heading) secDesc[sec.heading.trim().toLowerCase()] = (sec.paragraphs || []).join("\n\n");
  });

  function findDesc(keys, fallback = ""){
    for(const k of keys){
      for(const [sk, val] of Object.entries(secDesc)){
        if(sk.includes(k.toLowerCase()) && val) return val;
      }
    }
    return fallback;
  }

  function findImg(title){
    for(const [k, imgs] of Object.entries(imgMap)){
      if(title.toLowerCase().includes(k) || k.includes(title.toLowerCase())){
        return imgs;
      }
    }
    return [];
  }

  const allImgs = (d.images || []).filter(img => typeof img === "string" && !img.includes("elfsightcdn"));
  const heroImg = allImgs[0] || "";

  const bhkMatch = (d.title || "").match(/(\d+)\s*[- ]?BHK/i);
  const bedroomsCount = (bhkMatch ? parseInt(bhkMatch[1]) : 0) || (d.capacity && d.capacity.bedrooms) || (d.rooms && d.rooms.length) || 2;

  let stdOcc = bedroomsCount * 2;
  let maxOcc = stdOcc + 2;
  if (typeof d.capacity === "number") {
    stdOcc = d.capacity;
    maxOcc = d.capacity;
  } else if (d.capacity && typeof d.capacity === "object") {
    stdOcc = d.capacity.standard_occupancy || d.capacity.guests || (bedroomsCount * 2);
    maxOcc = d.capacity.maximum_occupancy || d.capacity.guests || (stdOcc + 4);
  }

  // Build spaces (filter out room duplicates)
  const roomNames = (d.rooms || []).map(r => (r.name || "").toLowerCase().trim());
  const spaces = (d.spaces || []).map((s, idx) => {
    const sTitle = (s.title || "").toLowerCase().trim();
    const isSuite = sTitle.includes("suite") || sTitle.includes("dawn") || sTitle.includes("mist") || sTitle.includes("nine") || roomNames.some(rn => rn && (sTitle === rn || sTitle.startsWith(rn)));
    if(isSuite) return null; // bedroom suites handled separately
    const sDesc = findDesc([s.title], s.description || "");
    const sImgs = (s.images && s.images.length > 0) ? s.images : (allImgs[idx] ? [allImgs[idx]] : []);
    return {
      id: `space-${idx+1}`,
      name: s.title,
      tag: s.title,
      meta: s.details || [s.description || "Luxury Space"],
      desc: sDesc || s.description || "Thoughtfully designed space for comfort and leisure.",
      target: s.title,
      images: sImgs,
      img: sImgs
    };
  }).filter(Boolean);

  // Build suites
  const suites = (d.rooms || []).map((r, idx) => {
    const rDesc = findDesc([`Bedroom ${idx+1}`, r.name], `${r.name} appointed with ${r.bed_type || "King"} bed and luxury fittings.`);
    const bDesc = findDesc([`Bathroom ${idx+1}`], "Spa-inspired ensuite bathroom featuring walk-in shower and luxury fittings.");
    const rImgs = findImg(r.name).length > 0 ? findImg(r.name) : (allImgs[idx + 10] ? [allImgs[idx + 10]] : (allImgs[idx] ? [allImgs[idx]] : []));
    return {
      id: `bedroom-${idx+1}`,
      name: r.name,
      floor: idx >= 4 ? "Ground floor" : "First floor",
      area: idx === 2 || idx === 4 ? "380 sq. ft." : "182 sq. ft.",
      bed: `${r.bed_type || "King"} bed`,
      view: idx % 2 === 0 ? "Garden view" : "Forest & pool view",
      desc: rDesc,
      target: r.name,
      images: rImgs,
      img: rImgs,
      bath: {
        name: `Ensuite Bathroom ${idx+1}`,
        desc: bDesc,
        target: `Bathroom ${idx+1}`
      }
    };
  });

  let cityName = "Gurugram";
  let regionName = "Delhi NCR";
  if (typeof d.location === "string") {
    const parts = d.location.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      cityName = parts[0];
      regionName = parts.slice(1).join(", ");
    } else if (parts.length === 1) {
      cityName = parts[0];
      regionName = parts[0];
    }
  } else if (d.location && typeof d.location === "object") {
    cityName = d.location.city || d.location.name || cityName;
    regionName = d.location.region || d.location.state || regionName;
  }

  const lat = (d.location && d.location.latitude) || (d.coordinates && d.coordinates.latitude) || 28.31501;
  const lng = (d.location && d.location.longitude) || (d.coordinates && d.coordinates.longitude) || 77.18838;

  let attractions = [];
  if (d.location && Array.isArray(d.location.points_of_interest)) {
    attractions = d.location.points_of_interest.map(p => [p.name, `${p.distance_km} km`]);
  }
  if (attractions.length === 0 && Array.isArray(d.description_sections)) {
    for (const sec of d.description_sections) {
      if (Array.isArray(sec.bullets) && sec.bullets.length > 0) {
        const poiBullets = sec.bullets.filter(b => /\bkm\b/i.test(b));
        if (poiBullets.length > 0) {
          attractions = poiBullets.map(b => {
            const parts = b.split(/[-—:]/);
            if (parts.length >= 2) {
              return [parts[0].trim(), parts.slice(1).join(" ").trim()];
            }
            return [b.trim(), ""];
          });
          break;
        }
      }
    }
  }
  if (attractions.length === 0) {
    attractions = [
      ["Damdama Lake Serenity", "7 km · 15 mins"],
      ["Westin Sohna Resort & Spa", "2 km · 5 mins"],
      ["Heritage Transport Museum", "22 km · 30 mins"]
    ];
  }

  const secDep = (d.rules && (d.rules.security_deposit_amount || d.rules.security_deposit)) || 8000;
  const chkIn = (d.rules && d.rules.check_in) || "2:00 PM onwards";
  const chkOut = (d.rules && d.rules.check_out) || "11:00 AM";
  const noise = (d.rules && d.rules.noise) || "10:00 PM to 7:00 AM to preserve neighborhood serenity";
  const petsAllowed = d.rules ? (d.rules.pets_allowed === true || d.rules.pets_allowed === "true") : true;

  const locCode = (cityName || regionName || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
  const cleanVillaWords = (villaName || villaSlug || "").trim().split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()).filter(Boolean);
  const villaCode = cleanVillaWords.length > 1
    ? cleanVillaWords.map(w => w.slice(0, 2)).join("").slice(0, 5)
    : (cleanVillaWords[0] || "").slice(0, 4);

  return {
    code: d.code || `ADO-${locCode}${villaCode}`,
    slug: villaSlug,
    name: villaName,
    edition: "Exclusive Adopremium Edition",
    sig: "Signature Manor Collection",
    config: `${bedroomsCount}-BHK`,
    place: `${cityName}, ${regionName}`,
    cityName: cityName,
    citySlug: slugify(cityName),
    stateName: regionName,
    stateSlug: slugify(regionName),
    tagA: [
      "A Private Realm of Elegance & Serenity",
      "Where Timeless Luxury Meets Boundless Comfort"
    ],
    tagB: [
      `${bedroomsCount}-BHK Manor with Private Pool & Jacuzzis`,
      "Adopremium Signature Edition"
    ],
    hero: `${villaName} luxury swimming pool`,
    hero_img: heroImg,
    images: allImgs,
    overview_imgs: allImgs.slice(0, 3),
    summary: d.summary || "",
    std: stdOcc,
    max: maxOcc,
    counts: [
      `${bedroomsCount} Bedrooms`,
      "Grand Living Lounges",
      "Indoor Bar & Dining",
      "Private Swimming Pool",
      "Lush Landscaped Grounds"
    ],
    amenities: (d.amenities && d.amenities.length > 0) ? cleanAmenityList(d.amenities) : [
      "Private Swimming Pool",
      "Integrated Jacuzzi",
      "Indoor Bar",
      "Gazebo",
      "Chef on Call",
      "Wi-Fi",
      "Air Conditioning",
      "Housekeeping Staff"
    ],
    spaces: spaces.length > 0 ? spaces : [],
    suites: suites.length > 0 ? suites : [],
    location: {
      map: `https://www.google.com/maps?q=${lat},${lng}&output=embed`,
      attractions: attractions.length > 0 ? attractions : [
        ["Damdama Lake Serenity", "7 km · 15 mins"],
        ["Westin Sohna Resort & Spa", "2 km · 5 mins"],
        ["Heritage Transport Museum", "22 km · 30 mins"]
      ],
      dining: [
        ["Airia Mall & Dining Promenade", "17 km · 20 mins"],
        ["Under The Neem Farm-to-Table Dining", "8 km · 12 mins"],
        ["ITC Grand Bharat Fine Dining", "18 km · 25 mins"]
      ],
      transfers: [
        ["Nearest Railway Station – Ballabhgarh", "28 km · 40 mins"],
        ["Indira Gandhi Intl Airport (DEL)", "60 km · 65 mins"],
        ["Sohna-Gurgaon Expressway Access", "5 km · 8 mins"]
      ]
    },
    experiences: [
      { name: "Sundowner Cocktails by the Pool", target: "sunset pool cocktails", img: heroImg, paid: false },
      { name: "Private Chef Curated BBQ & Lawn Dinner", target: "barbecue grill outdoor dining", img: allImgs[3] || heroImg, paid: true },
      { name: "Local Scenic Nature Excursion", target: "scenic travel landscape", img: allImgs[2] || heroImg, paid: true },
      { name: "In-Villa Spa & Hydrotherapy", target: "spa massage oils serene", img: allImgs[11] || heroImg, paid: true }
    ],
    rules: [
      ["Check-in", chkIn],
      ["Check-out", chkOut],
      ["Quiet hours", noise],
      ["Pet Policy", petsAllowed ? "Pets welcome! Please observe standard cleanliness rules." : "Pets not allowed."],
      ["Security deposit", `₹${secDep} collected at check-in (Refundable post-inspection)`],
      ["Smoking & Tobacco", "Smoking prohibited indoors; outdoor designated areas only."],
      ["Occupancy Limits", `Standard occupancy: ${stdOcc} guests | Maximum occupancy: ${maxOcc} guests`]
    ],
    guests: [
      "Celebrity Spotting & VIP Getaways",
      "Filmmakers & Creative Tastemakers",
      "Featured in Luxury Travel Journals",
      "Private High-Profile Escapes"
    ],
    snapshot: (d.villa_snapshot && Array.isArray(d.villa_snapshot))
      ? d.villa_snapshot.filter(s => s && typeof s === "string" && s.trim() !== "Villa Snapshot" && s.trim() !== "Property snapshot" && s.trim() !== "Show Less")
      : []
  };
}

/* Build dynamic portfolio tree ONLY from loaded location/*.json files */
function buildPortfolioFromLocationJsons(jsonList){
  STATES_DATA = [];
  STATES_MAP = {};
  LOCATIONS_SUMMARY_MAP = {};
  LOCATIONS_CACHE = {};
  ALL_VILLAS_MAP = {};
  VILLAS = {};

  const stateGroups = {};

  jsonList.forEach(({ data, filename }) => {
    if(!data) return;
    const v = convertDefaultJsonToVilla(data, filename);

    const sSlug = v.stateSlug;
    const cSlug = v.citySlug;
    const vSlug = v.slug;

    if(!stateGroups[sSlug]){
      stateGroups[sSlug] = {
        name: v.stateName,
        slug: sSlug,
        tagline: `Explore handpicked luxury villas and private estates in ${v.stateName}.`,
        hero: `${v.stateName} luxury travel architecture landscape`,
        locations: {}
      };
    }

    const sg = stateGroups[sSlug];
    if(!sg.locations[cSlug]){
      sg.locations[cSlug] = {
        name: v.cityName,
        slug: cSlug,
        state_name: v.stateName,
        state_slug: sSlug,
        hero: `${v.cityName} luxury villa landscape`,
        villas: []
      };
    }

    sg.locations[cSlug].villas.push({
      id: v.code || vSlug,
      slug: vSlug,
      name: v.name,
      hero: v.hero_img || (v.images && v.images[0]) || "",
      images: v.images || [],
      bhk: v.config,
      std: v.std,
      max: v.max,
      pool: (v.counts && v.counts[3]) || "Private Pool"
    });

    // Store in global lookup
    VILLAS[vSlug] = v;
    VILLAS[slugify(v.name)] = v;
    if(v.code) VILLAS[v.code.toLowerCase()] = v;
    if(filename) {
      VILLAS[filename] = v;
      VILLAS[filename.replace(/\.json$/, "")] = v;
    }
  });

  // Assemble STATES_DATA & Map
  Object.values(stateGroups).forEach(st => {
    const locsArray = Object.values(st.locations).map(loc => {
      loc.villa_count = loc.villas.length;
      return loc;
    });

    st.total_locations = locsArray.length;
    st.total_villas = locsArray.reduce((acc, l) => acc + l.villa_count, 0);
    st.locations = locsArray;

    STATES_DATA.push(st);
    STATES_MAP[st.slug] = st;

    locsArray.forEach(loc => {
      LOCATIONS_SUMMARY_MAP[loc.slug] = loc;
      LOCATIONS_CACHE[loc.slug] = loc;
      loc.villas.forEach(vl => {
        ALL_VILLAS_MAP[vl.slug] = {
          villa: VILLAS[vl.slug],
          loc: loc,
          state: { slug: st.slug, name: st.name }
        };
      });
    });
  });

  // Set default fallback villa
  const allKeys = Object.keys(VILLAS);
  if(allKeys.length > 0){
    VILLAS["default"] = VILLAS[allKeys[0]];
  }
}

/* ============================================================
   RENDER PAGES
   ============================================================ */
const app = document.getElementById("app"),
      nav = document.getElementById("nav"),
      side = document.getElementById("side");

function setSideHeader(title, sub){
  const t = document.getElementById("sTitle");
  const s = document.getElementById("sSub");
  if(t) t.textContent = title || "";
  if(s) s.textContent = sub || "";
}

function setHeaderBreadcrumb(items = []){
  const el = document.getElementById("headerBreadcrumb");
  if(!el) return;
  if(!items || items.length === 0){
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  if (window.innerWidth <= 960) {
    el.style.display = "none";
  } else {
    el.style.display = "flex";
  }

  const chevronSvg = `<span class="breadcrumb-sep" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m9 18 6-6-6-6"/></svg></span>`;

  el.innerHTML = items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    const isState = idx === 0 && items.length > 1;
    const isLocation = idx === 1 && items.length > 2;
    const extraClass = isState ? " state-crumb" : (isLocation ? " loc-crumb" : "");

    const crumbHtml = item.url && !isLast
      ? `<a href="${item.url}" class="breadcrumb-item${extraClass}" title="${esc(item.label)}">${esc(item.label)}</a>`
      : `<span class="breadcrumb-item current${extraClass}" title="${esc(item.label)}">${esc(item.label)}</span>`;

    return idx === 0 ? crumbHtml : `${chevronSvg}${crumbHtml}`;
  }).join("");
}

function renderMobBottomNav({ stateSlug = "", stateName = "", locSlug = "", locName = "", currentLevel = "home" } = {}) {
  const el = document.getElementById("mobBottomNav");
  if (!el) return;

  const items = [];

  // 1. Home
  items.push(`
    <a href="#/" class="mob-bottom-item ${currentLevel === 'home' ? 'active' : ''}" title="Home / All States">
      <i data-lucide="home"></i>
      <span>Home</span>
    </a>
  `);

  // 2. State
  if (stateSlug && stateName) {
    items.push(`
      <a href="#/state/${stateSlug}" class="mob-bottom-item ${currentLevel === 'state' ? 'active' : ''}" title="${esc(stateName)}">
        <i data-lucide="map"></i>
        <span>${esc(stateName)}</span>
      </a>
    `);
  }

  // 3. Location
  if (locSlug && locName) {
    items.push(`
      <a href="#/location/${locSlug}" class="mob-bottom-item ${currentLevel === 'location' ? 'active' : ''}" title="${esc(locName)}">
        <i data-lucide="map-pin"></i>
        <span>${esc(locName)}</span>
      </a>
    `);
  }

  items.push(`<button type="button" data-contact="call" class="mob-bottom-item"><i data-lucide="phone"></i><span>Call</span></button>`);
  items.push(`<button type="button" data-contact="email" class="mob-bottom-item"><i data-lucide="mail"></i><span>Email</span></button>`);
  items.push(`<button type="button" class="mob-bottom-item" onclick="location.reload()"><i data-lucide="lock-keyhole"></i><span>Lock</span></button>`);
  el.innerHTML = items.join("");
  el.querySelectorAll(".active").forEach(a => a.setAttribute("aria-current", "page"));
}

/* Shared destination directory: independent of the villa brochure layout. */
function renderDirectory({eyebrow, title, description, back, items, searchLabel, stats}) {
  app.classList.remove("villa-brochure");
  app.innerHTML = `<section class="destination-directory">
    <div class="directory-intro">
      <div><a class="directory-back" href="${back.href}">${esc(back.label)} <span aria-hidden="true">↗</span></a>
        <p class="kicker">${esc(eyebrow)}</p><h1>${esc(title)}</h1>
        <p class="directory-description">${esc(description)}</p></div>
      <div class="directory-stats">${stats.map(x=>`<div><strong>${x.value}</strong><span>${esc(x.label)}</span></div>`).join('')}</div>
    </div>
    <div class="directory-toolbar"><div><p class="kicker">Discover your next escape</p><p id="directoryCount" role="status" aria-live="polite"></p></div>
      <div class="directory-search"><i data-lucide="search" aria-hidden="true"></i><label class="visually-hidden" for="directorySearch">${esc(searchLabel)}</label><input id="directorySearch" type="search" placeholder="${esc(searchLabel)}" autocomplete="off"></div>
    </div>
    <div class="destination-grid">${items.map((item,i)=>`<a class="destination-card" href="${item.href}" data-search="${esc((item.name+' '+(item.search||'')).toLowerCase())}">
      <div class="destination-media">${item.query ? `<div class="ph load destination-photo" data-target="${esc(item.query)}" data-destination="${esc(item.href)}" data-pexels="true"><span>${esc(item.name)}</span></div>` : pic(item.name,0,'destination-photo',item.image||'',false)}<span class="destination-number">${String(i+1).padStart(2,'0')} / COLLECTION</span><span class="destination-badge">${esc(item.badge)}</span></div>
      <div class="destination-body"><p class="destination-eyebrow">${esc(item.eyebrow)}</p><div class="destination-title"><h2>${esc(item.name)}</h2><span class="destination-arrow" aria-hidden="true">↗</span></div><p>${esc(item.description)}</p><div class="destination-footer"><span>${esc(item.detail)}</span><span>${esc(item.cta)} <span aria-hidden="true">→</span></span></div></div>
    </a>`).join('')}</div>
    <div class="directory-empty" hidden><i data-lucide="search-x"></i><h2>No destinations found</h2><p>Try a different name or clear your search to explore the collection.</p><button type="button" id="clearDirectorySearch">Clear search</button></div>
    <p class="directory-note">A place for every kind of escape. A stay to make your own.</p>
  </section>`;
  const input = document.getElementById('directorySearch');
  const filter = () => {
    let count = 0;
    app.querySelectorAll('.destination-card').forEach(card => {
      card.hidden = !card.dataset.search.includes(input.value.trim().toLowerCase());
      if (!card.hidden) count++;
    });
    document.getElementById('directoryCount').textContent = `${count} of ${items.length} ${items.length === 1 ? 'destination' : 'destinations'}`;
    app.querySelector('.directory-empty').hidden = count > 0;
  };
  input.addEventListener('input',filter);
  document.getElementById('clearDirectorySearch').addEventListener('click',()=>{input.value='';filter();input.focus()});
  filter();
  observe();
  window.scrollTo(0,0);
}

/* 1. STATE-WISE MAIN PAGE (LEVEL 1) */
function home(){
  document.title = "Adopremium — Luxury Villa Portfolio";
  const totalV = STATES_DATA.reduce((a, s) => a + s.total_villas, 0);
  setSideHeader("Adopremium", `${STATES_DATA.length} ${STATES_DATA.length === 1 ? 'State' : 'States'} · ${totalV} ${totalV === 1 ? 'Villa' : 'Villas'}`);
  setHeaderBreadcrumb([
    { label: "States", url: "" }
  ]);
  renderMobBottomNav({ currentLevel: 'home' });

  // Sidebar navigation lists states
  nav.innerHTML = `
    <div class="nav-section-title">
      <span class="nav-icon"><i data-lucide="map"></i></span>
      <span class="nav-text">States &amp; Regions</span>
    </div>
    ${STATES_DATA.map(st=>`
      <a href="#/state/${st.slug}" title="${esc(st.name)} (${st.total_villas})">
        <span class="nav-icon"><i data-lucide="map-pin"></i></span>
        <span class="nav-text">${esc(st.name)} <small style="color:var(--mute)">(${st.total_villas})</small></span>
      </a>
    `).join("")}
  `;

  renderDirectory({
    eyebrow: 'The ADO destination collection', title: 'Somewhere extraordinary.',
    description: 'From slow mornings in the hills to sunlit days by the pool. Discover a destination, then find a place to call your own.',
    back: {href:'#/',label:'Adopremium / India'}, searchLabel:'Search a state or location',
    stats:[{value:STATES_DATA.length,label:'States & regions'},{value:totalV,label:'Private villas'}],
    items: STATES_DATA.map(st=>({name:st.name,href:`#/state/${st.slug}`,query:st.hero,
      search:st.locations.map(l=>l.name).join(' '),badge:`${st.total_villas} ${st.total_villas===1?'villa':'villas'}`,
      eyebrow:'India / State & region',description:st.locations.map(l=>l.name).join(' · '),
      detail:`${st.total_locations} ${st.total_locations===1?'location':'locations'} to explore`,cta:'Explore region'}))
  });
}

/* 2. STATE LOCATIONS PAGE (LEVEL 2) */
function statePage(stateSlug){
  const st = STATES_MAP[stateSlug];
  if(!st) return notFound(stateSlug);

  document.title = `${st.name} Luxury Villas — Adopremium`;
  setSideHeader(st.name, `${st.total_locations} Locations · ${st.total_villas} Villas`);
  setHeaderBreadcrumb([
    { label: "States", url: "#/" },
    { label: st.name, url: "" }
  ]);
  renderMobBottomNav({ stateSlug: st.slug, stateName: st.name, currentLevel: 'state' });

  // Sidebar navigation
  nav.innerHTML = `
    <div class="nav-section-title">
      <span class="nav-icon"><i data-lucide="map-pin"></i></span>
      <span class="nav-text">${esc(st.name)} Locations</span>
    </div>
    ${st.locations.map(l=>`
      <a href="#/location/${l.slug}" title="${esc(l.name)} (${l.villa_count})">
        <span class="nav-icon"><i data-lucide="compass"></i></span>
        <span class="nav-text">${esc(l.name)} <small style="color:var(--mute)">(${l.villa_count})</small></span>
      </a>
    `).join("")}
  `;

  renderDirectory({
    eyebrow:'Find your corner of the world',title:st.name,
    description:`A closer look at ${st.name}. Explore our destinations and discover your next private escape.`,
    back:{href:'#/',label:'← All states & regions'},searchLabel:`Search locations in ${st.name}`,
    stats:[{value:st.total_locations,label:'Destinations'},{value:st.total_villas,label:'Private villas'}],
    items:st.locations.map(loc=>({name:loc.name,href:`#/location/${loc.slug}`,query:`${loc.name} ${st.name} landscape travel`,
      badge:`${loc.villa_count} ${loc.villa_count===1?'villa':'villas'}`,eyebrow:st.name,
      description:`Discover private stays in ${loc.name}, with space to slow down and settle in.`,
      detail:'The destination collection',cta:'Discover stays'}))
  });
}

/* 3. HOTELS / VILLAS LIST FOR A LOCATION (LEVEL 3) */
function locationPage(locSlug){
  const loc = LOCATIONS_CACHE[locSlug];
  if(!loc) return notFound(locSlug);

  const stateName = loc.state_name || "Destinations";
  const stateSlug = loc.state_slug || "";

  document.title = `${loc.name}, ${stateName} — Adopremium`;
  setSideHeader(loc.name, `${loc.villa_count} Luxury ${loc.villa_count === 1 ? 'Villa' : 'Villas'}`);
  setHeaderBreadcrumb([
    { label: "States", url: "#/" },
    ...(stateSlug ? [{ label: stateName, url: `#/state/${stateSlug}` }] : []),
    { label: loc.name, url: "" }
  ]);
  renderMobBottomNav({ stateSlug, stateName, locSlug: loc.slug, locName: loc.name, currentLevel: 'location' });

  // Sidebar navigation
  nav.innerHTML = `
    <div class="nav-section-title">
      <span class="nav-icon"><i data-lucide="home"></i></span>
      <span class="nav-text">${esc(loc.name)} Villas</span>
    </div>
    ${loc.villas.map(v=>`
      <a href="#/${v.slug}" title="${esc(v.name)}">
        <span class="nav-icon"><i data-lucide="building"></i></span>
        <span class="nav-text">${esc(v.name)}</span>
      </a>
    `).join("")}
  `;

  renderDirectory({
    eyebrow:`${stateName} / The villa collection`,title:loc.name,
    description:`Space to unwind. Room to reconnect. Find your private retreat in ${loc.name} and explore every detail in its brochure.`,
    back:{href:stateSlug?`#/state/${stateSlug}`:'#/',label:`← ${stateSlug?stateName:'All destinations'}`},searchLabel:`Search villas in ${loc.name}`,
    stats:[{value:loc.villa_count,label:'Private stays'}],
    items:loc.villas.map(v=>({name:v.name,href:`#/${v.slug}`,image:v.hero,
      badge:v.bhk||'Private villa',eyebrow:loc.name,description:`${v.bhk||'Private villa'} · Up to ${v.max||12} guests`,
      detail:'Explore the property',cta:'View brochure'}))
  });
}

function chunkArray(arr, size = 3) {
  const chunks = [];
  for (let i = 0; i < (arr || []).length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function getBadgeForSpace(name = "", type = "space") {
  const n = (name || "").toLowerCase();
  if (type === "suite") {
    if (n.includes("ground") || n.includes("cloud") || n.includes("dawn")) return "Ground Floor Suite";
    return "1st Floor Suite";
  }
  if (n.includes("lounge") || n.includes("living") || n.includes("beaumont") || n.includes("sandstone")) return "Living Lounge";
  if (n.includes("bar") || n.includes("cask")) return "Cocktail Bar";
  if (n.includes("dining") || n.includes("chamber")) return "Dining Hall";
  if (n.includes("kitchen") || n.includes("botanica")) return "Gourmet Kitchen";
  if (n.includes("pool") || n.includes("retreat")) return "Pool & Jacuzzi";
  if (n.includes("garden") || n.includes("meadow") || n.includes("lawn")) return "Manicured Grounds";
  if (n.includes("gazebo") || n.includes("pavilion")) return "Alfresco Pavilion";
  if (n.includes("terrace") || n.includes("deck")) return "Sun Terrace";
  if (n.includes("patio") || n.includes("sit-out") || n.includes("horizon")) return "Scenic Patio";
  if (n.includes("leisure") || n.includes("game") || n.includes("club")) return "Entertainment Lounge";
  return "Curated Space";
}

function getSpreadTitle(chunk, fallback, type) {
  if (!chunk || chunk.length === 0) return fallback;
  const names = chunk.map(c => (c.name || "").toLowerCase());
  if (type === "space") {
    if (names.some(n => n.includes("lounge") || n.includes("living") || n.includes("cask") || n.includes("bar"))) return "Grand Lounges & Bar";
    if (names.some(n => n.includes("dining") || n.includes("chamber") || n.includes("kitchen") || n.includes("botanica") || n.includes("leisure") || n.includes("club"))) return "Dining, Kitchen & Leisure";
    if (names.some(n => n.includes("pool") || n.includes("retreat") || n.includes("garden") || n.includes("meadow") || n.includes("gazebo") || n.includes("pavilion"))) return "Private Pool & Grounds";
    if (names.some(n => n.includes("terrace") || n.includes("deck") || n.includes("patio") || n.includes("horizon"))) return "Outdoor Terraces & Patios";
  } else {
    if (names.some(n => n.includes("jacuzzi") || n.includes("stillwater") || n.includes("halo"))) return "First Floor Luxury Suites";
    if (names.some(n => n.includes("mist") || n.includes("cloud") || n.includes("dawn"))) return "Ground & Garden Suites";
  }
  return fallback;
}

/* 4. VILLA BROCHURE DETAIL PAGE (LEVEL 4) — NO PEXELS FOR BROCHURES */
function villa(slug, sec){
  let v = VILLAS[slug];

  let locSlug = "";
  let locName = "";
  let stateSlug = "";
  let stateName = "";

  if(v){
    locSlug = v.citySlug || "";
    locName = v.cityName || v.place || "";
    stateSlug = v.stateSlug || "";
    stateName = v.stateName || "";
  } else if(ALL_VILLAS_MAP[slug]){
    const info = ALL_VILLAS_MAP[slug];
    v = info.villa;
    locSlug = info.loc.slug;
    locName = info.loc.name;
    stateSlug = info.state ? info.state.slug : "";
    stateName = info.state ? info.state.name : "";
  }

  if(!v) return notFound(slug);

  app.classList.add("villa-brochure");
  document.title = `${v.name || v.code || "Private Villa"} — Adopremium`;
  setSideHeader(v.code, `${v.config} · ${v.place}`);

  const breadcrumbs = [
    { label: "States", url: "#/" }
  ];
  if(stateSlug && stateName){
    breadcrumbs.push({ label: stateName, url: `#/state/${stateSlug}` });
  }
  if(locSlug && locName){
    breadcrumbs.push({ label: locName, url: `#/location/${locSlug}` });
  }
  breadcrumbs.push({ label: v.name || v.code, url: "" });
  setHeaderBreadcrumb(breadcrumbs);
  renderMobBottomNav({ stateSlug, stateName, locSlug, locName, currentLevel: 'villa' });

  const L = v.location || { attractions: [], dining: [], transfers: [], map: "" };
  const spaceChunks = chunkArray(v.spaces || [], 3);
  const suiteChunks = chunkArray(v.suites || [], 3);

  let spreadCounter = 1;

  const overviewHtml = renderOverviewSection(v, spreadCounter++);

  const S = [
    ["top", "Cover", "home"],
    ["overview", "The Overview", "info"]
  ];

  spaceChunks.forEach((chk, i) => {
    const chunkTitle = getSpreadTitle(chk, `Spaces Spread 0${i + 1}`, "space");
    S.push([`spaces-spread-${i + 1}`, chunkTitle, "layout"]);
  });

  suiteChunks.forEach((chk, i) => {
    const chunkTitle = getSpreadTitle(chk, `Suites Spread 0${i + 1}`, "suite");
    S.push([`suites-spread-${i + 1}`, chunkTitle, "bed-double"]);
  });

  const amenitiesHtml = renderAmenitiesSection(v.amenities, spreadCounter++);
  if (amenitiesHtml) {
    S.push(["amenities", "Amenities & Comforts", "sparkles"]);
  }

  S.push(
    ["location", "Local Treasures", "map-pin"],
    ["experiences", "Unique Experiences", "compass"],
    ["rules", "House Rules", "clipboard-list"],
    ["guests", "Guest Register", "star"]
  );

  const snapshotHtml = renderSnapshotSection(v.snapshot, spreadCounter++);
  if (snapshotHtml) {
    S.push(["snapshot", "Villa Snapshot", "book-open"]);
  }

  nav.innerHTML = `
    <div class="nav-section-title">
      <span class="nav-icon"><i data-lucide="book-open"></i></span>
      <span class="nav-text">Brochure Index</span>
    </div>
    ${S.map(([id, t, icon]) => `
      <a href="#/${slug}/${id}" data-s="${id}" title="${esc(t)}">
        <span class="nav-icon"><i data-lucide="${icon || 'compass'}"></i></span>
        <span class="nav-text">${esc(t)}</span>
      </a>
    `).join("")}
  `;

  const heroImg = v.hero_img || (v.images && v.images[0]) || "";

  const spacesHtml = spaceChunks.map((chunk, idx) => {
    const spreadNum = spreadCounter++;
    const spreadId = `spaces-spread-${idx + 1}`;
    const spreadTitle = getSpreadTitle(chunk, `Curated Spaces — Spread 0${idx + 1}`, "space");
    return `
    <section class="brochure-spread" id="${spreadId}">
      <div class="spread-header">
        <div>
          <p class="kicker">Brochure Spread 0${spreadNum} · Living &amp; Spaces</p>
          <h2 class="t">${esc(spreadTitle)}</h2>
        </div>
        <div class="spread-num">0${spreadNum}</div>
      </div>
      <div class="swiper triptych-swiper">
        <div class="swiper-wrapper triptych-grid">
          ${chunk.map(s => {
            const sImgs = s.img || s.images || (s.image ? [s.image] : []);
            const sImg = sImgs[0] || "";
            const badge = getBadgeForSpace(s.name, "space");
            return `
            <article class="swiper-slide triptych-card" id="${s.id}">
              <div class="card-media">
                ${pic(s.name, 0, "", sImg, false)}
                <span class="card-badge">${esc(badge)}</span>
              </div>
              <div class="card-body">
                <span class="kicker">${esc(s.tag || s.name)}</span>
                <h3>${esc(s.name)}</h3>
                ${chips(s.meta || [])}
                <p class="lead">${esc(s.desc)}</p>
                ${s.notes && s.notes.length ? `<div class="card-notes">${s.notes.map(n => `<div>• ${esc(n)}</div>`).join("")}</div>` : ""}
              </div>
            </article>`;
          }).join("")}
        </div>
      </div>
    </section>`;
  }).join("");

  const suitesHtml = suiteChunks.map((chunk, idx) => {
    const spreadNum = spreadCounter++;
    const spreadId = `suites-spread-${idx + 1}`;
    const spreadTitle = getSpreadTitle(chunk, `Bedroom Suites — Spread 0${idx + 1}`, "suite");
    return `
    <section class="brochure-spread" id="${spreadId}">
      <div class="spread-header">
        <div>
          <p class="kicker">Brochure Spread 0${spreadNum} · Bedroom Suites</p>
          <h2 class="t">${esc(spreadTitle)}</h2>
        </div>
        <div class="spread-num">0${spreadNum}</div>
      </div>
      <div class="swiper triptych-swiper">
        <div class="swiper-wrapper triptych-grid">
          ${chunk.map(b => {
            const bImgs = b.img || b.images || (b.image ? [b.image] : []);
            const bImg = bImgs[0] || "";
            const badge = b.floor || getBadgeForSpace(b.name, "suite");
            const chipsList = [b.floor, b.area, b.bed, b.view].filter(Boolean);
            return `
            <article class="swiper-slide triptych-card" id="${b.id}">
              <div class="card-media">
                ${pic(b.name, 0, "", bImg, false)}
                <span class="card-badge">${esc(badge)}</span>
              </div>
              <div class="card-body">
                <span class="kicker">${esc((b.id || "").replace("-", " "))}</span>
                <h3>${esc(b.name)}</h3>
                ${chips(chipsList)}
                <p class="lead">${esc(b.desc)}</p>
                ${b.bath ? `
                <div class="card-bath">
                  <span class="kicker">Ensuite Bathroom</span>
                  <h4>${esc(b.bath.name)}</h4>
                  <p>${esc(b.bath.desc)}</p>
                </div>` : ""}
                ${b.extra ? `
                <div class="card-notes" style="margin-top:14px">
                  <b style="color:var(--text);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">${esc(b.extra.name)}</b>
                  <p style="font-size:12px;color:var(--text-secondary);line-height:1.5">${esc(b.extra.desc)}</p>
                </div>` : ""}
              </div>
            </article>`;
          }).join("")}
        </div>
      </div>
    </section>`;
  }).join("");

  app.innerHTML = `
  <section class="hero" id="top">
    ${pic(v.name, 0, "bg", heroImg, false)}
    <div class="in brochure-cover">
      <a class="brochure-back" href="${locSlug ? `#/location/${locSlug}` : '#/'}">← Back to the collection</a>
      <div class="brochure-cover-content"><p class="cover-label">Adopremium / PRIVATE COLLECTION</p>
      <h1>${esc(v.name || v.code || 'Your private escape')}</h1>
      <p class="cover-location">${esc(v.config || 'Private villa')} <span>·</span> ${esc(v.place || locName)}</p>
      <div class="cover-actions"><a class="brochure-button" href="#/${slug}/overview">Explore the villa <span aria-hidden="true">↗</span></a></div></div>
      <div class="cover-caption"><span>${esc(v.code || 'ADO COLLECTION')}</span><span>A place to make your own.</span></div>
    </div>
  </section>
  <nav class="brochure-chapters" aria-label="Brochure chapters">${S.map(([id,title])=>`<a href="#/${slug}/${id}" data-s="${id}">${esc(title)}</a>`).join('')}</nav>

  ${overviewHtml}

  ${spacesHtml}

  ${suitesHtml}

  ${amenitiesHtml}

  <section id="location">
    <h2 class="t">Local treasures</h2>
    ${L.map ? `<div class="map"><iframe loading="lazy" src="${esc(L.map)}" title="Location of ${esc(v.name)}" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : `<p class="lead">${esc(v.place || locName)} · Contact our team for arrival directions.</p>`}
    <div class="cols">
      <div><h4><i data-lucide="compass" class="lucide-icon"></i> Tourist attractions</h4>${list(L.attractions)}</div>
      <div><h4><i data-lucide="utensils" class="lucide-icon"></i> Restaurants, cafés &amp; bars</h4>${list(L.dining)}</div>
      <div><h4><i data-lucide="car" class="lucide-icon"></i> Transfers</h4>${list(L.transfers)}</div>
    </div>
  </section>

  <section id="experiences" class="experiences-section">
    <div class="spread-header" style="margin-bottom:20px;">
      <div>
        <p class="kicker">Curated Stays &amp; Activities</p>
        <h2 class="t">Unique experiences</h2>
        <p class="lead">Experiences marked ₹ are chargeable.</p>
      </div>
      <div class="spread-num">${(v.experiences || []).length} Curated</div>
    </div>
    <div class="xp-carousel-wrapper">
      <div class="swiper xp-swiper">
        <div class="swiper-wrapper xp ${(v.experiences || []).length < 3 ? 'count-lt3' : `count-${(v.experiences || []).length}`}">
          ${(v.experiences || []).map(x => {
            const xImg = x.img || (x.images && x.images[0]) || "";
            return `
            <figure class="swiper-slide xp-slide">
              ${pic(x.name, 0, "", xImg, false)}
              ${x.paid ? '<span class="paid">₹</span>' : ""}
              <figcaption>${esc(x.name)}</figcaption>
            </figure>`;
          }).join("")}
        </div>
        <div class="swiper-bottom-bar xp-controls">
          <button class="swiper-nav-btn xp-prev" aria-label="Previous experience" type="button"><i data-lucide="chevron-left"></i></button>
          <div class="swiper-pagination xp-pagination"></div>
          <button class="swiper-nav-btn xp-next" aria-label="Next experience" type="button"><i data-lucide="chevron-right"></i></button>
        </div>
      </div>
    </div>
  </section>

  <section id="rules">
    <h2 class="t">House rules</h2>
    <div class="rules">${(v.rules || []).map(([t, d]) => `<div><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</div>
  </section>

  <section id="guests">
    <h2 class="t">Stay like the stars do</h2>
    <p class="lead">Celebrities spotted in our villas</p>
    <div class="names">${(v.guests || []).map(n => `<span>${esc(n)}</span>`).join("")}</div>
  </section>

  ${snapshotHtml}

  <footer>
    <span>${esc(v.name)} | ${esc(v.edition)}</span>
    <span>${esc(v.code)} · ${esc(v.config)} · ${esc(v.place)}</span>
  </footer>`;

  // Omit empty sections and their navigation entries.
  for (const [id, data] of [['experiences',v.experiences],['rules',v.rules],['guests',v.guests]]) {
    if (!data?.length) {
      document.getElementById(id)?.remove();
      document.querySelectorAll(`[data-s="${id}"]`).forEach(link=>link.remove());
    }
  }
  observe();
  refreshLucide();
  initAllSwipers();
  if(sec){
    const targetId = sec === "spaces" ? "spaces-spread-1" : sec === "suites" ? "suites-spread-1" : sec;
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView());
  } else {
    window.scrollTo(0, 0);
  }
  spy();
}

function notFound(slug){
  app.classList.remove("villa-brochure");
  setHeaderBreadcrumb([
    { label: "States", url: "#/" },
    { label: "Not Found", url: "" }
  ]);
  renderMobBottomNav({ currentLevel: 'home' });
  nav.innerHTML = `
    <a href="#/" title="All States" style="color:var(--accent);font-weight:500">
      <span class="nav-icon"><i data-lucide="arrow-left"></i></span>
      <span class="nav-text">All States</span>
    </a>
  `;
  app.innerHTML = `
    <section>
      <h2 class="t">Not Found</h2>
      <p class="lead">We could not find “${esc(slug)}”. <a href="#/" style="color:var(--accent);text-decoration:underline">View all destinations</a></p>
    </section>
  `;
}

function observe(){
  document.querySelectorAll(".ph.load[data-target]").forEach(el => io.observe(el));
}

/* Track the section below the sticky header and keep its chapter tab visible. */
let spyIO;
function spy(){
  spyIO?.disconnect();
  const bar = app.querySelector('.brochure-chapters');
  if (!bar) return;
  const tabs = Array.from(bar.querySelectorAll('a[data-s]'));
  const sections = tabs.map(tab => document.getElementById(tab.dataset.s)).filter(Boolean);
  const links = document.querySelectorAll('#nav a[data-s], .brochure-chapters a[data-s]');
  let frame = 0;
  let activeId = '';
  let revealActive = true;
  const update = () => {
    frame = 0;
    const headerBottom = document.getElementById('editorialHeader')?.getBoundingClientRect().bottom || 0;
    const threshold = headerBottom + bar.offsetHeight + 24;
    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= threshold) active = section;
      else break;
    }
    // The final chapter may be too short to reach the sticky navigation.
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      active = sections[sections.length - 1];
    }
    if (!active) return;
    const changed = active.id !== activeId;
    if (!changed && !revealActive) return;
    activeId = active.id;
    revealActive = false;
    links.forEach(link => {
      const selected = link.dataset.s === activeId;
      link.classList.toggle('on', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const tab = tabs.find(link => link.dataset.s === activeId);
    if (!tab) return;
    const bounds = bar.getBoundingClientRect();
    const rect = tab.getBoundingClientRect();
    if (rect.left < bounds.left + 12 || rect.right > bounds.right - 12) {
      bar.scrollTo({
        left: bar.scrollLeft + rect.left - bounds.left - (bar.clientWidth - rect.width) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const resize = () => { revealActive = true; schedule(); };
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', resize, {passive:true});
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(app);
  spyIO = {disconnect(){
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
    cancelAnimationFrame(frame);
  }};
  update();
}

/* ============================================================
   SWIPER CAROUSEL INITIALIZER (XP & PHOTO GALLERY)
   ============================================================ */
function initAllSwipers(){
  if (typeof Swiper === "undefined") {
    console.warn("[Swiper] Swiper library is not available.");
    return;
  }

  // 1. Experiences Swiper (.xp-swiper)
  document.querySelectorAll(".xp-swiper").forEach(container => {
    if (container._swiperInstance) {
      try { container._swiperInstance.destroy(true, true); } catch(e){}
    }
    const slides = container.querySelectorAll(".swiper-slide");
    const count = slides.length;
    const prevBtn = container.querySelector(".xp-prev");
    const nextBtn = container.querySelector(".xp-next");
    const paginationEl = container.querySelector(".xp-pagination");

    container._swiperInstance = new Swiper(container, {
      slidesPerView: 1.15,
      spaceBetween: 14,
      grabCursor: true,
      watchOverflow: true,
      observer: true,
      observeParents: true,
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn,
      },
      pagination: {
        el: paginationEl,
        clickable: true,
        dynamicBullets: true,
      },
      breakpoints: {
        480: {
          slidesPerView: 1.5,
          spaceBetween: 16,
        },
        640: {
          slidesPerView: 2.2,
          spaceBetween: 16,
        },
        860: {
          slidesPerView: Math.min(3, count || 3),
          spaceBetween: 18,
        },
        1100: {
          slidesPerView: Math.min(4, count || 4),
          spaceBetween: 20,
        }
      }
    });
  });

  // 2. Feature vs Thumbnails Gallery Swiper (.feature-thumbs-gal)
  document.querySelectorAll(".feature-thumbs-gal").forEach(container => {
    const mainEl = container.querySelector(".gal-featured-swiper");
    const thumbsEl = container.querySelector(".gal-thumbs-swiper");
    if (!mainEl || !thumbsEl) return;

    if (mainEl._swiperInstance) {
      try { mainEl._swiperInstance.destroy(true, true); } catch(e){}
    }
    if (thumbsEl._swiperInstance) {
      try { thumbsEl._swiperInstance.destroy(true, true); } catch(e){}
    }

    const prevBtn = container.querySelector(".gal-prev");
    const nextBtn = container.querySelector(".gal-next");
    const paginationEl = container.querySelector(".gal-pagination");

    const isVertical = window.innerWidth > 576;

    const thumbsSwiper = new Swiper(thumbsEl, {
      direction: isVertical ? "vertical" : "horizontal",
      spaceBetween: isVertical ? 12 : 10,
      slidesPerView: isVertical ? 2 : "auto",
      watchSlidesProgress: true,
      observer: true,
      observeParents: true,
      breakpoints: {
        577: {
          direction: "vertical",
          slidesPerView: 2,
          spaceBetween: 12
        }
      }
    });

    const mainSwiper = new Swiper(mainEl, {
      spaceBetween: 12,
      grabCursor: true,
      observer: true,
      observeParents: true,
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn
      },
      pagination: {
        el: paginationEl,
        clickable: true,
        dynamicBullets: true
      },
      thumbs: {
        swiper: thumbsSwiper
      }
    });

    mainSwiper.on('slideChange', () => {
      const activeIdx = mainSwiper.realIndex;
      container.querySelectorAll(".gal-thumb-slide").forEach((thumb, idx) => {
        if (idx === activeIdx) {
          thumb.classList.add("active-thumb");
        } else {
          thumb.classList.remove("active-thumb");
        }
      });
      if (thumbsSwiper && typeof thumbsSwiper.slideTo === "function") {
        thumbsSwiper.slideTo(activeIdx);
      }
    });

    container.querySelectorAll(".gal-thumb-slide").forEach((thumb, idx) => {
      thumb.addEventListener("click", () => {
        mainSwiper.slideTo(idx);
      });
    });

    mainEl._swiperInstance = mainSwiper;
    thumbsEl._swiperInstance = thumbsSwiper;
  });

  // 3. Mobile Triptych Swiper (.triptych-swiper)
  document.querySelectorAll(".triptych-swiper").forEach(container => {
    if (container._swiperInstance) {
      try { container._swiperInstance.destroy(true, true); } catch(e){}
      container._swiperInstance = null;
    }

    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
      const slides = container.querySelectorAll(".swiper-slide");
      const count = slides.length;
      container._swiperInstance = new Swiper(container, {
        slidesPerView: 1.12,
        spaceBetween: 14,
        grabCursor: true,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        breakpoints: {
          480: {
            slidesPerView: Math.min(1.25, count || 1.25),
            spaceBetween: 16
          },
          576: {
            slidesPerView: Math.min(1.35, count || 1.4),
            spaceBetween: 16
          }
        }
      });
    }
  });
}

// Re-evaluate Swipers on window resize so mobile-only swiper activates/destroys properly
if (!window._triptychResizeBound) {
  window._triptychResizeBound = true;
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      initAllSwipers();
    }, 150);
  });
}

/* ============================================================
   ROUTER
   ============================================================ */
let current = "";
function route(){
  closeGalleryModal();
  closeAmenitiesModal();
  spyIO?.disconnect();
  renderRoute();
  if (app.classList.contains('villa-brochure')) spy();
  // Page renderers replace sidebar markup. Convert icons only after insertion.
  refreshLucide();
}

function renderRoute(){
  const hash = location.hash.replace(/^#\/?/, "");
  side.classList.remove("open");

  if(!hash){
    current = "";
    return home();
  }

  // Check for #/state/<slug>
  const stateMatch = hash.match(/^state\/([^/]+)/);
  if(stateMatch){
    current = hash;
    return statePage(stateMatch[1]);
  }

  // Check if hash matches a state slug directly
  if(STATES_MAP[hash]){
    current = hash;
    return statePage(hash);
  }

  // Check for #/location/<slug>
  const locMatch = hash.match(/^location\/([^/]+)/);
  if(locMatch){
    current = hash;
    return locationPage(locMatch[1]);
  }

  // Check if hash matches a location slug directly
  if(LOCATIONS_SUMMARY_MAP[hash]){
    current = hash;
    return locationPage(hash);
  }

  // Otherwise treat as villa slug: #/<slug> or #/<slug>/<sec>
  const parts = hash.split("/");
  const slug = parts[0];
  const sec = parts[1] || "";

  if(slug === current && sec){
    document.getElementById(sec)?.scrollIntoView();
    return;
  }

  current = slug;
  villa(slug, sec);
}

/* ============================================================
   UI
   ============================================================ */
const menuBtn = document.getElementById("menuBtn");
if (menuBtn) {
  menuBtn.onclick = () => side.classList.toggle("open");
}

const editorialHeader = document.getElementById("editorialHeader");
window.addEventListener("scroll", () => {
  if (!editorialHeader) return;
  if (window.scrollY > 30) {
    editorialHeader.classList.add("scrolled");
  } else {
    editorialHeader.classList.remove("scrolled");
  }
}, { passive: true });

const dlBtn = document.getElementById("dl");
if (dlBtn) {
  dlBtn.onclick = () => {
    document.querySelectorAll("[data-target]").forEach(hydrate);
    setTimeout(() => window.print(), 900);
  };
}

// Amenities Modal handlers
function openAmenitiesModal() {
  const modal = document.getElementById("amenitiesModal");
  if (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    refreshLucide();
  }
}

function closeAmenitiesModal() {
  const modal = document.getElementById("amenitiesModal");
  if (modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
}

/* ============================================================
   ENLARGED GALLERY LIGHTBOX MODAL MANAGEMENT
   ============================================================ */
let modalImagesList = [];
let currentModalIdx = 0;

function openGalleryModal(images = [], startIndex = 0) {
  const lb = document.getElementById("lb");
  if (!lb || !images || images.length === 0) return;

  modalImagesList = images.filter(Boolean);
  currentModalIdx = Math.max(0, Math.min(startIndex, modalImagesList.length - 1));

  updateGalleryModalState();
  lb.classList.add("open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeGalleryModal() {
  const lb = document.getElementById("lb");
  if (!lb) return;
  lb.classList.remove("open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function updateGalleryModalState() {
  const lb = document.getElementById("lb");
  if (!lb || modalImagesList.length === 0) return;

  const mainImg = document.getElementById("lbMainImg");
  const counter = document.getElementById("lbCounter");
  const track = document.getElementById("lbThumbsTrack");

  const activeSrc = modalImagesList[currentModalIdx];
  if (mainImg) {
    mainImg.src = activeSrc;
  }
  if (counter) {
    counter.textContent = `${String(currentModalIdx + 1).padStart(2, '0')} / ${String(modalImagesList.length).padStart(2, '0')}`;
  }

  if (track) {
    track.innerHTML = modalImagesList.map((src, i) => `
      <button type="button" class="gal-modal-thumb-item ${i === currentModalIdx ? 'active' : ''}" data-idx="${i}" aria-label="Select photo ${i + 1}">
        <img src="${esc(src)}" alt="Thumbnail ${i + 1}">
      </button>
    `).join("");

    const activeEl = track.children[currentModalIdx];
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }
  refreshLucide();
}

function nextGalleryModalImage() {
  if (modalImagesList.length === 0) return;
  currentModalIdx = (currentModalIdx + 1) % modalImagesList.length;
  updateGalleryModalState();
}

function prevGalleryModalImage() {
  if (modalImagesList.length === 0) return;
  currentModalIdx = (currentModalIdx - 1 + modalImagesList.length) % modalImagesList.length;
  updateGalleryModalState();
}

// Lightbox click and navigation event listeners
const lbModal = document.getElementById("lb");
if (lbModal) {
  lbModal.addEventListener("click", e => {
    if (e.target.closest("#lbCloseBtn") || e.target.classList.contains("gal-modal-body") || e.target.id === "lb") {
      closeGalleryModal();
      return;
    }
    if (e.target.closest("#lbNextBtn")) {
      e.stopPropagation();
      nextGalleryModalImage();
      return;
    }
    if (e.target.closest("#lbPrevBtn")) {
      e.stopPropagation();
      prevGalleryModalImage();
      return;
    }
    const thumbBtn = e.target.closest(".gal-modal-thumb-item");
    if (thumbBtn) {
      e.stopPropagation();
      const idx = parseInt(thumbBtn.dataset.idx, 10);
      if (!isNaN(idx)) {
        currentModalIdx = idx;
        updateGalleryModalState();
      }
    }
  });
}

app.addEventListener("click", e => {
  if (e.target.closest("#openAmenitiesModalBtn")) {
    e.preventDefault();
    openAmenitiesModal();
    return;
  }

  if (e.target.closest("#closeAmenitiesModalBtn")) {
    e.preventDefault();
    closeAmenitiesModal();
    return;
  }

  const modal = document.getElementById("amenitiesModal");
  if (modal && modal.classList.contains("open") && e.target === modal) {
    closeAmenitiesModal();
    return;
  }

  // 1. If clicked inside thumbnail container/card, do NOT open modal (let thumbnail click switch featured image only)
  if (e.target.closest(".gal-thumb-slide, .gal-thumb-card, .gal-thumb-ph, .gal-thumbs-container")) {
    return;
  }

  // 2. Open modal only for Click to Expand, main featured card/photo, or other photo cards
  const zoomHint = e.target.closest(".gal-zoom-hint, .gal-featured-card, .gal-featured-ph");
  const imgTarget = e.target.closest(".xp img, .card img, .hero img, .ph img");

  if (zoomHint || imgTarget) {
    if (e.target.closest("a") && !e.target.closest(".gal")) return;

    const galContainer = (zoomHint || imgTarget).closest(".gal.feature-thumbs-gal, .gal, .xp, .triptych-swiper, section");
    let images = [];
    let startIdx = 0;

    if (galContainer) {
      const imgsInGal = Array.from(galContainer.querySelectorAll(".gal-featured-ph img, .gal-thumb-ph img, .ph img, img"));
      images = imgsInGal.map(img => img.dataset.full || img.src).filter(Boolean);
      images = Array.from(new Set(images));

      const mainSwiperEl = galContainer.querySelector(".gal-featured-swiper");
      if (mainSwiperEl && mainSwiperEl._swiperInstance) {
        startIdx = mainSwiperEl._swiperInstance.realIndex || 0;
      } else if (imgTarget) {
        const clickedSrc = imgTarget.dataset.full || imgTarget.src;
        if (clickedSrc) {
          const found = images.indexOf(clickedSrc);
          if (found !== -1) startIdx = found;
        }
      }
    }

    if (images.length === 0 && imgTarget) {
      images = [imgTarget.dataset.full || imgTarget.src];
    }

    if (images.length > 0) {
      openGalleryModal(images, startIdx);
    }
  }
});

addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeGalleryModal();
    closeAmenitiesModal();
  } else if (lbModal && lbModal.classList.contains("open")) {
    if (e.key === "ArrowRight") nextGalleryModalImage();
    if (e.key === "ArrowLeft") prevGalleryModalImage();
  }
});

/* Contact dialog: explicit links open the user's phone or email app. */
let contactOpener;
let contactPreviousOverflow = '';
const contactDetails = {
  call: {
    title: 'Call Our Expert',
    groups: [
      {title:'For Reservation', items:[['Reservation Line 1','+91-9311663765','tel:+919311663765'],['Reservation Line 2','+91-9311663766','tel:+919311663766']]},
      {title:'Get In Touch with Monica', items:[['Monica (Mobile)','+91-9560020687','tel:+919560020687'],['Office Landline','+91-11 4010 8586','tel:+911140108586']]}
    ]
  },
  email: {
    title: 'Email Our Expert',
    groups: [{title:'Send us your enquiry',items:[['Monica','monica@adopremium.com','mailto:monica@adopremium.com'],['Sales Team','sales@adopremium.com','mailto:sales@adopremium.com']]}]
  }
};
function openContactModal(type = 'call') {
  const modal = document.getElementById('contactModal');
  if (!modal || modal.classList.contains('open')) return;
  const mode = type === 'email' ? 'email' : 'call';
  const details = contactDetails[mode];
  document.getElementById('contactModalTitle').textContent = details.title;
  modal.dataset.mode = mode;
  modal.querySelector('.contact-modal-body').innerHTML = details.groups.map(group => `
    <div class="contact-section">
      <div class="contact-section-label">${esc(group.title)}</div>
      <div class="contact-grid">${group.items.map(([label,value,href]) => `
        <a href="${href}" class="contact-option-card">
          <div class="contact-option-icon"><i data-lucide="${mode === 'email' ? 'mail' : 'phone'}"></i></div>
          <div class="contact-option-info"><span class="contact-option-label">${esc(label)}</span><span class="contact-option-val">${esc(value)}</span></div>
          <i data-lucide="chevron-right" class="contact-arrow"></i>
        </a>`).join('')}</div>
    </div>`).join('');
  contactOpener = document.activeElement;
  contactPreviousOverflow = document.body.style.overflow;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  refreshLucide();
  document.getElementById('contactModalClose').focus();
}
function closeContactModal() {
  const modal = document.getElementById('contactModal');
  if (!modal?.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = contactPreviousOverflow;
  contactOpener?.focus();
}
// Delegation also handles contact buttons recreated by the router.
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-contact]');
  if (trigger) {
    event.preventDefault();
    openContactModal(trigger.dataset.contact);
    return;
  }
  if (event.target.closest('[data-contact-close]')) closeContactModal();
});

document.getElementById('contactModal')?.addEventListener('click', e => {
  if (e.target.id === 'contactModal') closeContactModal();
});
document.getElementById('contactModal')?.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); closeContactModal(); }
  if (e.key !== 'Tab') return;
  const nodes = e.currentTarget.querySelectorAll('a[href],button');
  const first = nodes[0], last = nodes[nodes.length-1];
  if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();}
  else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
});

async function fetchPortfolioJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {signal:controller.signal});
    if (!response.ok) throw new Error(`Portfolio request failed (${response.status})`);
    return await response.json();
  } finally {clearTimeout(timer);}
}
function loadPortfolioFallback() {
  if (window.ADO_PORTFOLIO_FALLBACK) return Promise.resolve(window.ADO_PORTFOLIO_FALLBACK);
  return new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = new URL('assets/data/portfolio-fallback.js', document.baseURI).href;
    const timer = setTimeout(() => {script.remove();reject(new Error('Portfolio fallback timed out'));},12000);
    script.onload = () => {clearTimeout(timer);resolve(window.ADO_PORTFOLIO_FALLBACK || []);script.remove();};
    script.onerror = () => {clearTimeout(timer);script.remove();reject(new Error('Portfolio data files are unavailable'));};
    document.head.appendChild(script);
  });
}
let portfolioRouterBound = false;
/* ============================================================
   INITIALIZATION — Auto-detects data from location/*
   ============================================================ */
async function initPortfolio(){
  try {
    // Load the packaged collection directly: works on static hosting and file previews.
    // Keep this bundle synchronized with assets/data/location when villa data changes.
    const loadedList = await loadPortfolioFallback();

    // Filter valid objects that have title or data and deduplicate by title
    const validMap = new Map();
    loadedList.filter(Boolean).forEach(item => {
      if(item.data && (item.data.title || item.data.name || item.data.spaces || item.data.rooms)){
        const key = item.data.title || item.filename;
        if(!validMap.has(key)){
          validMap.set(key, item);
        }
      }
    });

    const validList = Array.from(validMap.values());

    if (!validList.length) throw new Error("No portfolio data available");

    // 4. Auto-detect states, locations and villas strictly from the loaded JSONs
    buildPortfolioFromLocationJsons(validList);

    // 5. Start Router
    if (!portfolioRouterBound) {addEventListener("hashchange", route);portfolioRouterBound = true;}
    route();

  } catch(err) {
    console.error("Initialization failed:", err);
    throw err;

  }
}


/* Simple temporary frontend password gate. This is not server authentication. */
const accessForm = document.getElementById("accessForm");
const passwordInput = document.getElementById("accessPassword");
const accessError = document.getElementById("accessError");
const accessSubmit = document.getElementById("accessSubmit");
let accessVerified = false;
let failedAttempts = 0;
let retryAfter = 0;
document.getElementById("togglePassword").addEventListener("click", e => {
  const showing = passwordInput.type === "password";
  passwordInput.type = showing ? "text" : "password";
  e.currentTarget.textContent = showing ? "Hide" : "Show";
  e.currentTarget.setAttribute("aria-label", showing ? "Hide password" : "Show password");
  e.currentTarget.setAttribute("aria-pressed", String(showing));
});
accessForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (accessSubmit.disabled) return;
  if (Date.now() < retryAfter) {
    accessError.textContent = `Please wait ${Math.ceil((retryAfter - Date.now()) / 1000)} seconds before trying again.`;
    return;
  }
  accessSubmit.disabled = true;
  accessError.textContent = "Checking your access…";
  try {
    if (!accessVerified) {
    if (passwordInput.value !== "adopremium") {
      failedAttempts++;
      if (failedAttempts >= 5) retryAfter = Date.now() + 30000;
      accessError.textContent = failedAttempts >= 5 ? "Too many attempts. Please wait 30 seconds." : "That password isn’t correct. Please try again.";
      passwordInput.setAttribute("aria-invalid", "true");
      passwordInput.select();
      return;
    }
    accessVerified = true;
    }
    passwordInput.value = "";
    passwordInput.removeAttribute("aria-invalid");
    accessForm.hidden = true;
    document.getElementById("accessTitle").textContent = "Welcome";
    document.getElementById("accessCopy").textContent = "Your next exceptional escape awaits.";
    document.getElementById("portfolioLoading").hidden = false;
    await initPortfolio();
    document.getElementById("accessScreen").hidden = true;
    document.body.classList.remove("access-locked");
    app.tabIndex = -1;
    app.focus({preventScroll:true});
    initAllSwipers();
  } catch (err) {
    accessForm.hidden = false;
    document.getElementById("portfolioLoading").hidden = true;
    console.error('Collection startup failed:', err);
    passwordInput.required = !accessVerified;
    accessSubmit.textContent = accessVerified ? 'Retry loading collection' : 'Explore the collection →';
    accessError.textContent = 'Unable to open the collection: ' + err.message;
  } finally {
    accessSubmit.disabled = false;
  }
});

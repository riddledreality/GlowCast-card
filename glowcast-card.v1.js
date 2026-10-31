/**
 * GlowCast Card — Home Assistant Lovelace custom card (v1)
 * Domain: glowcast
 *
 * Single-file vanilla JS web component. No build step.
 * Register as a HACS frontend / lovelace resource:
 *   /local/glowcast-card.js  (type: module or js)
 *
 * Discovers entities whose entity-registry platform is "glowcast",
 * groups them by device (or area / object_id prefix), and renders
 * an "All lights" section plus one section per room.
 */
(() => {
  "use strict";

  const CARD_TYPE = "glowcast-card";
  const CARD_NAME = "GlowCast Card";
  const PLATFORM = "glowcast";

  /**
   * Built-in theme key → { name, gradient, accent }.
   * Select entity options are keys (e.g. "halloween"); labels are for UI only.
   * Also indexed by display name for resilience.
   */
  const THEME_DEFS = {
    new_years: {
      name: "New Year's",
      gradient: "linear-gradient(135deg, #0a0a2e 0%, #16213e 40%, #e94560 70%, #ffd700 100%)",
      accent: "#ffd700",
    },
    valentines: {
      name: "Valentine's",
      gradient: "linear-gradient(135deg, #4a0e1f 0%, #c9184a 50%, #ff758f 100%)",
      accent: "#ff4d6d",
    },
    st_patricks: {
      name: "St. Patrick's",
      gradient: "linear-gradient(135deg, #0b3d0b 0%, #1b7a1b 45%, #7cfc00 100%)",
      accent: "#2ecc71",
    },
    easter: {
      name: "Easter",
      gradient: "linear-gradient(135deg, #fceabb 0%, #f8b4d9 40%, #b8e0ff 100%)",
      accent: "#f8b4d9",
    },
    fourth_of_july: {
      name: "Fourth of July",
      gradient: "linear-gradient(135deg, #002868 0%, #ffffff 50%, #bf0a30 100%)",
      accent: "#bf0a30",
    },
    halloween: {
      name: "Halloween",
      gradient: "linear-gradient(135deg, #1a0a00 0%, #ff6600 55%, #7b2ff7 100%)",
      accent: "#ff6600",
    },
    thanksgiving: {
      name: "Thanksgiving",
      gradient: "linear-gradient(135deg, #3d1c02 0%, #c45c26 50%, #f4a261 100%)",
      accent: "#e07a3d",
    },
    christmas: {
      name: "Christmas",
      gradient: "linear-gradient(135deg, #0b3d0b 0%, #c41e3a 50%, #ffd700 100%)",
      accent: "#c41e3a",
    },
    aurora: {
      name: "Aurora",
      gradient: "linear-gradient(135deg, #0a1628 0%, #00c9a7 40%, #845ec2 70%, #00d2ff 100%)",
      accent: "#00c9a7",
    },
    ocean: {
      name: "Ocean",
      gradient: "linear-gradient(135deg, #001f3f 0%, #0077b6 50%, #00b4d8 100%)",
      accent: "#00b4d8",
    },
    sunset: {
      name: "Sunset",
      gradient: "linear-gradient(135deg, #1a0533 0%, #ff6b35 40%, #f7c59f 70%, #ff006e 100%)",
      accent: "#ff6b35",
    },
    candlelight: {
      name: "Candlelight",
      gradient: "linear-gradient(135deg, #1a1008 0%, #c47a2c 50%, #ffd89b 100%)",
      accent: "#e8a44a",
    },
    party: {
      name: "Party",
      gradient: "linear-gradient(135deg, #ff0080 0%, #7928ca 35%, #00d4ff 70%, #ffea00 100%)",
      accent: "#ff0080",
    },
    calm: {
      name: "Calm",
      gradient: "linear-gradient(135deg, #1e3a5f 0%, #4a6fa5 50%, #a8c5d9 100%)",
      accent: "#6b9ac4",
    },
    team_colors: {
      name: "Team Colors",
      gradient: "linear-gradient(135deg, #1a1a2e 0%, #e94560 50%, #0f3460 100%)",
      accent: "#e94560",
    },
  };

  // Legacy alias: display-name → same def (if integration ever emits names)
  const THEME_PALETTE = {};
  for (const [key, def] of Object.entries(THEME_DEFS)) {
    THEME_PALETTE[key] = def;
    THEME_PALETTE[def.name] = def;
  }

    const FALLBACK_PALETTE = {
    gradient: "linear-gradient(135deg, #3a3a3a 0%, #6a6a6a 50%, #9a9a9a 100%)",
    accent: "#888888",
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function paletteFor(themeKeyOrName) {
    if (!themeKeyOrName) return FALLBACK_PALETTE;
    if (THEME_PALETTE[themeKeyOrName]) return THEME_PALETTE[themeKeyOrName];
    const lower = String(themeKeyOrName).toLowerCase();
    const key = Object.keys(THEME_PALETTE).find((k) => k.toLowerCase() === lower);
    if (key) return THEME_PALETTE[key];
    // slugify display name → key attempt
    const slug = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (THEME_DEFS[slug]) return THEME_DEFS[slug];
    return FALLBACK_PALETTE;
  }

  function themeLabel(themeKeyOrName) {
    if (!themeKeyOrName) return "";
    const def = THEME_PALETTE[themeKeyOrName] || THEME_DEFS[themeKeyOrName];
    if (def?.name) return def.name;
    const lower = String(themeKeyOrName).toLowerCase();
    const hit = Object.values(THEME_DEFS).find((d) => d.name.toLowerCase() === lower);
    if (hit) return hit.name;
    // Humanize slug: custom_neon → Custom Neon
    return String(themeKeyOrName)
      .replace(/_/g, " ")
      .replace(/\w/g, (c) => c.toUpperCase());
  }

  function modeLabel(mode) {
    if (!mode) return "";
    const m = String(mode).toLowerCase();
    if (m === "auto") return "Auto";
    if (m === "manual") return "Manual";
    return String(mode);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function objectId(entityId) {
    const i = entityId.indexOf(".");
    return i >= 0 ? entityId.slice(i + 1) : entityId;
  }

  function domainOf(entityId) {
    const i = entityId.indexOf(".");
    return i >= 0 ? entityId.slice(0, i) : "";
  }

  function friendlyName(hass, entityId) {
    const st = hass.states?.[entityId];
    return st?.attributes?.friendly_name || entityId;
  }

  function areaName(hass, areaId) {
    if (!areaId) return null;
    const areas = hass.areas || {};
    return areas[areaId]?.name || areaId;
  }

  function deviceName(hass, deviceId) {
    if (!deviceId) return null;
    const devices = hass.devices || {};
    const d = devices[deviceId];
    return d?.name_by_user || d?.name || null;
  }

  function isAllGroupName(name) {
    if (!name) return false;
    const n = name.toLowerCase();
    return (
      n === "all" ||
      n === "all lights" ||
      n === "all_lights" ||
      n.includes("all light") ||
      n === "everywhere"
    );
  }

  function looksLikeThemeOptions(options) {
    if (!Array.isArray(options) || options.length === 0) return false;
    const known = new Set([
      ...Object.keys(THEME_DEFS),
      ...Object.values(THEME_DEFS).map((d) => d.name.toLowerCase()),
    ]);
    const hits = options.filter((o) => known.has(String(o).toLowerCase())).length;
    return hits >= 2 || options.length >= 5;
  }

  function looksLikeModeOptions(options) {
    if (!Array.isArray(options)) return false;
    const lower = options.map((o) => String(o).toLowerCase());
    return lower.includes("auto") && lower.includes("manual");
  }

  function looksLikeEffectOptions(options) {
    if (!Array.isArray(options)) return false;
    const known = ["static", "rotate", "breathe", "twinkle", "flicker"];
    const lower = options.map((o) => String(o).toLowerCase());
    return known.filter((k) => lower.includes(k)).length >= 2;
  }

  /**
   * Classify a single glowcast entity into a role within a room group.
   * Returns: "theme" | "power" | "mode" | "speed" | "brightness" | null
   */
  function classifyEntity(entityId, hass) {
    const domain = domainOf(entityId);
    const oid = objectId(entityId).toLowerCase();
    const st = hass.states?.[entityId];
    const attrs = st?.attributes || {};

    if (domain === "switch") {
      return "power"; // show on/off (unique_id …_show)
    }
    if (domain === "select" || domain === "input_select") {
      if (oid.endsWith("_mode") || oid.includes("_mode_") || looksLikeModeOptions(attrs.options)) {
        return "mode";
      }
      if (oid.endsWith("_effect") || oid.includes("_effect") || looksLikeEffectOptions(attrs.options)) {
        return "effect";
      }
      if (
        oid.endsWith("_theme") ||
        oid.includes("_theme") ||
        looksLikeThemeOptions(attrs.options)
      ) {
        return "theme";
      }
      // Ambiguous select: prefer theme over mode if not clearly mode
      if (looksLikeModeOptions(attrs.options)) return "mode";
      return "theme";
    }
    if (domain === "number" || domain === "input_number") {
      if (oid.includes("speed")) return "speed";
      if (oid.includes("brightness") || oid.includes("bright")) return "brightness";
      const min = Number(attrs.min);
      const max = Number(attrs.max);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        if (min >= 1 && max <= 10) return "speed";
        if (min >= 0 && max >= 50 && max <= 100) return "brightness";
      }
      return "speed";
    }
    return null;
  }

  /**
   * Strip role suffixes from object_id to get a shared group key.
   * e.g. glowcast_living_room_theme → glowcast_living_room
   */
  function groupKeyFromObjectId(entityId) {
    let oid = objectId(entityId).toLowerCase();
    oid = oid.replace(
      /_(theme|mode|effect|speed|brightness|bright|power|show|switch|on_off|onoff)$/i,
      ""
    );
    // Also strip trailing _switch style leftovers
    oid = oid.replace(/_+$/, "");
    return oid || objectId(entityId);
  }

  /**
   * Discover all glowcast entities and group into room buckets.
   * Returns array of { id, name, isAll, entities: { theme, power, mode, speed, brightness } }
   */
  function discoverRooms(hass, config) {
    // Manual YAML override takes precedence when provided
    if (Array.isArray(config?.rooms) && config.rooms.length > 0) {
      return config.rooms.map((room, idx) => {
        const entities = {
          theme: room.theme || room.theme_entity || null,
          power: room.power || room.switch || room.switch_entity || room.show || null,
          mode: room.mode || room.mode_entity || null,
          effect: room.effect || room.effect_entity || null,
          speed: room.speed || room.speed_entity || null,
          brightness: room.brightness || room.brightness_entity || null,
        };
        const name = room.name || room.title || `Room ${idx + 1}`;
        return {
          id: room.id || `manual_${idx}`,
          name,
          isAll: !!room.all || isAllGroupName(name),
          entities,
        };
      });
    }

    const registry = hass.entities || {};
    const states = hass.states || {};

    // Collect entity ids belonging to glowcast platform
    const glowcastIds = [];
    for (const [eid, meta] of Object.entries(registry)) {
      if (meta?.platform === PLATFORM) {
        glowcastIds.push(eid);
      }
    }

    // Fallback: if registry empty / missing platform, match by object_id prefix
    if (glowcastIds.length === 0) {
      for (const eid of Object.keys(states)) {
        const oid = objectId(eid).toLowerCase();
        if (
          oid.startsWith("glowcast_") ||
          oid.startsWith("glowcast.") ||
          eid.toLowerCase().includes("glowcast")
        ) {
          glowcastIds.push(eid);
        }
      }
    }

    // Group by device_id when available, else by area_id, else by object_id prefix
    const groups = new Map(); // key → { deviceId, areaId, entityIds: [] }

    for (const eid of glowcastIds) {
      const meta = registry[eid] || {};
      const deviceId = meta.device_id || null;
      const areaId = meta.area_id || null;
      let key;
      if (deviceId) {
        key = `device:${deviceId}`;
      } else if (areaId) {
        key = `area:${areaId}`;
      } else {
        key = `prefix:${groupKeyFromObjectId(eid)}`;
      }
      if (!groups.has(key)) {
        groups.set(key, { deviceId, areaId, prefix: groupKeyFromObjectId(eid), entityIds: [] });
      }
      groups.get(key).entityIds.push(eid);
    }

    const rooms = [];
    for (const [key, g] of groups) {
      const entities = {
        theme: null,
        power: null,
        mode: null,
        effect: null,
        speed: null,
        brightness: null,
      };
      for (const eid of g.entityIds) {
        const role = classifyEntity(eid, hass);
        if (role && !entities[role]) {
          entities[role] = eid;
        }
      }

      // Resolve display name
      let name =
        deviceName(hass, g.deviceId) ||
        areaName(hass, g.areaId) ||
        null;

      if (!name && entities.power) {
        name = friendlyName(hass, entities.power);
      }
      if (!name && entities.theme) {
        name = friendlyName(hass, entities.theme);
      }
      if (!name) {
        // Humanize prefix: glowcast_living_room → Living Room
        name = (g.prefix || key)
          .replace(/^glowcast_?/, "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim() || "Room";
      }

      // Strip trailing role words from friendly names like "Living Room Theme"
      name = name
        .replace(/\s+(Theme|Mode|Effect|Speed|Brightness|Switch|Power|Show)$/i, "")
        .trim()
        .replace(/^GlowCast\s+/i, "")
        .trim();

      const isAll =
        isAllGroupName(name) ||
        isAllGroupName(g.prefix) ||
        (g.prefix && /(?:^|_)all(?:_lights)?(?:_|$)/.test(g.prefix));

      rooms.push({
        id: key,
        name,
        isAll,
        entities,
      });
    }

    // Sort: All lights first, then alphabetical
    rooms.sort((a, b) => {
      if (a.isAll && !b.isAll) return -1;
      if (!a.isAll && b.isAll) return 1;
      return a.name.localeCompare(b.name);
    });

    return rooms;
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const STYLES = `
    :host {
      display: block;
      --ls-radius: 14px;
      --ls-radius-sm: 10px;
      --ls-gap: 12px;
      --ls-pad: 14px;
      --ls-bg: var(--ha-card-background, var(--card-background-color, #1c1c1e));
      --ls-fg: var(--primary-text-color, #f5f5f7);
      --ls-muted: var(--secondary-text-color, #98989f);
      --ls-border: var(--divider-color, rgba(255,255,255,0.08));
      --ls-accent: var(--primary-color, #03a9f4);
      --ls-ok: #34c759;
      font-family: var(--ha-font-family-body, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      color: var(--ls-fg);
      -webkit-tap-highlight-color: transparent;
    }

    ha-card, .ls-card {
      background: var(--ls-bg);
      border-radius: var(--ha-card-border-radius, var(--ls-radius));
      box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.25));
      overflow: hidden;
      padding: 0;
    }

    .ls-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 8px;
    }

    .ls-logo {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #7928ca, #ff0080, #00d4ff);
      box-shadow: 0 0 12px rgba(255,0,128,0.35);
      flex-shrink: 0;
    }

    .ls-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0;
      flex: 1;
    }

    .ls-subtitle {
      font-size: 0.75rem;
      color: var(--ls-muted);
      margin: 0;
    }

    .ls-body {
      padding: 4px 12px 16px;
      display: flex;
      flex-direction: column;
      gap: var(--ls-gap);
    }

    .ls-section {
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--ls-border);
      border-radius: var(--ls-radius);
      padding: var(--ls-pad);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ls-section.is-all {
      background: linear-gradient(160deg, rgba(121,40,202,0.12), rgba(0,212,255,0.08));
      border-color: rgba(121,40,202,0.28);
    }

    .ls-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .ls-section-title {
      font-size: 1rem;
      font-weight: 650;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ls-badge {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(121,40,202,0.35);
      color: #e9d5ff;
    }

    /* Toggle switch */
    .ls-toggle {
      position: relative;
      width: 52px;
      height: 32px;
      flex-shrink: 0;
      cursor: pointer;
    }
    .ls-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .ls-toggle .track {
      position: absolute;
      inset: 0;
      background: rgba(120,120,128,0.32);
      border-radius: 999px;
      transition: background 0.2s ease;
    }
    .ls-toggle .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      transition: transform 0.2s ease;
    }
    .ls-toggle input:checked + .track {
      background: var(--ls-ok);
    }
    .ls-toggle input:checked + .track .thumb {
      transform: translateX(20px);
    }
    .ls-toggle input:disabled + .track {
      opacity: 0.4;
    }

    /* Mode segmented control */
    .ls-mode {
      display: inline-flex;
      flex-wrap: wrap;
      background: rgba(120,120,128,0.18);
      border-radius: 9px;
      padding: 2px;
      width: 100%;
      max-width: 280px;
    }
    .ls-mode.ls-effect {
      max-width: 100%;
    }
    .ls-mode button {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--ls-muted);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 7px 10px;
      border-radius: 7px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      -webkit-appearance: none;
      appearance: none;
      font-family: inherit;
    }
    .ls-mode button.active {
      background: var(--ls-bg);
      color: var(--ls-fg);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .ls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .ls-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--ls-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Theme grid */
    .ls-themes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
      gap: 8px;
    }

    .ls-theme-btn {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      border: 2px solid transparent;
      background: rgba(255,255,255,0.04);
      border-radius: var(--ls-radius-sm);
      padding: 6px;
      cursor: pointer;
      transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
      -webkit-appearance: none;
      appearance: none;
      font-family: inherit;
      color: var(--ls-fg);
      min-height: 72px;
      touch-action: manipulation;
    }
    .ls-theme-btn:active {
      transform: scale(0.96);
    }
    .ls-theme-btn.active {
      border-color: var(--theme-accent, var(--ls-accent));
      box-shadow: 0 0 0 1px var(--theme-accent, var(--ls-accent)),
                  0 0 14px color-mix(in srgb, var(--theme-accent, var(--ls-accent)) 45%, transparent);
    }
    .ls-theme-swatch {
      height: 36px;
      border-radius: 7px;
      width: 100%;
    }
    .ls-theme-name {
      font-size: 0.68rem;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    /* Sliders */
    .ls-sliders {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ls-slider-row {
      display: grid;
      grid-template-columns: 72px 1fr 40px;
      align-items: center;
      gap: 8px;
    }
    .ls-slider-row .ls-label {
      font-size: 0.72rem;
    }
    .ls-slider-row .val {
      font-size: 0.8rem;
      font-weight: 650;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .ls-slider-row input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: rgba(120,120,128,0.28);
      outline: none;
      margin: 0;
    }
    .ls-slider-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      cursor: pointer;
      border: none;
    }
    .ls-slider-row input[type="range"]::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      cursor: pointer;
      border: none;
    }

    .ls-empty {
      padding: 28px 16px;
      text-align: center;
      color: var(--ls-muted);
      font-size: 0.9rem;
    }
    .ls-empty code {
      background: rgba(255,255,255,0.06);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .ls-warning {
      margin: 0 12px 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(255, 159, 10, 0.12);
      border: 1px solid rgba(255, 159, 10, 0.3);
      color: #ffb340;
      font-size: 0.8rem;
    }

    @media (max-width: 420px) {
      .ls-themes {
        grid-template-columns: repeat(3, 1fr);
      }
      .ls-slider-row {
        grid-template-columns: 64px 1fr 36px;
      }
    }
  `;

  // ---------------------------------------------------------------------------
  // Card element
  // ---------------------------------------------------------------------------

  class GlowCastCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = null;
      this._rooms = [];
      this._bound = false;
    }

    static getStubConfig() {
      return {
        title: "GlowCast",
        // Optional manual override example (leave empty for auto-discovery):
        // rooms: [
        //   {
        //     name: "All lights",
        //     all: true,
        //     theme: "select.glowcast_all_lights_theme",
        //     power: "switch.glowcast_all_lights_show",
        //     mode: "select.glowcast_all_lights_mode",
        //     effect: "select.glowcast_all_lights_effect",
        //     speed: "number.glowcast_all_lights_speed",
        //     brightness: "number.glowcast_all_lights_brightness",
        //   },
        // ],
      };
    }

    static getConfigElement() {
      return document.createElement("glowcast-card-editor");
    }

    setConfig(config) {
      if (!config) throw new Error("Invalid configuration");
      this._config = { title: "GlowCast", ...config };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._rooms = discoverRooms(hass, this._config);
      this._render();
    }

    get hass() {
      return this._hass;
    }

    getCardSize() {
      const n = Math.max(this._rooms.length, 1);
      return 2 + n * 3;
    }

    _callService(domain, service, data) {
      if (!this._hass?.callService) return;
      this._hass.callService(domain, service, data);
    }

    _onPower(entityId) {
      if (!entityId) return;
      this._callService("switch", "toggle", { entity_id: entityId });
    }

    _onTheme(entityId, option) {
      if (!entityId || option == null) return;
      this._callService("select", "select_option", {
        entity_id: entityId,
        option,
      });
    }

    _onMode(entityId, option) {
      if (!entityId || option == null) return;
      this._callService("select", "select_option", {
        entity_id: entityId,
        option,
      });
    }

    _onNumber(entityId, value) {
      if (!entityId) return;
      this._callService("number", "set_value", {
        entity_id: entityId,
        value: Number(value),
      });
    }

    _themeOptions(entityId) {
      const st = this._hass?.states?.[entityId];
      const opts = st?.attributes?.options;
      if (Array.isArray(opts) && opts.length) return opts;
      // Fallback to built-in keys so UI still renders in demos
      return Object.keys(THEME_DEFS);
    }

    _state(entityId) {
      return this._hass?.states?.[entityId];
    }

    _renderSection(room) {
      const { entities, name, isAll } = room;
      const powerSt = this._state(entities.power);
      const powerOn = powerSt?.state === "on";
      const themeSt = this._state(entities.theme);
      const activeTheme = themeSt?.state || "";
      const themes = entities.theme
        ? this._themeOptions(entities.theme)
        : Object.keys(THEME_DEFS);
      const modeSt = this._state(entities.mode);
      const modeVal = modeSt?.state || "Auto";
      const speedSt = this._state(entities.speed);
      const speedVal = speedSt ? Number(speedSt.state) : 5;
      const speedMin = Number(speedSt?.attributes?.min ?? 1);
      const speedMax = Number(speedSt?.attributes?.max ?? 10);
      const brightSt = this._state(entities.brightness);
      const brightVal = brightSt ? Number(brightSt.state) : 80;
      const brightMin = Number(brightSt?.attributes?.min ?? 1);
      const brightMax = Number(brightSt?.attributes?.max ?? 100);

      const themeButtons = themes
        .map((t) => {
          const pal = paletteFor(t);
          const label = themeLabel(t);
          const active = t === activeTheme ? "active" : "";
          return `
            <button type="button" class="ls-theme-btn ${active}"
              data-action="theme" data-entity="${escapeHtml(entities.theme || "")}"
              data-option="${escapeHtml(t)}"
              style="--theme-accent: ${pal.accent}"
              ${entities.theme ? "" : "disabled"}
              aria-pressed="${t === activeTheme ? "true" : "false"}"
              title="${escapeHtml(label)}">
              <span class="ls-theme-swatch" style="background: ${pal.gradient}"></span>
              <span class="ls-theme-name">${escapeHtml(label)}</span>
            </button>`;
        })
        .join("");

      const modeOptions = (() => {
        const opts = modeSt?.attributes?.options;
        if (Array.isArray(opts) && opts.length) return opts;
        return ["auto", "manual"];
      })();

      const modeButtons = modeOptions
        .map((m) => {
          const active =
            String(m).toLowerCase() === String(modeVal).toLowerCase() ? "active" : "";
          return `<button type="button" class="${active}"
            data-action="mode" data-entity="${escapeHtml(entities.mode || "")}"
            data-option="${escapeHtml(m)}"
            ${entities.mode ? "" : "disabled"}>${escapeHtml(modeLabel(m))}</button>`;
        })
        .join("");

      const effectSt = this._state(entities.effect);
      const effectVal = effectSt?.state || "";
      const effectOptions = (() => {
        const opts = effectSt?.attributes?.options;
        if (Array.isArray(opts) && opts.length) return opts;
        return entities.effect ? ["static", "rotate", "breathe", "twinkle", "flicker"] : [];
      })();
      const effectButtons = effectOptions
        .map((e) => {
          const active = e === effectVal ? "active" : "";
          const label = String(e).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return `<button type="button" class="${active}"
            data-action="effect" data-entity="${escapeHtml(entities.effect || "")}"
            data-option="${escapeHtml(e)}"
            ${entities.effect ? "" : "disabled"}>${escapeHtml(label)}</button>`;
        })
        .join("");

      return `
        <section class="ls-section ${isAll ? "is-all" : ""}" data-room="${escapeHtml(room.id)}">
          <div class="ls-section-head">
            <h3 class="ls-section-title">
              ${escapeHtml(name)}
              ${isAll ? '<span class="ls-badge">All</span>' : ""}
            </h3>
            <label class="ls-toggle" title="Show">
              <input type="checkbox" data-action="power"
                data-entity="${escapeHtml(entities.power || "")}"
                ${powerOn ? "checked" : ""}
                ${entities.power ? "" : "disabled"} />
              <span class="track"><span class="thumb"></span></span>
            </label>
          </div>

          <div>
            <div class="ls-label" style="margin-bottom:8px">Theme</div>
            <div class="ls-themes">${themeButtons}</div>
          </div>

          <div class="ls-row">
            <span class="ls-label">Mode</span>
            <div class="ls-mode">${modeButtons}</div>
          </div>

          ${effectButtons ? `<div class="ls-row">
            <span class="ls-label">Effect</span>
            <div class="ls-mode ls-effect">${effectButtons}</div>
          </div>` : ""}

          <div class="ls-sliders">
            <div class="ls-slider-row">
              <span class="ls-label">Speed</span>
              <input type="range" min="${speedMin}" max="${speedMax}" step="1"
                value="${speedVal}"
                data-action="number" data-entity="${escapeHtml(entities.speed || "")}"
                ${entities.speed ? "" : "disabled"} />
              <span class="val">${Number.isFinite(speedVal) ? speedVal : "—"}</span>
            </div>
            <div class="ls-slider-row">
              <span class="ls-label">Bright</span>
              <input type="range" min="${brightMin}" max="${brightMax}" step="1"
                value="${brightVal}"
                data-action="number" data-entity="${escapeHtml(entities.brightness || "")}"
                ${entities.brightness ? "" : "disabled"} />
              <span class="val">${Number.isFinite(brightVal) ? brightVal + "%" : "—"}</span>
            </div>
          </div>
        </section>`;
    }

    _attachHandlers() {
      const root = this.shadowRoot;
      if (!root) return;

      root.querySelectorAll('[data-action="power"]').forEach((el) => {
        el.onchange = (ev) => {
          // Use toggle so we don't fight optimistic UI; HA will push new state
          this._onPower(el.dataset.entity);
          // Keep checkbox in sync with intended optimistic flip if no hass
          if (!this._hass?.callService) {
            /* harness: leave as-is */
          }
          ev.stopPropagation();
        };
      });

      root.querySelectorAll('[data-action="theme"]').forEach((el) => {
        el.onclick = (ev) => {
          this._onTheme(el.dataset.entity, el.dataset.option);
          ev.stopPropagation();
        };
      });

      root.querySelectorAll('[data-action="mode"]').forEach((el) => {
        el.onclick = (ev) => {
          this._onMode(el.dataset.entity, el.dataset.option);
          ev.stopPropagation();
        };
      });

      root.querySelectorAll('[data-action="effect"]').forEach((el) => {
        el.onclick = (ev) => {
          this._onMode(el.dataset.entity, el.dataset.option); // select.select_option
          ev.stopPropagation();
        };
      });

      root.querySelectorAll('[data-action="number"]').forEach((el) => {
        const commit = () => {
          const row = el.closest(".ls-slider-row");
          const valEl = row?.querySelector(".val");
          if (valEl) {
            const isBright = (el.dataset.entity || "").includes("brightness") ||
              (valEl.textContent || "").includes("%") ||
              Number(el.max) >= 50;
            valEl.textContent = isBright ? `${el.value}%` : el.value;
          }
          this._onNumber(el.dataset.entity, el.value);
        };
        el.oninput = () => {
          const row = el.closest(".ls-slider-row");
          const valEl = row?.querySelector(".val");
          if (valEl) {
            const isBright =
              (el.dataset.entity || "").toLowerCase().includes("brightness") ||
              Number(el.max) >= 50;
            valEl.textContent = isBright ? `${el.value}%` : el.value;
          }
        };
        el.onchange = commit;
      });
    }

    _render() {
      if (!this.shadowRoot) return;
      const title = this._config?.title || "GlowCast";
      const rooms = this._rooms || [];
      const hasHass = !!this._hass;

      let body;
      if (!hasHass) {
        body = `<div class="ls-empty">Waiting for Home Assistant…</div>`;
      } else if (rooms.length === 0) {
        body = `
          <div class="ls-empty">
            No GlowCast entities found.<br/><br/>
            Make sure the <code>glowcast</code> integration is loaded,<br/>
            or set <code>rooms:</code> manually in the card YAML.
          </div>`;
      } else {
        body = `<div class="ls-body">${rooms.map((r) => this._renderSection(r)).join("")}</div>`;
      }

      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <div class="ls-card">
          <div class="ls-header">
            <div class="ls-logo" aria-hidden="true"></div>
            <div>
              <h2 class="ls-title">${escapeHtml(title)}</h2>
              <p class="ls-subtitle">${rooms.length ? rooms.length + " zone" + (rooms.length === 1 ? "" : "s") : "Sync your lights"}</p>
            </div>
          </div>
          ${body}
        </div>
      `;
      this._attachHandlers();
    }
  }

  // ---------------------------------------------------------------------------
  // Simple config editor
  // ---------------------------------------------------------------------------

  class GlowCastCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = null;
    }

    setConfig(config) {
      this._config = { ...config };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
    }

    _fire(config) {
      this._config = config;
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config },
          bubbles: true,
          composed: true,
        })
      );
    }

    _render() {
      const title = this._config.title || "GlowCast";
      const roomsYaml = Array.isArray(this._config.rooms)
        ? JSON.stringify(this._config.rooms, null, 2)
        : "";
      this.shadowRoot.innerHTML = `
        <style>
          .wrap { padding: 4px 0; display: flex; flex-direction: column; gap: 12px;
            font-family: var(--ha-font-family-body, sans-serif); color: var(--primary-text-color); }
          label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; font-weight: 600; }
          input, textarea {
            font: inherit; font-weight: 400; padding: 8px 10px; border-radius: 8px;
            border: 1px solid var(--divider-color, #444);
            background: var(--card-background-color, #1c1c1e);
            color: inherit;
          }
          textarea { min-height: 120px; font-family: ui-monospace, monospace; font-size: 0.8rem; }
          .hint { font-size: 0.75rem; font-weight: 400; color: var(--secondary-text-color, #98989f); }
        </style>
        <div class="wrap">
          <label>
            Title
            <input type="text" id="title" value="${escapeHtml(title)}" />
          </label>
          <label>
            Rooms override (JSON array, optional)
            <span class="hint">Leave empty to auto-discover entities with platform = glowcast.
            Each room: { "name", "all"?, "theme", "power", "mode", "effect"?, "speed", "brightness" }</span>
            <textarea id="rooms" placeholder='[{"name":"All lights","all":true,"theme":"select.glowcast_all_theme",...}]'>${escapeHtml(roomsYaml)}</textarea>
          </label>
        </div>
      `;
      const titleEl = this.shadowRoot.getElementById("title");
      const roomsEl = this.shadowRoot.getElementById("rooms");
      titleEl.oninput = () => {
        this._fire({ ...this._config, title: titleEl.value });
      };
      roomsEl.onchange = () => {
        const raw = roomsEl.value.trim();
        if (!raw) {
          const next = { ...this._config };
          delete next.rooms;
          this._fire(next);
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) throw new Error("rooms must be an array");
          this._fire({ ...this._config, rooms: parsed });
        } catch (e) {
          // Keep typing; don't fire invalid config
          roomsEl.style.borderColor = "#ff453a";
          return;
        }
        roomsEl.style.borderColor = "";
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  if (!customElements.get(CARD_TYPE)) {
    customElements.define(CARD_TYPE, GlowCastCard);
  }
  if (!customElements.get("glowcast-card-editor")) {
    customElements.define("glowcast-card-editor", GlowCastCardEditor);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === CARD_TYPE)) {
    window.customCards.push({
      type: CARD_TYPE,
      name: CARD_NAME,
      description:
        "Control GlowCast lighting themes, modes, speed, and brightness by room.",
      preview: true,
      documentationURL: "https://github.com/local/glowcast-card",
    });
  }

  // Expose helpers for the self-test harness
  window.GlowCastCardHelpers = {
    discoverRooms,
    classifyEntity,
    paletteFor,
    themeLabel,
    THEME_PALETTE,
    THEME_DEFS,
    PLATFORM,
    CARD_TYPE,
  };
})();

/**
 * GlowCast Card — Home Assistant Lovelace custom card (v0.2)
 * Domain: glowcast
 *
 * Compact Bubble-style room pills + bottom-sheet pop-up.
 * Single-file vanilla JS. No build step.
 * Resource: /local/glowcast-card.js (type: module)
 *
 * v0.2 UX: optimistic theme selection, ignore duplicate taps while pending,
 * in-place DOM updates (no full rebuild on every hass push).
 */
(() => {
  "use strict";

  const CARD_TYPE = "glowcast-card";
  const CARD_NAME = "GlowCast Card";
  const PLATFORM = "glowcast";
  const VERSION = "0.2.2";
  const THEME_PENDING_MS = 5000;
  const LONG_PRESS_MS = 450;
  const COLOR_THROTTLE_MS = 300;
  const RECENT_COLORS_KEY = "glowcast-card-recent-colors";
  const RECENT_COLORS_MAX = 5;

  const QUICK_SWATCHES = [
    { name: "Warm white", rgb: [255, 244, 229] },
    { name: "Red", rgb: [255, 59, 48] },
    { name: "Orange", rgb: [255, 149, 0] },
    { name: "Yellow", rgb: [255, 214, 10] },
    { name: "Green", rgb: [52, 199, 89] },
    { name: "Cyan", rgb: [50, 215, 232] },
    { name: "Blue", rgb: [0, 122, 255] },
    { name: "Purple", rgb: [175, 82, 222] },
    { name: "Pink", rgb: [255, 45, 85] },
  ];

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

  const THEME_PALETTE = {};
  for (const [key, def] of Object.entries(THEME_DEFS)) {
    THEME_PALETTE[key] = def;
    THEME_PALETTE[def.name] = def;
  }

  const FALLBACK_PALETTE = {
    name: null,
    gradient: "linear-gradient(135deg, #3a3a3a 0%, #6a6a6a 50%, #9a9a9a 100%)",
    accent: "#888888",
  };

  const DEFAULT_ICONS = {
    all_lights: "mdi:lightbulb-group",
    kitchen: "mdi:silverware-fork-knife",
    nerd_cave: "mdi:desktop-classic",
    living_room: "mdi:sofa",
    bedroom: "mdi:bed",
    bathroom: "mdi:shower",
    office: "mdi:desk",
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
    const slug = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (THEME_DEFS[slug]) return THEME_DEFS[slug];
    return FALLBACK_PALETTE;
  }

  function themeLabel(themeKeyOrName) {
    if (!themeKeyOrName) return "";
    if (themeKeyOrName === "custom_color") return "Custom";
    const def = THEME_PALETTE[themeKeyOrName] || THEME_DEFS[themeKeyOrName];
    if (def?.name) return def.name;
    const lower = String(themeKeyOrName).toLowerCase();
    const hit = Object.values(THEME_DEFS).find((d) => d.name.toLowerCase() === lower);
    if (hit) return hit.name;
    return String(themeKeyOrName)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function modeLabel(mode) {
    if (!mode) return "";
    const m = String(mode).toLowerCase();
    if (m === "auto") return "Auto";
    if (m === "manual") return "Manual";
    return String(mode);
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rgbToHex(r, g, b) {
    const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    let h = String(hex).trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /** HSV: h 0-360, s/v 0-1 → RGB 0-255 */
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1);
    v = clamp(v, 0, 1);
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let rp = 0, gp = 0, bp = 0;
    if (h < 60) [rp, gp, bp] = [c, x, 0];
    else if (h < 120) [rp, gp, bp] = [x, c, 0];
    else if (h < 180) [rp, gp, bp] = [0, c, x];
    else if (h < 240) [rp, gp, bp] = [0, x, c];
    else if (h < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];
    return [
      Math.round((rp + m) * 255),
      Math.round((gp + m) * 255),
      Math.round((bp + m) * 255),
    ];
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }

  function loadRecentColors() {
    try {
      const raw = localStorage.getItem(RECENT_COLORS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((c) => {
          if (Array.isArray(c) && c.length >= 3) return [Number(c[0]), Number(c[1]), Number(c[2])];
          if (typeof c === "string") return hexToRgb(c);
          return null;
        })
        .filter((c) => c && c.every((n) => Number.isFinite(n)))
        .slice(0, RECENT_COLORS_MAX);
    } catch (_) {
      return [];
    }
  }

  function saveRecentColor(rgb) {
    if (!rgb || rgb.length < 3) return;
    const next = [clamp(Math.round(rgb[0]), 0, 255), clamp(Math.round(rgb[1]), 0, 255), clamp(Math.round(rgb[2]), 0, 255)];
    const hex = rgbToHex(...next).toLowerCase();
    const prev = loadRecentColors().filter((c) => rgbToHex(...c).toLowerCase() !== hex);
    prev.unshift(next);
    try {
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(prev.slice(0, RECENT_COLORS_MAX)));
    } catch (_) { /* private mode */ }
  }

  function parseRgbAttr(val) {
    if (!val) return null;
    if (Array.isArray(val) && val.length >= 3) {
      return [Number(val[0]), Number(val[1]), Number(val[2])];
    }
    if (typeof val === "string") {
      const m = val.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      return hexToRgb(val);
    }
    return null;
  }

  function lightSupportsColor(attrs) {
    if (!attrs) return false;
    const modes = attrs.supported_color_modes || attrs.supported_color_modes;
    const list = Array.isArray(modes) ? modes : modes ? [...modes] : [];
    if (list.some((m) => ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(String(m)))) return true;
    // Legacy feature bits
    const feat = Number(attrs.supported_features || 0);
    return !!(feat & 16) || !!(feat & 2); // SUPPORT_COLOR / HS roughly
  }

  function effectLabel(effect) {
    return String(effect || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
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
    return hass.areas?.[areaId]?.name || areaId;
  }

  function areaIcon(hass, areaId) {
    if (!areaId) return null;
    return hass.areas?.[areaId]?.icon || null;
  }

  function deviceName(hass, deviceId) {
    if (!deviceId) return null;
    const d = hass.devices?.[deviceId];
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

  function classifyEntity(entityId, hass) {
    const domain = domainOf(entityId);
    const oid = objectId(entityId).toLowerCase();
    const st = hass.states?.[entityId];
    const attrs = st?.attributes || {};

    if (domain === "light" && (oid.endsWith("_color") || oid.includes("_color"))) {
      return "colorLight";
    }
    if (domain === "switch") return "power";
    if (domain === "select" || domain === "input_select") {
      if (oid.endsWith("_mode") || oid.includes("_mode_") || looksLikeModeOptions(attrs.options)) {
        return "mode";
      }
      if (
        oid.endsWith("_effect") ||
        oid.includes("_effect") ||
        looksLikeEffectOptions(attrs.options)
      ) {
        return "effect";
      }
      if (
        oid.endsWith("_theme") ||
        oid.includes("_theme") ||
        looksLikeThemeOptions(attrs.options)
      ) {
        return "theme";
      }
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

  function groupKeyFromObjectId(entityId) {
    let oid = objectId(entityId).toLowerCase();
    oid = oid.replace(
      /_(theme|mode|effect|speed|brightness|bright|power|show|switch|on_off|onoff)$/i,
      ""
    );
    oid = oid.replace(/^glowcast_?/, "");
    return oid.replace(/_+$/, "") || objectId(entityId);
  }

  function defaultIconFor(roomId, name, hass, areaId) {
    if (DEFAULT_ICONS[roomId]) return DEFAULT_ICONS[roomId];
    const fromArea = areaIcon(hass, areaId);
    if (fromArea) return fromArea;
    if (isAllGroupName(name) || roomId === "all_lights") return "mdi:lightbulb-group";
    return "mdi:lightbulb-group";
  }

  /**
   * Discover rooms. Config may include:
   *   rooms: [{ id, name, icon, theme, power/show, mode, effect, speed, brightness, all }]
   *   columns: number
   * Or rooms as map: { all_lights: { name, icon }, kitchen: { icon } } merged onto discovery.
   */
  function discoverRooms(hass, config) {
    const cfgRooms = config?.rooms;
    const overrideList = Array.isArray(cfgRooms) ? cfgRooms : null;
    const overrideMap =
      cfgRooms && !Array.isArray(cfgRooms) && typeof cfgRooms === "object"
        ? cfgRooms
        : null;

    if (overrideList && overrideList.length > 0 && overrideList.some((r) => r.theme || r.power || r.switch || r.show)) {
      return overrideList.map((room, idx) => {
        const id = room.id || room.room_id || `manual_${idx}`;
        const name = room.name || room.title || id;
        return {
          id,
          name,
          icon: room.icon || defaultIconFor(id, name, hass, room.area_id),
          isAll: !!room.all || isAllGroupName(name) || id === "all_lights",
          areaId: room.area_id || null,
          entities: {
            theme: room.theme || room.theme_entity || null,
            power: room.power || room.switch || room.switch_entity || room.show || null,
            mode: room.mode || room.mode_entity || null,
            effect: room.effect || room.effect_entity || null,
            speed: room.speed || room.speed_entity || null,
            brightness: room.brightness || room.brightness_entity || null,
            colorLight: room.color_light || room.colorLight || `light.glowcast_${id}_color`,
          },
        };
      });
    }

    const registry = hass.entities || {};
    const states = hass.states || {};
    const glowcastIds = [];
    for (const [eid, meta] of Object.entries(registry)) {
      if (meta?.platform === PLATFORM) glowcastIds.push(eid);
    }
    if (glowcastIds.length === 0) {
      for (const eid of Object.keys(states)) {
        const oid = objectId(eid).toLowerCase();
        if (oid.startsWith("glowcast_") || eid.toLowerCase().includes("glowcast")) {
          glowcastIds.push(eid);
        }
      }
    }

    const groups = new Map();
    for (const eid of glowcastIds) {
      const meta = registry[eid] || {};
      const deviceId = meta.device_id || null;
      const areaId = meta.area_id || null;
      const prefix = groupKeyFromObjectId(eid);
      let key;
      if (deviceId) key = `device:${deviceId}`;
      else if (areaId) key = `area:${areaId}`;
      else key = `prefix:${prefix}`;
      if (!groups.has(key)) {
        groups.set(key, { deviceId, areaId, prefix, entityIds: [] });
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
        colorLight: null,
      };
      for (const eid of g.entityIds) {
        const role = classifyEntity(eid, hass);
        if (role && !entities[role]) entities[role] = eid;
      }

      let roomId = g.prefix || key;
      // Prefer object_id slug from any entity
      const sample = g.entityIds[0];
      if (sample) roomId = groupKeyFromObjectId(sample);

      let name =
        deviceName(hass, g.deviceId) ||
        areaName(hass, g.areaId) ||
        null;
      if (!name && entities.power) name = friendlyName(hass, entities.power);
      if (!name && entities.theme) name = friendlyName(hass, entities.theme);
      if (!name) {
        name = roomId
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim() || "Room";
      }
      name = name
        .replace(/\s+(Theme|Mode|Effect|Speed|Brightness|Switch|Power|Show)$/i, "")
        .trim()
        .replace(/^GlowCast\s+/i, "")
        .trim();

      const isAll =
        isAllGroupName(name) ||
        isAllGroupName(roomId) ||
        roomId === "all_lights" ||
        /(?:^|_)all(?:_lights)?(?:_|$)/.test(roomId);

      // Config map overrides (name/icon only, or full)
      let icon = defaultIconFor(roomId, name, hass, g.areaId);
      if (overrideMap && (overrideMap[roomId] || overrideMap[g.prefix])) {
        const ov = overrideMap[roomId] || overrideMap[g.prefix];
        if (ov.name) name = ov.name;
        if (ov.icon) icon = ov.icon;
        if (ov.theme) entities.theme = ov.theme;
        if (ov.power || ov.show || ov.switch) {
          entities.power = ov.power || ov.show || ov.switch;
        }
        if (ov.mode) entities.mode = ov.mode;
        if (ov.effect) entities.effect = ov.effect;
        if (ov.speed) entities.speed = ov.speed;
        if (ov.brightness) entities.brightness = ov.brightness;
      }
      if (overrideList) {
        const ov = overrideList.find(
          (r) => (r.id || r.room_id) === roomId || r.name === name
        );
        if (ov) {
          if (ov.name) name = ov.name;
          if (ov.icon) icon = ov.icon;
        }
      }

      if (!entities.colorLight) {
        const guess = `light.glowcast_${roomId}_color`;
        if (hass.states?.[guess] || registry[guess]) entities.colorLight = guess;
        else entities.colorLight = guess; // Poke 0.1.2 contract
      }

      rooms.push({
        id: roomId,
        name,
        icon,
        isAll,
        areaId: g.areaId,
        entities,
      });
    }

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
      --gc-bg: var(--ha-card-background, var(--card-background-color, var(--mdc-theme-surface, #fff)));
      --gc-fg: var(--primary-text-color, #212121);
      --gc-muted: var(--secondary-text-color, #727272);
      --gc-border: var(--divider-color, rgba(0,0,0,0.12));
      --gc-ok: var(--switch-checked-color, var(--success-color, #34c759));
      --gc-primary: var(--primary-color, #03a9f4);
      --gc-overlay: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      --gc-overlay-strong: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
      --gc-chip-bg: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
      --gc-handle: color-mix(in srgb, var(--primary-text-color) 28%, transparent);
      --gc-thumb: var(--switch-unchecked-button-color, #fff);
      --gc-radius: var(--ha-card-border-radius, 18px);
      --gc-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.12));
      --gc-backdrop: color-mix(in srgb, #000 45%, transparent);
      --gc-sheet-shadow: 0 -8px 40px color-mix(in srgb, #000 28%, transparent);
      font-family: var(--ha-font-family-body, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      color: var(--gc-fg);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .gc-card {
      background: var(--gc-bg);
      border-radius: var(--gc-radius);
      box-shadow: var(--gc-shadow);
      border: var(--ha-card-border-width, 0px) solid var(--ha-card-border-color, var(--gc-border));
      padding: 12px 12px 14px;
      overflow: hidden;
      color: var(--gc-fg);
    }
    .gc-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:0 2px; }
    .gc-logo {
      width:22px; height:22px; border-radius:7px; flex-shrink:0;
      background: linear-gradient(135deg, var(--gc-primary), #ff0080, #00d4ff);
      box-shadow: 0 0 10px color-mix(in srgb, var(--gc-primary) 40%, transparent);
    }
    .gc-title { font-size:0.95rem; font-weight:700; margin:0; letter-spacing:-0.01em; flex:1; color:var(--gc-fg); }
    .gc-sub { font-size:0.7rem; color:var(--gc-muted); margin:0; }
    .gc-grid { display:grid; grid-template-columns:repeat(var(--gc-cols,3),minmax(0,1fr)); gap:10px; }
    .gc-room {
      position:relative; display:flex; flex-direction:column; align-items:center; gap:6px;
      padding:10px 6px 8px; border:1px solid var(--gc-border); background:var(--gc-overlay);
      border-radius:16px; cursor:pointer; color:inherit; font-family:inherit;
      -webkit-appearance:none; appearance:none; transition:transform .12s ease, background .15s;
      min-height:88px; user-select:none;
    }
    .gc-room:active { transform:scale(0.96); }
    .gc-room.on { background:var(--gc-overlay-strong); }
    .gc-orb {
      position:relative; width:52px; height:52px; border-radius:50%; display:grid; place-items:center;
      background:var(--gc-overlay-strong); transition:box-shadow .25s ease, background .25s ease;
    }
    .gc-room.on .gc-orb {
      background: color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 22%, var(--gc-bg));
      box-shadow:
        0 0 0 2px color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 70%, transparent),
        0 0 16px color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 45%, transparent);
    }
    .gc-orb ha-icon, .gc-orb .gc-mdi { --mdc-icon-size:26px; width:26px; height:26px; color:var(--gc-fg); opacity:.92; }
    .gc-mdi { display:inline-block; font-size:0; }
    .gc-mdi svg { width:26px; height:26px; fill:currentColor; }
    .gc-room-name {
      font-size:.72rem; font-weight:650; text-align:center; line-height:1.2; max-width:100%; color:var(--gc-fg);
      overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    }
    .gc-power-dot {
      position:absolute; top:8px; right:8px; width:14px; height:14px; border-radius:50%;
      border:2px solid var(--gc-border); background:var(--gc-handle); padding:0; cursor:pointer; z-index:2;
      -webkit-appearance:none; appearance:none;
    }
    .gc-room.on .gc-power-dot {
      background:var(--gc-ok);
      border-color: color-mix(in srgb, var(--gc-ok) 60%, var(--gc-bg));
      box-shadow: 0 0 8px color-mix(in srgb, var(--gc-ok) 55%, transparent);
    }
    .gc-empty { text-align:center; color:var(--gc-muted); font-size:.85rem; padding:18px 8px; }
    .gc-empty code { background:var(--gc-overlay-strong); padding:2px 6px; border-radius:4px; font-size:.75rem; color:var(--gc-fg); }
    .gc-backdrop {
      position:fixed; inset:0; background:var(--gc-backdrop); z-index:10000; opacity:0; pointer-events:none;
      transition:opacity .22s ease; -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px);
    }
    .gc-backdrop.open { opacity:1; pointer-events:auto; }
    .gc-sheet {
      position:fixed; left:0; right:0; bottom:0; z-index:10001; max-height:min(88vh,720px);
      background: var(--ha-dialog-surface-background, var(--gc-bg));
      color: var(--gc-fg);
      border-radius: calc(var(--gc-radius) + 2px) calc(var(--gc-radius) + 2px) 0 0;
      box-shadow: var(--gc-sheet-shadow);
      border:1px solid var(--gc-border); border-bottom:none;
      transform:translateY(110%); transition:transform .28s cubic-bezier(.2,.9,.2,1);
      display:flex; flex-direction:column; padding:0 0 calc(12px + env(safe-area-inset-bottom,0px));
      touch-action:pan-y;
    }
    .gc-sheet.open { transform:translateY(0); }
    .gc-sheet-handle { width:36px; height:4px; border-radius:999px; background:var(--gc-handle); margin:10px auto 4px; flex-shrink:0; }
    .gc-sheet-head { display:flex; align-items:center; gap:12px; padding:8px 16px 12px; }
    .gc-sheet-orb {
      width:44px; height:44px; border-radius:50%; display:grid; place-items:center; flex-shrink:0;
      background: color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 22%, var(--gc-bg));
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 55%, transparent);
    }
    .gc-sheet-orb ha-icon, .gc-sheet-orb .gc-mdi { --mdc-icon-size:24px; width:24px; height:24px; color:var(--gc-fg); }
    .gc-sheet-orb .gc-mdi svg { width:24px; height:24px; fill:currentColor; }
    .gc-sheet-titles { flex:1; min-width:0; }
    .gc-sheet-titles h3 { margin:0; font-size:1.1rem; font-weight:700; letter-spacing:-0.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--gc-fg); }
    .gc-sheet-titles p { margin:2px 0 0; font-size:.75rem; color:var(--gc-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gc-close {
      width:32px; height:32px; border-radius:50%; border:1px solid var(--gc-border);
      background:var(--gc-overlay-strong); color:var(--gc-fg); font-size:1.1rem; line-height:1;
      cursor:pointer; flex-shrink:0; -webkit-appearance:none; appearance:none;
    }
    .gc-big-toggle {
      display:flex; align-items:center; justify-content:space-between; margin:0 16px 14px; padding:12px 14px;
      border-radius:14px; background:var(--gc-overlay); border:1px solid var(--gc-border); color:var(--gc-fg);
    }
    .gc-big-toggle .lbl { font-weight:650; font-size:.9rem; }
    .gc-switch { position:relative; width:52px; height:32px; flex-shrink:0; cursor:pointer; }
    .gc-switch input { opacity:0; width:0; height:0; position:absolute; }
    .gc-switch .track { position:absolute; inset:0; border-radius:999px; background:var(--switch-unchecked-track-color, var(--gc-handle)); transition:background .2s; }
    .gc-switch .thumb { position:absolute; top:2px; left:2px; width:28px; height:28px; border-radius:50%; background:var(--gc-thumb); box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .2s; }
    .gc-switch input:checked + .track { background:var(--switch-checked-track-color, var(--gc-ok)); }
    .gc-switch input:checked + .track .thumb { transform:translateX(20px); background:var(--switch-checked-button-color, var(--gc-thumb)); }
    .gc-sheet-body { padding:0 16px 8px; overflow-y:auto; -webkit-overflow-scrolling:touch; display:flex; flex-direction:column; gap:14px; }
    .gc-label { font-size:.68rem; font-weight:700; color:var(--gc-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
    .gc-themes { display:flex; gap:8px; overflow-x:auto; padding:2px 2px 8px; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
    .gc-themes::-webkit-scrollbar { display:none; }
    .gc-chip {
      flex:0 0 auto; scroll-snap-align:start; display:flex; flex-direction:column; align-items:center; gap:5px;
      width:64px; padding:6px 4px; border:2px solid transparent; border-radius:12px; background:var(--gc-chip-bg);
      color:inherit; font-family:inherit; cursor:pointer; -webkit-appearance:none; appearance:none;
      transition:border-color .12s, box-shadow .12s, transform .1s, opacity .15s;
    }
    .gc-chip:active { transform:scale(0.95); }
    .gc-chip.active {
      border-color: var(--gc-accent, var(--gc-primary));
      box-shadow: 0 0 0 1px var(--gc-accent, var(--gc-primary)), 0 0 12px color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 40%, transparent);
    }
    .gc-chip.pending { opacity:.85; }
    .gc-chip.disabled-pending { pointer-events:none; }
    .gc-chip.custom-chip .gc-swatch { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 20%, transparent); }
    .gc-swatch { width:40px; height:40px; border-radius:50%; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 12%, transparent); }
    .gc-chip-name { font-size:.6rem; font-weight:650; text-align:center; line-height:1.15; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; color:var(--gc-fg); }
    .gc-seg { display:inline-flex; background:var(--gc-overlay-strong); border-radius:9px; padding:2px; width:100%; max-width:240px; }
    .gc-seg button { flex:1; border:none; background:transparent; color:var(--gc-muted); font-size:.8rem; font-weight:650; padding:8px 10px; border-radius:7px; cursor:pointer; font-family:inherit; -webkit-appearance:none; appearance:none; }
    .gc-seg button.active { background:var(--gc-bg); color:var(--gc-fg); box-shadow:0 1px 3px rgba(0,0,0,.15); }
    .gc-effects { display:flex; flex-wrap:wrap; gap:6px; }
    .gc-effects button { border:1px solid var(--gc-border); background:var(--gc-chip-bg); color:var(--gc-muted); font-size:.72rem; font-weight:650; padding:7px 11px; border-radius:999px; cursor:pointer; font-family:inherit; -webkit-appearance:none; appearance:none; }
    .gc-effects button.active { color:var(--gc-fg); border-color:color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 55%, transparent); background:color-mix(in srgb, var(--gc-accent, var(--gc-primary)) 18%, var(--gc-bg)); }
    .gc-sliders { display:flex; flex-direction:column; gap:10px; }
    .gc-slider-row { display:grid; grid-template-columns:64px 1fr 40px; align-items:center; gap:8px; }
    .gc-slider-row .gc-label { margin:0; font-size:.68rem; }
    .gc-slider-row .val { font-size:.8rem; font-weight:650; text-align:right; font-variant-numeric:tabular-nums; color:var(--gc-fg); }
    .gc-slider-row input[type="range"] { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:999px; background:var(--gc-overlay-strong); outline:none; margin:0; }
    .gc-slider-row input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:22px; height:22px; border-radius:50%; background:var(--gc-primary); box-shadow:0 1px 4px rgba(0,0,0,.25); cursor:pointer; border:2px solid var(--gc-bg); }
    .gc-slider-row input[type="range"]::-moz-range-thumb { width:22px; height:22px; border-radius:50%; background:var(--gc-primary); box-shadow:0 1px 4px rgba(0,0,0,.25); cursor:pointer; border:2px solid var(--gc-bg); }
    .gc-row { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
    .gc-color-section { display:flex; flex-direction:column; gap:8px; }
    .gc-color-toggle {
      display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px;
      border:1px solid var(--gc-border); border-radius:12px; background:var(--gc-overlay);
      color:inherit; font-family:inherit; font-weight:650; font-size:.85rem; cursor:pointer; -webkit-appearance:none; appearance:none; text-align:left;
    }
    .gc-color-toggle .gc-color-preview { width:28px; height:28px; border-radius:50%; flex-shrink:0; box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 18%, transparent); background:#ff9500; }
    .gc-color-toggle .chev { margin-left:auto; color:var(--gc-muted); font-size:.85rem; }
    .gc-color-panel { display:none; flex-direction:column; gap:12px; padding:12px; border-radius:14px; background:var(--gc-overlay); border:1px solid var(--gc-border); }
    .gc-color-panel.open { display:flex; }
    .gc-wheel-wrap { display:flex; flex-direction:column; align-items:center; gap:10px; }
    .gc-wheel { width:200px; height:200px; border-radius:50%; touch-action:none; cursor:crosshair; box-shadow:0 0 0 1px var(--gc-border); background:var(--gc-overlay-strong); }
    .gc-value-row { display:grid; grid-template-columns:56px 1fr 44px; align-items:center; gap:8px; width:100%; max-width:240px; }
    .gc-value-row input[type="range"] { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:999px; background:linear-gradient(90deg,#000,var(--gc-value-hue, var(--gc-primary))); outline:none; margin:0; }
    .gc-value-row input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:20px; height:20px; border-radius:50%; background:var(--gc-bg); border:2px solid var(--gc-fg); box-shadow:0 1px 4px rgba(0,0,0,.25); cursor:pointer; }
    .gc-quick { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .gc-quick-label { width:100%; font-size:.65rem; font-weight:700; color:var(--gc-muted); text-transform:uppercase; letter-spacing:.04em; }
    .gc-qswatch { width:32px; height:32px; border-radius:50%; border:2px solid transparent; padding:0; cursor:pointer; box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 15%, transparent); -webkit-appearance:none; appearance:none; background:#888; }
    .gc-qswatch.active { border-color:var(--gc-fg); box-shadow:0 0 0 2px color-mix(in srgb, var(--primary-text-color) 25%, transparent); }
    .gc-qswatch.recent { outline:1px dashed color-mix(in srgb, var(--primary-text-color) 30%, transparent); outline-offset:1px; }
    .gc-hex-row { display:flex; align-items:center; gap:8px; }
    .gc-hex-row .preview { width:36px; height:36px; border-radius:10px; flex-shrink:0; box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--primary-text-color) 18%, transparent); }
    .gc-hex-row input { flex:1; font:inherit; font-size:.85rem; font-weight:650; padding:8px 10px; border-radius:10px; border:1px solid var(--gc-border); background:var(--gc-bg); color:var(--gc-fg); font-variant-numeric:tabular-nums; letter-spacing:.04em; text-transform:uppercase; }
    .gc-color-actions { display:flex; gap:8px; }
    .gc-apply-color, .gc-clear-color {
      flex:1; padding:11px 12px; border-radius:12px; border:none; cursor:pointer; font-family:inherit; font-weight:700; font-size:.85rem;
      -webkit-appearance:none; appearance:none;
    }
    .gc-apply-color { color: var(--text-primary-color, #fff); background: var(--gc-primary); }
    .gc-clear-color { color: var(--gc-fg); background: var(--gc-overlay-strong); border:1px solid var(--gc-border); }
    @media (max-width:360px) { .gc-grid { gap:8px; } .gc-orb { width:46px; height:46px; } }
  `;

  // Simple mdi path fallbacks when ha-icon isn't available (harness)
  const MDI_PATHS = {
    "mdi:lightbulb-group":
      "M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7M9 21v-1h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1m0-3h6v1H9v-1Z",
    "mdi:silverware-fork-knife":
      "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7m5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4Z",
    "mdi:desktop-classic":
      "M6 2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4l2 4v1H8v-1l2-4H6a2 2 0 0 1-2-2V4c0-1.11.89-2 2-2m0 2v8h12V4H6Z",
    "mdi:sofa":
      "M7 6c-1.1 0-2 .9-2 2v2h2V6h10v4h2V8c0-1.1-.9-2-2-2H7M5 10c-1.66 0-3 1.34-3 3v3h2v-2c0-.55.45-1 1-1h1v4h14v-4h1c.55 0 1 .45 1 1v2h2v-3c0-1.66-1.34-3-3-3H5Z",
    "mdi:bed":
      "M19 7H5v4h14V7m0-2a2 2 0 0 1 2 2v6h2v4h-2v2h-2v-2H5v2H3v-2H1v-4h2V7a2 2 0 0 1 2-2h14Z",
  };

  function iconHtml(icon) {
    const ic = icon || "mdi:lightbulb-group";
    // Prefer ha-icon when custom element exists
    if (typeof customElements !== "undefined" && customElements.get("ha-icon")) {
      return `<ha-icon icon="${escapeHtml(ic)}"></ha-icon>`;
    }
    const path = MDI_PATHS[ic] || MDI_PATHS["mdi:lightbulb-group"];
    return `<span class="gc-mdi" data-icon="${escapeHtml(ic)}" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg></span>`;
  }

  // ---------------------------------------------------------------------------
  // Card
  // ---------------------------------------------------------------------------

  class GlowCastCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
      this._hass = null;
      this._rooms = [];
      this._built = false;
      this._openRoomId = null;
      /** @type {Map<string, {option:string, until:number, timer:any}>} */
      this._pendingTheme = new Map();
      this._lpTimer = null;
      this._lpFired = false;
      this._sheetDragY = 0;
      this._delegated = false;
      this._renderGen = 0;
      this._colorOpen = false;
      this._color = { h: 30, s: 1, v: 1 }; // HSV
      this._colorDragging = false;
      this._colorLastSent = 0;
      this._colorThrottleTimer = null;
      this._wheelBound = false;
    }

    static getStubConfig() {
      return {
        title: "GlowCast",
        columns: 3,
        // rooms: { all_lights: { icon: "mdi:lightbulb-group" }, kitchen: { icon: "mdi:silverware-fork-knife", name: "Kitchen" } }
      };
    }

    static getConfigElement() {
      return document.createElement("glowcast-card-editor");
    }

    setConfig(config) {
      if (!config) throw new Error("Invalid configuration");
      this._config = { title: "GlowCast", columns: 3, ...config };
      this._built = false;
      this._renderShell();
      if (this._hass) {
        this._rooms = discoverRooms(this._hass, this._config);
        this._buildOrUpdate(true);
      }
    }

    set hass(hass) {
      this._hass = hass;
      const prevOpen = this._openRoomId;
      this._rooms = discoverRooms(hass, this._config);
      this._reconcilePendingThemes();
      if (!this._built) {
        this._renderShell();
        this._buildOrUpdate(true);
      } else {
        this._buildOrUpdate(false);
      }
      // Keep popup open across hass updates
      if (prevOpen && this._rooms.some((r) => r.id === prevOpen)) {
        this._openRoomId = prevOpen;
      }
    }

    get hass() {
      return this._hass;
    }

    getCardSize() {
      const cols = Number(this._config.columns) || 3;
      const rows = Math.ceil(Math.max(this._rooms.length, 1) / cols);
      return 1 + rows;
    }

    disconnectedCallback() {
      for (const p of this._pendingTheme.values()) {
        if (p.timer) clearTimeout(p.timer);
      }
      this._pendingTheme.clear();
    }

    // ---- services ----
    _callService(domain, service, data) {
      if (!this._hass?.callService) return;
      this._hass.callService(domain, service, data);
    }

    _togglePower(entityId) {
      if (!entityId) return;
      this._callService("switch", "toggle", { entity_id: entityId });
    }

    _selectOption(entityId, option) {
      if (!entityId || option == null) return;
      this._callService("select", "select_option", { entity_id: entityId, option });
    }

    _setNumber(entityId, value) {
      if (!entityId) return;
      this._callService("number", "set_value", {
        entity_id: entityId,
        value: Number(value),
      });
    }

    _state(entityId) {
      return this._hass?.states?.[entityId];
    }

    _effectiveTheme(room) {
      const eid = room?.entities?.theme;
      if (!eid) return "";
      const pending = this._pendingTheme.get(eid);
      if (pending && Date.now() < pending.until) return pending.option;
      return this._state(eid)?.state || "";
    }

    _reconcilePendingThemes() {
      const now = Date.now();
      for (const [eid, p] of [...this._pendingTheme.entries()]) {
        const st = this._state(eid)?.state;
        if (st === p.option || now >= p.until) {
          if (p.timer) clearTimeout(p.timer);
          this._pendingTheme.delete(eid);
        }
      }
    }

    /**
     * Optimistic theme select. Ignores duplicate taps while the same (or any)
     * change is pending for this entity.
     */
    _onThemeTap(entityId, option) {
      if (!entityId || option == null) return false;
      const pending = this._pendingTheme.get(entityId);
      if (pending && Date.now() < pending.until) {
        // Ignore duplicate / rapid taps while waiting for HA
        return false;
      }
      const current = this._state(entityId)?.state;
      if (current === option && !pending) {
        // Already active — no-op
        return false;
      }

      const until = Date.now() + THEME_PENDING_MS;
      const entry = { option, until, timer: null };
      entry.timer = setTimeout(() => {
        const p = this._pendingTheme.get(entityId);
        if (p === entry) {
          this._pendingTheme.delete(entityId);
          this._patchThemeChips();
          this._patchRoomButtons();
        }
      }, THEME_PENDING_MS);
      this._pendingTheme.set(entityId, entry);

      // Immediate visual update (before service round-trip)
      this._patchThemeChips();
      this._patchRoomButtons();
      this._patchSheetHeader();

      this._selectOption(entityId, option);
      return true;
    }

    _roomById(id) {
      return this._rooms.find((r) => r.id === id) || null;
    }

    // ---- shell / build ----
    _renderShell() {
      if (!this.shadowRoot) return;
      // Backdrop + sheet live in shadow; move to body would break encapsulation —
      // fixed positioning inside shadow still works in modern browsers when host is in light DOM.
      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <div class="gc-card">
          <div class="gc-header">
            <div class="gc-logo" aria-hidden="true"></div>
            <div>
              <h2 class="gc-title"></h2>
              <p class="gc-sub"></p>
            </div>
          </div>
          <div class="gc-grid" part="grid"></div>
        </div>
        <div class="gc-backdrop" data-action="close" hidden></div>
        <div class="gc-sheet" role="dialog" aria-modal="true" hidden>
          <div class="gc-sheet-handle" data-drag-handle></div>
          <div class="gc-sheet-head">
            <div class="gc-sheet-orb"></div>
            <div class="gc-sheet-titles">
              <h3></h3>
              <p></p>
            </div>
            <button type="button" class="gc-close" data-action="close" aria-label="Close">×</button>
          </div>
          <div class="gc-big-toggle">
            <span class="lbl">Show</span>
            <label class="gc-switch">
              <input type="checkbox" data-action="power" />
              <span class="track"><span class="thumb"></span></span>
            </label>
          </div>
          <div class="gc-sheet-body">
            <div>
              <div class="gc-label">Theme</div>
              <div class="gc-themes" data-role="themes"></div>
            </div>
            <div class="gc-color-section" data-role="color">
              <button type="button" class="gc-color-toggle" data-action="color-toggle">
                <span class="gc-color-preview" data-role="color-preview"></span>
                <span>Solid color</span>
                <span class="chev" data-role="color-chev">▾</span>
              </button>
              <div class="gc-color-panel" data-role="color-panel">
                <div class="gc-wheel-wrap">
                  <canvas class="gc-wheel" data-role="color-wheel" width="200" height="200"></canvas>
                  <div class="gc-value-row">
                    <span class="gc-label" style="margin:0">Bright</span>
                    <input type="range" min="0" max="100" value="100" data-action="color-value" />
                    <span class="val" data-role="color-value-label">100%</span>
                  </div>
                </div>
                <div class="gc-quick" data-role="recent-swatches"></div>
                <div class="gc-quick" data-role="quick-swatches"></div>
                <div class="gc-hex-row">
                  <span class="preview" data-role="color-preview-lg"></span>
                  <input type="text" data-action="color-hex" maxlength="7" placeholder="#FF9500" spellcheck="false" />
                </div>
                <div class="gc-color-actions">
                  <button type="button" class="gc-apply-color" data-action="color-apply">Apply color</button>
                  <button type="button" class="gc-clear-color" data-action="color-clear">Clear</button>
                </div>
              </div>
            </div>
            <div class="gc-row">
              <span class="gc-label" style="margin:0">Mode</span>
              <div class="gc-seg" data-role="mode"></div>
            </div>
            <div>
              <div class="gc-label">Effect</div>
              <div class="gc-effects" data-role="effect"></div>
            </div>
            <div class="gc-sliders" data-role="sliders"></div>
          </div>
        </div>
      `;
      this._built = false;
      this._delegated = false;
      this._ensureDelegation();
    }

    _ensureDelegation() {
      if (this._delegated || !this.shadowRoot) return;
      this._delegated = true;
      const root = this.shadowRoot;

      // Pointer events for room tap / long-press (survive re-patches)
      root.addEventListener("pointerdown", (ev) => {
        const power = ev.target.closest?.("[data-action='power-dot']");
        if (power) return; // handled on click
        const roomBtn = ev.target.closest?.("[data-room-id]");
        if (!roomBtn || !root.querySelector(".gc-grid")?.contains(roomBtn)) return;
        this._lpFired = false;
        const roomId = roomBtn.dataset.roomId;
        this._lpTimer = setTimeout(() => {
          this._lpFired = true;
          const room = this._roomById(roomId);
          if (room?.entities?.power) this._togglePower(room.entities.power);
        }, LONG_PRESS_MS);
      });
      const clearLp = () => {
        if (this._lpTimer) {
          clearTimeout(this._lpTimer);
          this._lpTimer = null;
        }
      };
      root.addEventListener("pointerup", clearLp);
      root.addEventListener("pointercancel", clearLp);
      root.addEventListener("pointerleave", clearLp);

      root.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const roomEl = ev.target.closest?.("[data-room-id].gc-room");
        if (roomEl && root.querySelector(".gc-grid")?.contains(roomEl)) {
          ev.preventDefault();
          this._openSheet(roomEl.dataset.roomId);
        }
      });

      root.addEventListener("click", (ev) => {
        const t = ev.target;

        if (t.closest?.("[data-action='close']")) {
          this._closeSheet();
          return;
        }

        const powerDot = t.closest?.("[data-action='power-dot']");
        if (powerDot) {
          ev.stopPropagation();
          const room = this._roomById(powerDot.dataset.roomId);
          if (room?.entities?.power) this._togglePower(room.entities.power);
          return;
        }

        const roomBtn = t.closest?.("[data-room-id]");
        if (roomBtn && root.querySelector(".gc-grid")?.contains(roomBtn)) {
          if (this._lpFired) {
            this._lpFired = false;
            return;
          }
          this._openSheet(roomBtn.dataset.roomId);
          return;
        }

        const themeChip = t.closest?.("[data-action='theme']");
        if (themeChip) {
          ev.preventDefault();
          this._onThemeTap(themeChip.dataset.entity, themeChip.dataset.option);
          return;
        }

        const modeBtn = t.closest?.("[data-action='mode']");
        if (modeBtn) {
          this._selectOption(modeBtn.dataset.entity, modeBtn.dataset.option);
          return;
        }

        const effectBtn = t.closest?.("[data-action='effect']");
        if (effectBtn) {
          this._selectOption(effectBtn.dataset.entity, effectBtn.dataset.option);
          return;
        }

        if (t.closest?.("[data-action='color-toggle']")) {
          this._toggleColorPanel();
          return;
        }

        const qsw = t.closest?.("[data-action='quick-swatch']");
        if (qsw) {
          const rgb = (qsw.dataset.rgb || "255,149,0").split(",").map(Number);
          this._setColorFromRgb(rgb, true);
          return;
        }

        if (t.closest?.("[data-action='color-apply']")) {
          this._applySolidColor(true);
          return;
        }

        if (t.closest?.("[data-action='color-clear']")) {
          this._clearSolidColor();
          return;
        }

        if (t.closest?.("[data-action='custom-color']")) {
          // Re-open solid color panel for the active custom color
          if (!this._colorOpen) this._toggleColorPanel();
          return;
        }
      });

      root.addEventListener("change", (ev) => {
        const el = ev.target;
        if (el?.dataset?.action === "power") {
          const room = this._roomById(this._openRoomId);
          if (room?.entities?.power) this._togglePower(room.entities.power);
        }
      });

      root.addEventListener("input", (ev) => {
        const el = ev.target;
        if (el?.dataset?.action !== "number") return;
        const valEl = el.closest(".gc-slider-row")?.querySelector(".val");
        if (valEl) {
          const isBright =
            (el.dataset.entity || "").includes("brightness") || Number(el.max) >= 50;
          valEl.textContent = isBright ? `${el.value}%` : el.value;
        }
      });
      root.addEventListener("change", (ev) => {
        const el = ev.target;
        if (el?.dataset?.action === "number") {
          this._setNumber(el.dataset.entity, el.value);
        }
      });

      root.addEventListener("input", (ev) => {
        const el = ev.target;
        if (el?.dataset?.action === "color-value") {
          this._color.v = Number(el.value) / 100;
          const lab = root.querySelector('[data-role="color-value-label"]');
          if (lab) lab.textContent = `${Math.round(this._color.v * 100)}%`;
          this._paintColorUI();
          this._applySolidColor(false); // throttled while dragging value
        }
        if (el?.dataset?.action === "color-hex") {
          /* live preview only on valid hex */
          const rgb = hexToRgb(el.value);
          if (rgb) {
            const hsv = rgbToHsv(...rgb);
            this._color = hsv;
            this._paintColorUI(false);
          }
        }
      });
      root.addEventListener("change", (ev) => {
        const el = ev.target;
        if (el?.dataset?.action === "color-hex") {
          const rgb = hexToRgb(el.value);
          if (rgb) this._setColorFromRgb(rgb, true);
        }
        if (el?.dataset?.action === "color-value") {
          this._applySolidColor(true);
        }
      });

      // Swipe-down to close
      const sheet = root.querySelector(".gc-sheet");
      let startY = null;
      sheet?.addEventListener(
        "touchstart",
        (ev) => {
          if (!ev.target.closest?.("[data-drag-handle]") && sheet.scrollTop > 0) {
            startY = null;
            return;
          }
          startY = ev.touches[0].clientY;
          this._sheetDragY = 0;
          sheet.style.transition = "none";
        },
        { passive: true }
      );
      sheet?.addEventListener(
        "touchmove",
        (ev) => {
          if (startY == null) return;
          const dy = Math.max(0, ev.touches[0].clientY - startY);
          this._sheetDragY = dy;
          sheet.style.transform = `translateY(${dy}px)`;
        },
        { passive: true }
      );
      sheet?.addEventListener("touchend", () => {
        if (startY == null) return;
        sheet.style.transition = "";
        if (this._sheetDragY > 100) this._closeSheet();
        else sheet.style.transform = "";
        startY = null;
        this._sheetDragY = 0;
      });
    }

    _buildOrUpdate(forceRebuildRooms) {
      const root = this.shadowRoot;
      if (!root) return;
      const title = this._config.title || "GlowCast";
      const cols = Math.max(1, Math.min(6, Number(this._config.columns) || 3));
      root.querySelector(".gc-title").textContent = title;
      root.querySelector(".gc-sub").textContent = this._rooms.length
        ? `${this._rooms.length} room${this._rooms.length === 1 ? "" : "s"}`
        : "Sync your lights";
      const grid = root.querySelector(".gc-grid");
      grid.style.setProperty("--gc-cols", String(cols));

      if (!this._hass) {
        grid.innerHTML = `<div class="gc-empty">Waiting for Home Assistant…</div>`;
        this._built = true;
        return;
      }
      if (this._rooms.length === 0) {
        grid.innerHTML = `<div class="gc-empty">No GlowCast entities found.<br/><br/>Check the <code>glowcast</code> integration or set <code>rooms:</code> in YAML.</div>`;
        this._built = true;
        return;
      }

      const existing = [...grid.querySelectorAll(".gc-room")];
      const existingIds = existing.map((el) => el.dataset.roomId);
      const newIds = this._rooms.map((r) => r.id);
      const sameStructure =
        !forceRebuildRooms &&
        existingIds.length === newIds.length &&
        existingIds.every((id, i) => id === newIds[i]);

      if (!sameStructure) {
        grid.innerHTML = this._rooms.map((r) => this._roomButtonHtml(r)).join("");
      } else {
        this._patchRoomButtons();
      }

      if (this._openRoomId) {
        this._fillSheet(this._roomById(this._openRoomId), false);
      }

      this._built = true;
    }


    _roomRgb(room) {
      if (!room) return null;
      const themeSt = this._state(room.entities.theme);
      const powerSt = this._state(room.entities.power);
      return (
        parseRgbAttr(themeSt?.attributes?.rgb_color) ||
        parseRgbAttr(powerSt?.attributes?.rgb_color) ||
        null
      );
    }

    _roomAccent(room) {
      const rgb = this._roomRgb(room);
      if (rgb) return rgbToHex(...rgb);
      const theme = this._effectiveTheme(room);
      if (theme && theme !== "custom_color") return paletteFor(theme).accent;
      if (theme === "custom_color" && rgb) return rgbToHex(...rgb);
      return paletteFor(theme).accent;
    }

    _roomButtonHtml(room) {
      const on = this._state(room.entities.power)?.state === "on";
      const accent = this._roomAccent(room);
      return `
        <div class="gc-room ${on ? "on" : ""}"
          data-room-id="${escapeHtml(room.id)}"
          style="--gc-accent: ${accent}"
          role="button" tabindex="0"
          aria-label="${escapeHtml(room.name)}">
          <button type="button" class="gc-power-dot" data-action="power-dot"
            data-room-id="${escapeHtml(room.id)}"
            aria-label="Toggle ${escapeHtml(room.name)}"></button>
          <div class="gc-orb" data-icon="${escapeHtml(room.icon || "")}">${iconHtml(room.icon)}</div>
          <span class="gc-room-name">${escapeHtml(room.name)}</span>
        </div>`;
    }

    _patchRoomButtons() {
      const grid = this.shadowRoot?.querySelector(".gc-grid");
      if (!grid) return;
      for (const room of this._rooms) {
        const el = [...grid.querySelectorAll(".gc-room")].find((n) => n.dataset.roomId === room.id);
        if (!el) continue;
        const on = this._state(room.entities.power)?.state === "on";
        el.classList.toggle("on", on);
        el.style.setProperty("--gc-accent", this._roomAccent(room));
        const nameEl = el.querySelector(".gc-room-name");
        if (nameEl && nameEl.textContent !== room.name) nameEl.textContent = room.name;
        const orb = el.querySelector(".gc-orb");
        // Only swap icon markup if icon string changed
        if (orb && orb.dataset.icon !== room.icon) {
          orb.dataset.icon = room.icon || "";
          orb.innerHTML = iconHtml(room.icon);
        }
      }
    }

    _openSheet(roomId) {
      const room = this._roomById(roomId);
      if (!room) return;
      if (this._openRoomId !== roomId) this._colorOpen = false;
      this._openRoomId = roomId;
      const root = this.shadowRoot;
      const backdrop = root.querySelector(".gc-backdrop");
      const sheet = root.querySelector(".gc-sheet");
      backdrop.hidden = false;
      sheet.hidden = false;
      void sheet.offsetWidth;
      backdrop.classList.add("open");
      sheet.classList.add("open");
      try {
        this._fillSheet(room, true);
      } catch (err) {
        console.warn("GlowCast sheet fill error", err);
      }
    }

    _closeSheet() {
      const root = this.shadowRoot;
      const backdrop = root.querySelector(".gc-backdrop");
      const sheet = root.querySelector(".gc-sheet");
      backdrop.classList.remove("open");
      sheet.classList.remove("open");
      sheet.style.transform = "";
      this._openRoomId = null;
      setTimeout(() => {
        if (!this._openRoomId) {
          backdrop.hidden = true;
          sheet.hidden = true;
        }
      }, 280);
    }

    _fillSheet(room, rebuildLists) {
      if (!room) return;
      const root = this.shadowRoot;
      const theme = this._effectiveTheme(room);
      const accent = this._roomAccent(room);
      const on = this._state(room.entities.power)?.state === "on";

      const orb = root.querySelector(".gc-sheet-orb");
      orb.style.setProperty("--gc-accent", accent);
      if (orb.dataset.icon !== room.icon) {
        orb.dataset.icon = room.icon || "";
        orb.innerHTML = iconHtml(room.icon);
      }
      root.querySelector(".gc-sheet-titles h3").textContent = room.name;
      root.querySelector(".gc-sheet-titles p").textContent =
        theme === "custom_color"
          ? "Custom color"
          : theme
            ? themeLabel(theme)
            : "Choose a theme";

      const powerInput = root.querySelector('.gc-big-toggle input[data-action="power"]');
      if (powerInput) {
        powerInput.checked = on;
        powerInput.disabled = !room.entities.power;
      }

      const themesEl = root.querySelector('[data-role="themes"]');
      const modeEl = root.querySelector('[data-role="mode"]');
      const effectEl = root.querySelector('[data-role="effect"]');
      const slidersEl = root.querySelector('[data-role="sliders"]');

      const themeOpts = (() => {
        const st = this._state(room.entities.theme);
        if (Array.isArray(st?.attributes?.options) && st.attributes.options.length) {
          return st.attributes.options;
        }
        return Object.keys(THEME_DEFS);
      })();

      if (rebuildLists || !themesEl.dataset.entity || themesEl.dataset.entity !== (room.entities.theme || "")) {
        themesEl.dataset.entity = room.entities.theme || "";
        const opts = themeOpts.filter((t) => t !== "custom_color");
        themesEl.innerHTML =
          opts
            .map((t) => {
              const p = paletteFor(t);
              return `<button type="button" class="gc-chip" data-action="theme"
              data-entity="${escapeHtml(room.entities.theme || "")}"
              data-option="${escapeHtml(t)}"
              style="--gc-accent: ${p.accent}"
              ${room.entities.theme ? "" : "disabled"}>
              <span class="gc-swatch" style="background:${p.gradient}"></span>
              <span class="gc-chip-name">${escapeHtml(themeLabel(t))}</span>
            </button>`;
            })
            .join("") +
          `<button type="button" class="gc-chip custom-chip" data-action="custom-color"
              data-option="custom_color" style="--gc-accent:#888">
              <span class="gc-swatch" data-role="custom-swatch" style="background:#888"></span>
              <span class="gc-chip-name">Custom</span>
            </button>`;
      }
      this._patchThemeChips();

      const modeOpts = (() => {
        const st = this._state(room.entities.mode);
        if (Array.isArray(st?.attributes?.options) && st.attributes.options.length) {
          return st.attributes.options;
        }
        return ["auto", "manual"];
      })();
      const modeVal = this._state(room.entities.mode)?.state || "auto";
      if (rebuildLists || modeEl.dataset.entity !== (room.entities.mode || "")) {
        modeEl.dataset.entity = room.entities.mode || "";
        modeEl.innerHTML = modeOpts
          .map(
            (m) =>
              `<button type="button" data-action="mode"
                data-entity="${escapeHtml(room.entities.mode || "")}"
                data-option="${escapeHtml(m)}"
                ${room.entities.mode ? "" : "disabled"}>${escapeHtml(modeLabel(m))}</button>`
          )
          .join("");
      }
      modeEl.querySelectorAll("button").forEach((b) => {
        b.classList.toggle(
          "active",
          String(b.dataset.option).toLowerCase() === String(modeVal).toLowerCase()
        );
      });

      const effectOpts = (() => {
        const st = this._state(room.entities.effect);
        if (Array.isArray(st?.attributes?.options) && st.attributes.options.length) {
          return st.attributes.options;
        }
        return room.entities.effect
          ? ["static", "rotate", "breathe", "twinkle", "flicker"]
          : [];
      })();
      const effectVal = this._state(room.entities.effect)?.state || "";
      if (rebuildLists || effectEl.dataset.entity !== (room.entities.effect || "")) {
        effectEl.dataset.entity = room.entities.effect || "";
        effectEl.innerHTML = effectOpts
          .map(
            (e) =>
              `<button type="button" data-action="effect"
                data-entity="${escapeHtml(room.entities.effect || "")}"
                data-option="${escapeHtml(e)}"
                ${room.entities.effect ? "" : "disabled"}>${escapeHtml(effectLabel(e))}</button>`
          )
          .join("");
      }
      effectEl.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", b.dataset.option === effectVal);
      });
      effectEl.style.setProperty("--gc-accent", accent);

      const speedSt = this._state(room.entities.speed);
      const brightSt = this._state(room.entities.brightness);
      const speedVal = speedSt ? Number(speedSt.state) : 5;
      const brightVal = brightSt ? Number(brightSt.state) : 80;
      if (rebuildLists || slidersEl.dataset.room !== room.id) {
        slidersEl.dataset.room = room.id;
        slidersEl.innerHTML = `
          <div class="gc-slider-row">
            <span class="gc-label">Speed</span>
            <input type="range" min="${Number(speedSt?.attributes?.min ?? 1)}"
              max="${Number(speedSt?.attributes?.max ?? 10)}" step="1"
              value="${speedVal}" data-action="number"
              data-entity="${escapeHtml(room.entities.speed || "")}"
              ${room.entities.speed ? "" : "disabled"} />
            <span class="val">${Number.isFinite(speedVal) ? speedVal : "—"}</span>
          </div>
          <div class="gc-slider-row">
            <span class="gc-label">Bright</span>
            <input type="range" min="${Number(brightSt?.attributes?.min ?? 1)}"
              max="${Number(brightSt?.attributes?.max ?? 100)}" step="1"
              value="${brightVal}" data-action="number"
              data-entity="${escapeHtml(room.entities.brightness || "")}"
              ${room.entities.brightness ? "" : "disabled"} />
            <span class="val">${Number.isFinite(brightVal) ? brightVal + "%" : "—"}</span>
          </div>`;
      } else {
        const inputs = slidersEl.querySelectorAll("input[type=range]");
        const vals = slidersEl.querySelectorAll(".val");
        if (inputs[0] && document.activeElement !== inputs[0]) {
          inputs[0].value = String(speedVal);
          if (vals[0]) vals[0].textContent = Number.isFinite(speedVal) ? String(speedVal) : "—";
        }
        if (inputs[1] && document.activeElement !== inputs[1]) {
          inputs[1].value = String(brightVal);
          if (vals[1]) {
            vals[1].textContent = Number.isFinite(brightVal) ? `${brightVal}%` : "—";
          }
        }
      }


      // Sync wheel from entity rgb when in custom_color
      if (theme === "custom_color") {
        const rgb = this._roomRgb(room);
        if (rgb && !this._colorDragging) {
          this._color = rgbToHsv(...rgb);
        }
      }

      // Color panel state (keep open across hass patches)
      const panel = root.querySelector('[data-role="color-panel"]');
      const chev = root.querySelector('[data-role="color-chev"]');
      if (panel) panel.classList.toggle("open", !!this._colorOpen);
      if (chev) chev.textContent = this._colorOpen ? "▴" : "▾";
      this._paintColorUI();
      if (this._colorOpen) {
        this._ensureWheelDrawn();
        this._renderSwatchRows();
        this._bindWheel();
      }
    }


    _currentRgb() {
      return hsvToRgb(this._color.h, this._color.s, this._color.v);
    }

    _toggleColorPanel() {
      this._colorOpen = !this._colorOpen;
      const panel = this.shadowRoot?.querySelector('[data-role="color-panel"]');
      const chev = this.shadowRoot?.querySelector('[data-role="color-chev"]');
      if (panel) panel.classList.toggle("open", this._colorOpen);
      if (chev) chev.textContent = this._colorOpen ? "▴" : "▾";
      if (this._colorOpen) {
        this._ensureWheelDrawn();
        this._renderSwatchRows();
        this._paintColorUI();
        this._bindWheel();
      }
    }

    _setColorFromRgb(rgb, commit) {
      const hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      this._color = hsv;
      this._paintColorUI();
      this._applySolidColor(!!commit);
    }

    _paintColorUI(updateHex = true) {
      const root = this.shadowRoot;
      if (!root) return;
      const rgb = this._currentRgb();
      const hex = rgbToHex(...rgb);
      const css = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      root.querySelectorAll('[data-role="color-preview"], [data-role="color-preview-lg"]').forEach((el) => {
        el.style.background = css;
      });
      const hexInput = root.querySelector('[data-action="color-hex"]');
      if (updateHex && hexInput && document.activeElement !== hexInput) {
        hexInput.value = hex.toUpperCase();
      }
      const val = root.querySelector('[data-action="color-value"]');
      if (val && document.activeElement !== val) {
        val.value = String(Math.round(this._color.v * 100));
      }
      const lab = root.querySelector('[data-role="color-value-label"]');
      if (lab) lab.textContent = `${Math.round(this._color.v * 100)}%`;
      const hueRgb = hsvToRgb(this._color.h, 1, 1);
      root.querySelector(".gc-value-row")?.style.setProperty(
        "--gc-value-hue",
        `rgb(${hueRgb[0]},${hueRgb[1]},${hueRgb[2]})`
      );
      this._drawWheelCursor();
      // Mark active quick swatches
      const key = rgb.map((n) => Math.round(n)).join(",");
      root.querySelectorAll("[data-action='quick-swatch']").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.rgb === key);
      });
    }

    _ensureWheelDrawn() {
      const canvas = this.shadowRoot?.querySelector('[data-role="color-wheel"]');
      if (!canvas) return;
      if (canvas.dataset.drawn === "1") {
        this._drawWheelCursor();
        return;
      }
      let ctx = null;
      try { ctx = canvas.getContext?.("2d"); } catch (_) { ctx = null; }
      if (!ctx || typeof ctx.createImageData !== "function") {
        canvas.dataset.drawn = "unsupported";
        return;
      }
      const size = canvas.width;
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 2;
      const img = ctx.createImageData(size, size);
      const data = img.data;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const i = (y * size + x) * 4;
          if (dist > radius) {
            data[i + 3] = 0;
            continue;
          }
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angle < 0) angle += 360;
          const s = dist / radius;
          const [r, g, b] = hsvToRgb(angle, s, 1);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      canvas.dataset.drawn = "1";
      // Keep a backup of the clean wheel for cursor redraw
      canvas._wheelBitmap = ctx.getImageData(0, 0, size, size);
      this._drawWheelCursor();
    }

    _drawWheelCursor() {
      const canvas = this.shadowRoot?.querySelector('[data-role="color-wheel"]');
      if (!canvas || canvas.dataset.drawn === "unsupported") return;
      let ctx = null;
      try { ctx = canvas.getContext?.("2d"); } catch (_) { ctx = null; }
      if (!ctx) return;
      const size = canvas.width;
      if (canvas._wheelBitmap) {
        ctx.putImageData(canvas._wheelBitmap, 0, 0);
      } else if (canvas.dataset.drawn !== "1") {
        this._ensureWheelDrawn();
        return;
      }
      if (canvas.dataset.drawn !== "1") return;
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 2;
      const ang = (this._color.h * Math.PI) / 180;
      const dist = this._color.s * radius;
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist;
      const rgb = hsvToRgb(this._color.h, this._color.s, 1);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    _bindWheel() {
      const canvas = this.shadowRoot?.querySelector('[data-role="color-wheel"]');
      if (!canvas || canvas.dataset.bound === "1") return;
      canvas.dataset.bound = "1";

      const pick = (clientX, clientY, commit) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const radius = canvas.width / 2 - 2;
        let dist = Math.sqrt(dx * dx + dy * dy);
        const s = clamp(dist / radius, 0, 1);
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        this._color.h = angle;
        this._color.s = s;
        this._paintColorUI();
        this._applySolidColor(!!commit);
      };

      canvas.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        canvas.setPointerCapture?.(ev.pointerId);
        this._colorDragging = true;
        pick(ev.clientX, ev.clientY, false);
      });
      canvas.addEventListener("pointermove", (ev) => {
        if (!this._colorDragging) return;
        pick(ev.clientX, ev.clientY, false);
      });
      const end = (ev) => {
        if (!this._colorDragging) return;
        this._colorDragging = false;
        pick(ev.clientX, ev.clientY, true);
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
    }

    _renderSwatchRows() {
      const root = this.shadowRoot;
      if (!root) return;
      const recentEl = root.querySelector('[data-role="recent-swatches"]');
      const quickEl = root.querySelector('[data-role="quick-swatches"]');
      if (!recentEl || !quickEl) return;

      const recent = loadRecentColors();
      if (recent.length) {
        recentEl.innerHTML =
          `<span class="gc-quick-label">Recent</span>` +
          recent
            .map((rgb) => {
              const hex = rgbToHex(...rgb);
              return `<button type="button" class="gc-qswatch recent" data-action="quick-swatch"
                data-rgb="${rgb.join(",")}" title="${hex}"
                style="background:${hex}" aria-label="Recent ${hex}"></button>`;
            })
            .join("");
      } else {
        recentEl.innerHTML = "";
      }

      quickEl.innerHTML =
        `<span class="gc-quick-label">Presets</span>` +
        QUICK_SWATCHES.map(
          (s) =>
            `<button type="button" class="gc-qswatch" data-action="quick-swatch"
              data-rgb="${s.rgb.join(",")}" title="${escapeHtml(s.name)}"
              style="background:rgb(${s.rgb.join(",")})"
              aria-label="${escapeHtml(s.name)}"></button>`
        ).join("");
    }

    _hasSetColorService() {
      const svc = this._hass?.services?.glowcast;
      if (!svc) return false;
      return !!(svc.set_color || svc["set_color"]);
    }

    /**
     * Apply solid color to the open room.
     * @param {boolean} forceCommit - if true, always send now and record recent;
     *   if false, throttle to COLOR_THROTTLE_MS while dragging.
     */
    _applySolidColor(forceCommit) {
      const room = this._roomById(this._openRoomId);
      if (!room) return;
      const rgb = this._currentRgb();

      if (!forceCommit) {
        const now = Date.now();
        if (now - this._colorLastSent < COLOR_THROTTLE_MS) {
          if (!this._colorThrottleTimer) {
            this._colorThrottleTimer = setTimeout(() => {
              this._colorThrottleTimer = null;
              this._applySolidColor(false);
            }, COLOR_THROTTLE_MS - (now - this._colorLastSent));
          }
          return;
        }
      } else if (this._colorThrottleTimer) {
        clearTimeout(this._colorThrottleTimer);
        this._colorThrottleTimer = null;
      }

      this._colorLastSent = Date.now();
      this._sendSolidColor(room, rgb);
      if (forceCommit) {
        saveRecentColor(rgb);
        this._renderSwatchRows();
        this._paintColorUI();
      }
    }

    _sendSolidColor(room, rgb) {
      const roomId = room.id;
      const brightness = Math.round(clamp(this._color.v, 0, 1) * 100);
      // Solid color supersedes any in-flight theme select
      const themeEid = room.entities?.theme;
      if (themeEid && this._pendingTheme.has(themeEid)) {
        const pend = this._pendingTheme.get(themeEid);
        if (pend?.timer) clearTimeout(pend.timer);
        this._pendingTheme.delete(themeEid);
      }
      if (this._hasSetColorService()) {
        this._callService("glowcast", "set_color", {
          room: roomId,
          rgb_color: [rgb[0], rgb[1], rgb[2]],
          brightness,
        });
        return;
      }
      // Fallback: stop show + light.turn_on rgb on glowcast color light or members
      if (room.entities.power) {
        this._callService("switch", "turn_off", { entity_id: room.entities.power });
      }
      const colorLight = room.entities.colorLight || `light.glowcast_${roomId}_color`;
      if (this._state(colorLight)) {
        this._callService("light", "turn_on", {
          entity_id: colorLight,
          rgb_color: [rgb[0], rgb[1], rgb[2]],
          brightness_pct: brightness,
        });
        return;
      }
      const lights = this._lightsForRoom(room);
      if (lights.length) {
        this._callService("light", "turn_on", {
          entity_id: lights,
          rgb_color: [rgb[0], rgb[1], rgb[2]],
          brightness_pct: brightness,
        });
      }
    }

    /** Clear solid color — restores lights via light.glowcast_<room>_color turn_off (Poke 0.1.2). */
    _clearSolidColor() {
      const room = this._roomById(this._openRoomId);
      if (!room) return;
      const colorLight = room.entities.colorLight || `light.glowcast_${room.id}_color`;
      this._callService("light", "turn_off", { entity_id: colorLight });
      // Optimistic UI: drop custom highlight until hass confirms
      this._patchThemeChips();
      this._patchRoomButtons();
      this._patchSheetHeader();
    }

    _lightsForRoom(room) {
      const hass = this._hass;
      if (!hass?.states) return [];
      const showSt = room.entities.power ? this._state(room.entities.power) : null;
      const attrs = showSt?.attributes || {};
      const listed =
        attrs.lights ||
        attrs.entity_id ||
        attrs.light_entities ||
        attrs.members ||
        attrs.entity_ids;
      let ids = [];
      if (Array.isArray(listed)) ids = listed.filter((e) => String(e).startsWith("light."));
      else if (typeof listed === "string" && listed.startsWith("light.")) ids = [listed];

      if (!ids.length) {
        if (room.isAll || room.id === "all_lights") {
          ids = Object.keys(hass.states).filter((eid) => {
            if (!eid.startsWith("light.")) return false;
            return lightSupportsColor(hass.states[eid]?.attributes);
          });
        } else if (room.areaId && hass.entities) {
          ids = Object.entries(hass.entities)
            .filter(
              ([eid, meta]) =>
                eid.startsWith("light.") &&
                (meta.area_id === room.areaId ||
                  (meta.device_id &&
                    hass.devices?.[meta.device_id]?.area_id === room.areaId))
            )
            .map(([eid]) => eid)
            .filter((eid) => lightSupportsColor(hass.states[eid]?.attributes));
        } else {
          // Match area name loosely via entity registry area or friendly area
          const area = Object.values(hass.areas || {}).find(
            (a) => a.name === room.name || a.area_id === room.id
          );
          if (area) {
            ids = Object.entries(hass.entities || {})
              .filter(([eid, meta]) => eid.startsWith("light.") && meta.area_id === area.area_id)
              .map(([eid]) => eid)
              .filter((eid) => lightSupportsColor(hass.states[eid]?.attributes));
          }
        }
      }
      return [...new Set(ids)];
    }

    _patchThemeChips() {
      const root = this.shadowRoot;
      if (!root || !this._openRoomId) return;
      const room = this._roomById(this._openRoomId);
      if (!room) return;
      const eid = room.entities.theme || "";
      const active = this._effectiveTheme(room);
      const pending = this._pendingTheme.get(eid);
      const rgb = this._roomRgb(room);
      const themesEl = root.querySelector('[data-role="themes"]');
      if (!themesEl) return;
      themesEl.querySelectorAll(".gc-chip").forEach((chip) => {
        const isCustom = chip.classList.contains("custom-chip") || chip.dataset.option === "custom_color";
        const isActive = isCustom
          ? active === "custom_color"
          : chip.dataset.option === active;
        chip.classList.toggle("active", isActive);
        chip.classList.toggle("pending", !!(pending && chip.dataset.option === pending.option));
        chip.classList.toggle("disabled-pending", !!(pending && !isActive));
        if (isCustom) {
          const css = rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "#888";
          const sw = chip.querySelector('[data-role="custom-swatch"]') || chip.querySelector(".gc-swatch");
          if (sw) sw.style.background = css;
          if (rgb) chip.style.setProperty("--gc-accent", rgbToHex(...rgb));
          // Hide custom chip when no solid color unless it's active
          chip.hidden = !(active === "custom_color" || rgb);
        } else if (isActive) {
          const pal = paletteFor(chip.dataset.option);
          chip.style.setProperty("--gc-accent", pal.accent);
        }
      });
    }

    _patchSheetHeader() {
      if (!this._openRoomId) return;
      const room = this._roomById(this._openRoomId);
      if (!room) return;
      const theme = this._effectiveTheme(room);
      const root = this.shadowRoot;
      root.querySelector(".gc-sheet-orb")?.style.setProperty("--gc-accent", this._roomAccent(room));
      const sub = root.querySelector(".gc-sheet-titles p");
      if (sub) {
        sub.textContent =
          theme === "custom_color" ? "Custom color" : theme ? themeLabel(theme) : "Choose a theme";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Config editor
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
      // Don't full re-render on every hass tick — only if empty
      if (!this.shadowRoot?.querySelector(".wrap")) this._render();
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

    _roomsConfig() {
      const r = this._config.rooms;
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object") {
        return Object.entries(r).map(([id, v]) => ({ id, ...(v || {}) }));
      }
      // Seed from discovery if possible
      if (this._hass) {
        return discoverRooms(this._hass, {}).map((room) => ({
          id: room.id,
          name: room.name,
          icon: room.icon,
        }));
      }
      return [
        { id: "all_lights", name: "All lights", icon: "mdi:lightbulb-group" },
        { id: "kitchen", name: "Kitchen", icon: "mdi:silverware-fork-knife" },
        { id: "nerd_cave", name: "Nerd Cave", icon: "mdi:desktop-classic" },
      ];
    }

    _render() {
      const title = this._config.title || "GlowCast";
      const columns = this._config.columns ?? 3;
      const rooms = this._roomsConfig();
      const hasIconPicker = typeof customElements !== "undefined" && customElements.get("ha-icon-picker");

      const roomRows = rooms
        .map(
          (r, i) => `
          <div class="room" data-idx="${i}">
            <input type="text" class="rid" data-field="id" value="${escapeHtml(r.id || "")}" placeholder="room id" />
            <input type="text" class="rname" data-field="name" value="${escapeHtml(r.name || "")}" placeholder="Name" />
            ${
              hasIconPicker
                ? `<ha-icon-picker data-field="icon" value="${escapeHtml(r.icon || "mdi:lightbulb-group")}"></ha-icon-picker>`
                : `<input type="text" data-field="icon" value="${escapeHtml(r.icon || "")}" placeholder="mdi:icon" />`
            }
          </div>`
        )
        .join("");

      this.shadowRoot.innerHTML = `
        <style>
          .wrap { padding: 4px 0; display: flex; flex-direction: column; gap: 12px;
            font-family: var(--ha-font-family-body, sans-serif); color: var(--primary-text-color); }
          label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; font-weight: 600; }
          input {
            font: inherit; font-weight: 400; padding: 8px 10px; border-radius: 8px;
            border: 1px solid var(--divider-color, #444);
            background: var(--card-background-color, #1c1c1e); color: inherit;
          }
          .hint { font-size: 0.75rem; font-weight: 400; color: var(--secondary-text-color, #98989f); }
          .room {
            display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
            padding: 8px; border: 1px solid var(--divider-color, #333); border-radius: 10px;
          }
          .room [data-field="icon"] { grid-column: 1 / -1; }
          .rooms-head { font-size: 0.85rem; font-weight: 650; }
        </style>
        <div class="wrap">
          <label>Title
            <input type="text" id="title" value="${escapeHtml(title)}" />
          </label>
          <label>Columns
            <input type="number" id="columns" min="1" max="6" value="${escapeHtml(columns)}" />
          </label>
          <div class="rooms-head">Rooms (id / name / icon)</div>
          <span class="hint">Overrides display name & icon for discovered rooms. Entity ids still auto-discovered unless you set full entity fields in YAML.</span>
          <div id="rooms">${roomRows}</div>
        </div>
      `;

      const fireRooms = () => {
        const nodes = [...this.shadowRoot.querySelectorAll(".room")];
        const next = nodes.map((node) => {
          const id = node.querySelector('[data-field="id"]')?.value?.trim();
          const name = node.querySelector('[data-field="name"]')?.value?.trim();
          const iconEl = node.querySelector('[data-field="icon"]');
          const icon = iconEl?.value || iconEl?.getAttribute?.("value") || "";
          return { id, name, icon };
        }).filter((r) => r.id);
        // Store as map for clean YAML
        const map = {};
        for (const r of next) map[r.id] = { name: r.name, icon: r.icon };
        this._fire({ ...this._config, rooms: map });
      };

      this.shadowRoot.getElementById("title").oninput = (e) => {
        this._fire({ ...this._config, title: e.target.value });
      };
      this.shadowRoot.getElementById("columns").oninput = (e) => {
        this._fire({ ...this._config, columns: Number(e.target.value) || 3 });
      };
      this.shadowRoot.querySelectorAll(".room input").forEach((inp) => {
        inp.onchange = fireRooms;
        inp.oninput = () => {};
      });
      this.shadowRoot.querySelectorAll("ha-icon-picker").forEach((el) => {
        el.addEventListener("value-changed", fireRooms);
        el.addEventListener("change", fireRooms);
      });
    }
  }

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
        "Compact GlowCast room pills with Bubble-style pop-up controls (v0.2).",
      preview: true,
      documentationURL: "https://github.com/local/glowcast-card",
    });
  }

  window.GlowCastCardHelpers = {
    discoverRooms,
    classifyEntity,
    paletteFor,
    themeLabel,
    hsvToRgb,
    rgbToHsv,
    rgbToHex,
    hexToRgb,
    loadRecentColors,
    saveRecentColor,
    QUICK_SWATCHES,
    THEME_PALETTE,
    THEME_DEFS,
    PLATFORM,
    CARD_TYPE,
    VERSION,
    THEME_PENDING_MS,
    COLOR_THROTTLE_MS,
    RECENT_COLORS_KEY,
  };
})();

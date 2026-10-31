#!/usr/bin/env node
/**
 * GlowCast card v0.2 self-test: discovery, compact UI, optimistic themes, screenshots.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK  ", msg);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runJsdom() {
  const { JSDOM, VirtualConsole } = require("jsdom");
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("error", (e) => errors.push(String(e)));
  vc.on("jsdomError", (e) => errors.push(String(e)));

  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount"></div></body></html>`, {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.customElements = window.customElements;
  global.CustomEvent = window.CustomEvent;
  global.CSS = window.CSS || { escape: (s) => s };

  window.eval(readFileSync(join(__dirname, "mock-hass.js"), "utf8"));
  window.eval(readFileSync(join(ROOT, "glowcast-card.js"), "utf8"));

  assert(!!window.customElements.get("glowcast-card"), "custom element registered");
  assert(!!window.customElements.get("glowcast-card-editor"), "editor registered");
  assert(window.GlowCastCardHelpers.VERSION.startsWith("0.2"), "VERSION is 0.2.x");

  const { hass, rooms } = window.GlowCastMockHass.build();
  const discovered = window.GlowCastCardHelpers.discoverRooms(hass, {});
  assert(discovered.length === rooms.length, `discovered ${discovered.length} rooms`);
  assert(discovered[0].isAll === true, "first room is All lights");
  assert(
    discovered.map((r) => r.id).sort().join(",") === "all_lights,kitchen,nerd_cave",
    `room ids ${discovered.map((r) => r.id)}`
  );
  assert(
    discovered.every((r) => r.entities.power && r.entities.theme && r.entities.mode && r.entities.effect),
    "entities classified"
  );

  // Mount compact card
  const card = window.document.createElement("glowcast-card");
  card.setConfig({ title: "GlowCast", columns: 3 });
  card.hass = hass;
  window.document.getElementById("mount").appendChild(card);

  const shadow = card.shadowRoot;
  assert(!!shadow.querySelector(".gc-grid"), "compact grid present");
  assert(shadow.querySelectorAll(".gc-room").length === 3, "3 room pills");
  assert(!shadow.querySelector(".ls-section"), "v1 sections gone");
  assert(!!shadow.querySelector(".gc-sheet"), "sheet present");

  // Open popup via click
  const kitchen = shadow.querySelector('[data-room-id="kitchen"]');
  kitchen.click();
  assert(card._openRoomId === "kitchen", "popup opens for kitchen");
  assert(shadow.querySelector(".gc-sheet").classList.contains("open"), "sheet.open");
  assert(shadow.querySelectorAll('[data-action="theme"]').length >= 10, "theme chips in sheet");

  // ---- Optimistic theme switching ----
  const themeEntity = "select.glowcast_kitchen_theme";
  // Slow HA: delay theme state updates
  const slow = window.GlowCastMockHass.build({ delayThemeMs: 800 });
  card.hass = slow.hass;
  // Re-open kitchen on new hass
  card._openSheet("kitchen");

  const chipsBefore = [...shadow.querySelectorAll('[data-action="theme"]')];
  const halloween = chipsBefore.find((c) => c.dataset.option === "halloween");
  const party = chipsBefore.find((c) => c.dataset.option === "party");
  assert(!!halloween && !!party, "halloween + party chips exist");

  // Tap halloween — should highlight immediately (optimistic)
  const accepted1 = card._onThemeTap(themeEntity, "halloween");
  assert(accepted1 === true, "first theme tap accepted");
  assert(card._effectiveTheme(card._roomById("kitchen")) === "halloween", "optimistic halloween");
  assert(halloween.classList.contains("active"), "halloween chip active immediately");
  assert(card._pendingTheme.has(themeEntity), "pending theme recorded");

  // Duplicate tap while pending — ignored
  const dup = card._onThemeTap(themeEntity, "halloween");
  assert(dup === false, "duplicate theme tap ignored while pending");
  const partyWhilePending = card._onThemeTap(themeEntity, "party");
  assert(partyWhilePending === false, "second theme tap ignored while pending");

  // Simulate hass update mid-flight WITHOUT rebuilding theme chip DOM
  const chipNodeBefore = halloween;
  const callsBefore = slow.hass._calls.length;
  card.hass = slow.hass; // triggers in-place update
  const chipNodeAfter = shadow.querySelector('[data-action="theme"][data-option="halloween"]');
  assert(chipNodeBefore === chipNodeAfter, "theme chip DOM node preserved across hass update");
  assert(chipNodeAfter.classList.contains("active"), "active class still on chip after hass patch");

  // After delay, state catches up — pending clears
  await sleep(900);
  // Push hass again to reconcile
  card.hass = slow.hass;
  assert(slow.hass.states[themeEntity].state === "halloween", "HA state eventually halloween");
  // Pending should clear once state matches
  card._reconcilePendingThemes();
  assert(!card._pendingTheme.has(themeEntity), "pending cleared after confirm");

  // New tap after clear works
  const ok2 = card._onThemeTap(themeEntity, "party");
  assert(ok2 === true, "theme tap accepted after pending cleared");
  assert(card._effectiveTheme(card._roomById("kitchen")) === "party", "optimistic party");

  // ---- Solid color / set_color ----
  {
    const H = window.GlowCastMockHass;
    const helpers = window.GlowCastCardHelpers;
    assert(helpers.rgbToHex(255, 149, 0) === "#ff9500", "rgbToHex");
    assert(JSON.stringify(helpers.hexToRgb("#ff9500")) === "[255,149,0]", "hexToRgb");
    const round = helpers.rgbToHsv(...helpers.hsvToRgb(200, 0.5, 0.8));
    assert(Math.abs(round.h - 200) < 2 && Math.abs(round.s - 0.5) < 0.05, "hsv roundtrip");

    // localStorage recent colors
    try { window.localStorage.removeItem(helpers.RECENT_COLORS_KEY); } catch (_) {}
    helpers.saveRecentColor([255, 0, 0]);
    helpers.saveRecentColor([0, 255, 0]);
    helpers.saveRecentColor([255, 0, 0]); // move to front, dedupe
    const recent = helpers.loadRecentColors();
    assert(recent.length === 2 && recent[0][0] === 255 && recent[0][1] === 0, "recent colors MRU dedupe");

    const { hass: colorHass } = H.build({ withSetColor: true });
    card.hass = colorHass;
    card._openSheet("kitchen");
    assert(!!shadow.querySelector('[data-action="color-toggle"]'), "solid color toggle present");
    card._toggleColorPanel();
    assert(shadow.querySelector('[data-role="color-panel"]').classList.contains("open"), "color panel opens");
    assert(!!shadow.querySelector('[data-role="color-wheel"]'), "color wheel canvas present");
    assert(shadow.querySelectorAll('[data-role="quick-swatches"] [data-action="quick-swatch"]').length >= 8, "preset swatches");

    const beforeCalls = colorHass._calls.length;
    card._setColorFromRgb([0, 122, 255], true);
    const setColorCall = colorHass._calls.slice(beforeCalls).find(
      (c) => c.domain === "glowcast" && c.service === "set_color"
    );
    assert(!!setColorCall, "glowcast.set_color called");
    assert(setColorCall.data.room === "kitchen", "set_color room=kitchen");
    assert(
      Array.isArray(setColorCall.data.rgb_color) &&
        setColorCall.data.rgb_color[0] === 0 &&
        setColorCall.data.rgb_color[2] === 255,
      `set_color rgb ${JSON.stringify(setColorCall?.data?.rgb_color)}`
    );
    assert(
      typeof setColorCall.data.brightness === "number" && setColorCall.data.brightness >= 0,
      `set_color includes brightness (${setColorCall.data.brightness})`
    );
    // Push hass so custom_color state applies
    card.hass = colorHass;
    assert(colorHass.states["select.glowcast_kitchen_theme"].state === "custom_color", "theme state custom_color");
    const customChip = shadow.querySelector(".custom-chip");
    assert(!!customChip, "Custom chip exists");
    assert(!customChip.hidden, `Custom chip visible (hidden=${customChip.hidden})`);
    assert(customChip.classList.contains("active"), `Custom chip active (class=${customChip.className})`);
    assert(card._effectiveTheme(card._roomById("kitchen")) === "custom_color", "effective theme custom_color");
    // Clear color
    const clearBefore = colorHass._calls.length;
    card._clearSolidColor();
    assert(
      colorHass._calls.slice(clearBefore).some(
        (c) => c.domain === "light" && c.service === "turn_off" &&
          [].concat(c.data.entity_id).includes("light.glowcast_kitchen_color")
      ),
      "clear calls light.glowcast_kitchen_color turn_off"
    );
    assert(
      helpers.loadRecentColors()[0].join(",") === "0,122,255",
      "applied color saved to recent"
    );
    assert(
      shadow.querySelector('[data-role="recent-swatches"] [data-action="quick-swatch"]'),
      "recent swatch row rendered"
    );

    // Fallback path when set_color missing
    const { hass: fbHass } = H.build({ withSetColor: false });
    card.hass = fbHass;
    card._openSheet("kitchen");
    card._colorOpen = true;
    const fbBefore = fbHass._calls.length;
    card._setColorFromRgb([255, 59, 48], true);
    const fbCalls = fbHass._calls.slice(fbBefore);
    assert(
      fbCalls.some((c) => c.domain === "switch" && c.service === "turn_off"),
      "fallback turns off show switch"
    );
    const lightOn = fbCalls.find((c) => c.domain === "light" && c.service === "turn_on");
    assert(!!lightOn, "fallback light.turn_on");
    const fbTargets = [].concat(lightOn.data.entity_id);
    assert(
      fbTargets.includes("light.glowcast_kitchen_color") || fbTargets.includes("light.kitchen_sink"),
      `fallback targets color light or members (${fbTargets})`
    );
    assert(
      lightOn.data.rgb_color[0] === 255 && lightOn.data.rgb_color[1] === 59,
      "fallback rgb_color"
    );

    // Throttle: rapid non-commit calls should not spam every frame
    const { hass: thrHass } = H.build({ withSetColor: true });
    card.hass = thrHass;
    card._openSheet("all_lights");
    card._colorLastSent = 0;
    const thrBefore = thrHass._calls.filter((c) => c.service === "set_color").length;
    card._color = { h: 10, s: 1, v: 1 };
    card._applySolidColor(false);
    card._color = { h: 20, s: 1, v: 1 };
    card._applySolidColor(false);
    card._color = { h: 30, s: 1, v: 1 };
    card._applySolidColor(false);
    const thrMid = thrHass._calls.filter((c) => c.service === "set_color").length - thrBefore;
    assert(thrMid <= 2, `throttled drag sends <=2 immediately (got ${thrMid})`);
  }

  // Power dot
  const { hass: h2 } = window.GlowCastMockHass.build();
  card.hass = h2;
  card._closeSheet();
  const before = h2.states["switch.glowcast_all_lights_show"].state;
  card._togglePower("switch.glowcast_all_lights_show");
  assert(
    h2.states["switch.glowcast_all_lights_show"].state !== before,
    "power toggle flips show"
  );

  // Editor
  const editor = window.customElements.get("glowcast-card").getConfigElement();
  editor.setConfig({ title: "GlowCast", columns: 3, rooms: { kitchen: { icon: "mdi:stove", name: "Kitchen" } } });
  assert(!!editor.shadowRoot?.innerHTML.includes("Columns"), "editor has columns");

  // No full rebuild: room nodes stable across hass
  card.setConfig({ title: "GlowCast", columns: 3 });
  card.hass = h2;
  const roomEl = shadow.querySelector('[data-room-id="all_lights"]');
  card.hass = h2;
  assert(
    shadow.querySelector('[data-room-id="all_lights"]') === roomEl,
    "room pill DOM preserved across hass update"
  );

  const src = readFileSync(join(ROOT, "glowcast-card.js"), "utf8");
  assert(!/lumasync/i.test(src), "no lumasync leftovers");
  assert(src.includes("optimistic") || src.includes("_pendingTheme"), "optimistic theme logic present");
  const realErrors = errors.filter((e) => !/getContext|HTMLCanvasElement|canvas npm package/i.test(e));
  assert(realErrors.length === 0, `no jsdom errors (${realErrors.join("; ") || "none"})`);
}

function runScreenshots() {
  const r = spawnSync(process.execPath, [join(__dirname, "screenshot.mjs")], {
    encoding: "utf8",
    timeout: 120000,
    cwd: ROOT,
  });
  if (r.status === 0) {
    console.log((r.stdout || "").trim());
    assert(existsSync(join(ROOT, "preview-v2-closed.png")), "preview-v2-closed.png exists");
    assert(existsSync(join(ROOT, "preview-v2-popup.png")), "preview-v2-popup.png exists");
    assert(existsSync(join(ROOT, "preview-v2-color.png")), "preview-v2-color.png exists");
    assert(existsSync(join(ROOT, "preview-v2-light.png")), "preview-v2-light.png exists");
    assert(existsSync(join(ROOT, "preview-v2-dark.png")), "preview-v2-dark.png exists");
  } else {
    console.error("FAIL screenshot", r.status, (r.stderr || r.stdout || "").slice(0, 1000));
    failed += 1;
  }
}

await runJsdom();
runScreenshots();

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll self-tests passed.");

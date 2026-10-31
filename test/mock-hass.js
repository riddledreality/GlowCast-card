/**
 * Mock hass for GlowCast card v0.2 — mirrors live HA rooms.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GlowCastMockHass = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const THEME_KEYS = [
    "new_years", "valentines", "st_patricks", "easter", "fourth_of_july",
    "halloween", "thanksgiving", "christmas", "aurora", "ocean", "sunset",
    "candlelight", "party", "calm", "team_colors",
  ];
  const MODE_OPTS = ["auto", "manual"];
  const EFFECT_OPTS = ["static", "rotate", "breathe", "twinkle", "flicker"];

  function makeRoom(slug, name, areaId, deviceId, icon) {
    return {
      slug, name, areaId, deviceId, icon,
      ids: {
        theme: `select.glowcast_${slug}_theme`,
        power: `switch.glowcast_${slug}_show`,
        mode: `select.glowcast_${slug}_mode`,
        effect: `select.glowcast_${slug}_effect`,
        speed: `number.glowcast_${slug}_speed`,
        brightness: `number.glowcast_${slug}_brightness`,
      },
    };
  }

  const rooms = [
    makeRoom("all_lights", "All lights", null, "dev_all", "mdi:lightbulb-group"),
    makeRoom("kitchen", "Kitchen", "area_kit", "dev_kit", "mdi:silverware-fork-knife"),
    makeRoom("nerd_cave", "Nerd Cave", "area_nc", "dev_nc", "mdi:desktop-classic"),
  ];

  function build(opts) {
    const delayThemeMs = opts?.delayThemeMs || 0;
    const states = {};
    const entities = {};
    const devices = {};
    const areas = {
      area_kit: { area_id: "area_kit", name: "Kitchen", icon: "mdi:silverware-fork-knife" },
      area_nc: { area_id: "area_nc", name: "Nerd Cave", icon: "mdi:desktop-classic" },
    };
    const defaults = {
      all_lights: { theme: "halloween", power: "on", mode: "auto", effect: "flicker", speed: "6", brightness: "70" },
      kitchen: { theme: "ocean", power: "off", mode: "manual", effect: "static", speed: "4", brightness: "80" },
      nerd_cave: { theme: "aurora", power: "on", mode: "manual", effect: "rotate", speed: "5", brightness: "55" },
    };
    const calls = [];

    for (const room of rooms) {
      const d = defaults[room.slug];
      devices[room.deviceId] = {
        id: room.deviceId,
        name: `GlowCast ${room.name}`,
        name_by_user: `GlowCast ${room.name}`,
        area_id: room.areaId,
      };
      const regs = [
        [room.ids.theme, "select", "Theme", d.theme, { options: THEME_KEYS }],
        [room.ids.power, "switch", "Show", d.power, {}],
        [room.ids.mode, "select", "Mode", d.mode, { options: MODE_OPTS }],
        [room.ids.effect, "select", "Effect", d.effect, { options: EFFECT_OPTS }],
        [room.ids.speed, "number", "Speed", d.speed, { min: 1, max: 10, step: 1, mode: "slider" }],
        [room.ids.brightness, "number", "Brightness", d.brightness, { min: 1, max: 100, step: 1, mode: "slider", unit_of_measurement: "%" }],
      ];
      for (const [eid, domain, fname, state, attrs] of regs) {
        states[eid] = {
          entity_id: eid,
          state: String(state),
          attributes: { friendly_name: `GlowCast ${room.name} ${fname}`, ...attrs },
        };
        entities[eid] = {
          entity_id: eid,
          platform: "glowcast",
          device_id: room.deviceId,
          area_id: room.areaId,
          name: fname,
          unique_id: `glowcast_${room.slug}_${fname.toLowerCase() === "show" ? "show" : fname.toLowerCase()}`,
        };
      }
      // Poke 0.1.2 color light + rgb_color attrs
      const colorEid = `light.glowcast_${room.slug}_color`;
      states[colorEid] = {
        entity_id: colorEid,
        state: "off",
        attributes: {
          friendly_name: `GlowCast ${room.name} Color`,
          supported_color_modes: ["rgb", "brightness"],
          rgb_color: null,
        },
      };
      entities[colorEid] = {
        entity_id: colorEid,
        platform: "glowcast",
        device_id: room.deviceId,
        area_id: room.areaId,
        name: "Color",
        unique_id: `glowcast_${room.slug}_color`,
      };
      // Seed rgb on theme/show for kitchen as example when custom
      if (room.slug === "kitchen") {
        /* default off custom */
      }
    }

    // Sample lights for set_color fallback tests
    const lightDefs = [
      ["light.kitchen_sink", "area_kit", "Kitchen Sink", ["rgb", "brightness"]],
      ["light.kitchen_island", "area_kit", "Kitchen Island", ["rgb", "brightness"]],
      ["light.nerd_cave_desk", "area_nc", "Nerd Cave Desk", ["rgb", "brightness"]],
      ["light.hallway", null, "Hallway", ["brightness"]], // not color
    ];
    for (const [eid, areaId, fname, modes] of lightDefs) {
      states[eid] = {
        entity_id: eid,
        state: "on",
        attributes: {
          friendly_name: fname,
          supported_color_modes: modes,
          rgb_color: [255, 255, 255],
        },
      };
      entities[eid] = {
        entity_id: eid,
        platform: "hue",
        area_id: areaId,
        device_id: null,
      };
    }
    // Expose member lights on show switches (preferred for fallback)
    states["switch.glowcast_kitchen_show"].attributes.lights = [
      "light.kitchen_sink",
      "light.kitchen_island",
    ];
    states["switch.glowcast_nerd_cave_show"].attributes.lights = ["light.nerd_cave_desk"];
    states["switch.glowcast_all_lights_show"].attributes.lights = [
      "light.kitchen_sink",
      "light.kitchen_island",
      "light.nerd_cave_desk",
    ];

    const withSetColor = opts?.withSetColor !== false; // default true
    const services = {
      glowcast: withSetColor
        ? { set_color: {}, start_theme: {}, stop: {} }
        : { start_theme: {}, stop: {} },
      switch: { toggle: {}, turn_on: {}, turn_off: {} },
      select: { select_option: {} },
      number: { set_value: {} },
      light: { turn_on: {}, turn_off: {} },
    };

    const hass = {
      states, entities, devices, areas, services,
      callService(domain, service, data) {
        calls.push({ domain, service, data: data ? { ...data } : data, at: Date.now() });
        if (domain === "glowcast" && service === "set_color") {
          const room = data?.room;
          const rgb = data?.rgb_color;
          if (room && rgb) {
            const themeId = `select.glowcast_${room}_theme`;
            const showId = `switch.glowcast_${room}_show`;
            const colorId = `light.glowcast_${room}_color`;
            if (states[themeId]) {
              states[themeId] = {
                ...states[themeId],
                state: "custom_color",
                attributes: { ...states[themeId].attributes, rgb_color: rgb },
              };
            }
            if (states[showId]) {
              states[showId] = {
                ...states[showId],
                attributes: { ...states[showId].attributes, rgb_color: rgb },
              };
            }
            if (states[colorId]) {
              states[colorId] = {
                ...states[colorId],
                state: "on",
                attributes: {
                  ...states[colorId].attributes,
                  rgb_color: rgb,
                  brightness: Math.round(((data.brightness ?? 100) / 100) * 255),
                },
              };
            }
          }
          return;
        }
        if (domain === "light" && service === "turn_off") {
          const eids = [].concat(data?.entity_id || []);
          for (const eid of eids) {
            if (!states[eid]) continue;
            states[eid] = { ...states[eid], state: "off" };
            // Clearing glowcast color light restores theme away from custom_color
            const m = String(eid).match(/^light\.glowcast_(.+)_color$/);
            if (m) {
              const themeId = `select.glowcast_${m[1]}_theme`;
              if (states[themeId] && states[themeId].state === "custom_color") {
                states[themeId] = {
                  ...states[themeId],
                  state: "halloween",
                  attributes: { ...states[themeId].attributes, rgb_color: null },
                };
              }
            }
          }
          return;
        }
        if (domain === "switch" && service === "turn_off") {
          const eids = [].concat(data?.entity_id || []);
          for (const eid of eids) {
            if (states[eid]) states[eid] = { ...states[eid], state: "off" };
          }
          return;
        }
        if (domain === "light" && service === "turn_on") {
          const eids = [].concat(data?.entity_id || []);
          for (const eid of eids) {
            if (!states[eid]) continue;
            states[eid] = {
              ...states[eid],
              state: "on",
              attributes: {
                ...states[eid].attributes,
                rgb_color: data.rgb_color || states[eid].attributes.rgb_color,
              },
            };
          }
          return;
        }
        const eid = data?.entity_id;
        if (!eid || !states[eid]) return;
        const apply = () => {
          if (domain === "switch" && service === "toggle") {
            states[eid] = { ...states[eid], state: states[eid].state === "on" ? "off" : "on" };
          } else if (domain === "select" && service === "select_option") {
            states[eid] = { ...states[eid], state: data.option };
          } else if (domain === "number" && service === "set_value") {
            states[eid] = { ...states[eid], state: String(data.value) };
          }
        };
        if (delayThemeMs && domain === "select" && service === "select_option" && String(eid).includes("_theme")) {
          setTimeout(apply, delayThemeMs);
        } else {
          apply();
        }
      },
      _calls: calls,
    };
    return { hass, rooms, THEME_KEYS, calls };
  }

  return { build, THEME_KEYS, MODE_OPTS, EFFECT_OPTS, rooms };
});

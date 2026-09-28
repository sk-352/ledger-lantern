'use strict';

/* ============================================================
   LEDGER & LANTERN — Game Master's Companion
   Vanilla JS, no build step, no external dependencies.
   Everything lives in localStorage; Export/Import move a
   campaign between machines as a plain JSON file.
   ============================================================ */

(function () {

  var STORAGE_KEY = 'ledgerAndLantern_v1';
  var ABILITY_DEFS = [
    ['STR', 'str'], ['DEX', 'dex'], ['CON', 'con'],
    ['WIS', 'wis'], ['INT', 'int'], ['CHA', 'cha']
  ];
  var GREGORIAN_MONTHS = [
    { name: 'January', days: 31 }, { name: 'February', days: 28 }, { name: 'March', days: 31 },
    { name: 'April', days: 30 }, { name: 'May', days: 31 }, { name: 'June', days: 30 },
    { name: 'July', days: 31 }, { name: 'August', days: 31 }, { name: 'September', days: 30 },
    { name: 'October', days: 31 }, { name: 'November', days: 30 }, { name: 'December', days: 31 }
  ];
  var GREGORIAN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // 5e Exhaustion (index 0 = no effect). Effects are cumulative up to the
  // current level; level 6 is fatal. Malnutrition and lack of rest are the
  // two sources this app tracks automatically — anything else (extreme
  // heat/cold, certain spells, forced marches) the DM adjusts by hand with
  // the +/- stepper.
  var EXHAUSTION_EFFECTS = [
    'No effects.',
    'Disadvantage on ability checks.',
    'Speed halved.',
    'Disadvantage on attack rolls and saving throws.',
    'Hit point maximum halved.',
    'Speed reduced to 0.',
    'Death.'
  ];
  var CON_SAVE_DC = 10;
  // Consecutive days on half rations before a CON save is required.
  var HALF_RATION_SAVE_THRESHOLD = 7;

  // Class resources: which pip-tracked features a class has, and how many
  // of each are available at each level. Keep this the single source of
  // truth — add a class here and it automatically gets a modal dropdown
  // option, a level-scaled resource table, and pip trackers on the card.
  var CLASS_MAX_LEVEL = 20;
  var CLASS_DEFS = {
    none: { label: 'None', groups: [], table: {} },
    wizard: {
      label: 'Wizard',
      hitDie: 6,
      groups: [
        { key: 'arcaneRecovery', label: 'Arcane Recovery', rechargeOn: 'short', resources: [
          { key: 'arcaneRecovery', label: 'Arcane Recovery' }
        ], noteFn: function (level) {
          var pool = Math.ceil(level / 2);
          return 'Recovers expended slots totaling up to ' + pool + ' level' + (pool === 1 ? '' : 's') + ' (none 6th level or higher). Currently tracked as a once-per-day use — full short/long rest timing is planned.';
        } },
        { key: 'spellSlots', label: 'Spell Slots', rechargeOn: 'long', resources: [
          { key: 'slot1', label: 'Level 1' },
          { key: 'slot2', label: 'Level 2' },
          { key: 'slot3', label: 'Level 3' },
          { key: 'slot4', label: 'Level 4' },
          { key: 'slot5', label: 'Level 5' },
          { key: 'slot6', label: 'Level 6' },
          { key: 'slot7', label: 'Level 7' },
          { key: 'slot8', label: 'Level 8' },
          { key: 'slot9', label: 'Level 9' }
        ] }
      ],
      // preparedSpells is stored per level (from the class table) but isn't
      // a "spend and refill" resource like the others — it's shown as a
      // plain read-only pill instead of a pip tracker.
      table: {
        1: { arcaneRecovery: 1, preparedSpells: 4, slot1: 2, slot2: 0, slot3: 0, slot4: 0, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        2: { arcaneRecovery: 1, preparedSpells: 5, slot1: 3, slot2: 0, slot3: 0, slot4: 0, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        3: { arcaneRecovery: 1, preparedSpells: 6, slot1: 4, slot2: 2, slot3: 0, slot4: 0, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        4: { arcaneRecovery: 1, preparedSpells: 7, slot1: 4, slot2: 3, slot3: 0, slot4: 0, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        5: { arcaneRecovery: 1, preparedSpells: 9, slot1: 4, slot2: 3, slot3: 2, slot4: 0, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        6: { arcaneRecovery: 1, preparedSpells: 10, slot1: 4, slot2: 3, slot3: 3, slot4: 0, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        7: { arcaneRecovery: 1, preparedSpells: 11, slot1: 4, slot2: 3, slot3: 3, slot4: 1, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        8: { arcaneRecovery: 1, preparedSpells: 12, slot1: 4, slot2: 3, slot3: 3, slot4: 2, slot5: 0, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        9: { arcaneRecovery: 1, preparedSpells: 14, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 1, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        10: { arcaneRecovery: 1, preparedSpells: 15, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 0, slot7: 0, slot8: 0, slot9: 0 },
        11: { arcaneRecovery: 1, preparedSpells: 16, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 0, slot8: 0, slot9: 0 },
        12: { arcaneRecovery: 1, preparedSpells: 16, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 0, slot8: 0, slot9: 0 },
        13: { arcaneRecovery: 1, preparedSpells: 17, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 1, slot8: 0, slot9: 0 },
        14: { arcaneRecovery: 1, preparedSpells: 18, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 1, slot8: 0, slot9: 0 },
        15: { arcaneRecovery: 1, preparedSpells: 19, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 1, slot8: 1, slot9: 0 },
        16: { arcaneRecovery: 1, preparedSpells: 21, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 1, slot8: 1, slot9: 0 },
        17: { arcaneRecovery: 1, preparedSpells: 22, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 2, slot6: 1, slot7: 1, slot8: 1, slot9: 1 },
        18: { arcaneRecovery: 1, preparedSpells: 23, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 3, slot6: 1, slot7: 1, slot8: 1, slot9: 1 },
        19: { arcaneRecovery: 1, preparedSpells: 24, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 3, slot6: 2, slot7: 1, slot8: 1, slot9: 1 },
        20: { arcaneRecovery: 1, preparedSpells: 25, slot1: 4, slot2: 3, slot3: 3, slot4: 3, slot5: 3, slot6: 2, slot7: 2, slot8: 1, slot9: 1 }
      }
    },
    fighter: {
      label: 'Fighter',
      hitDie: 10,
      groups: [
        { key: 'secondWind', label: 'Second Wind', rechargeOn: 'short', resources: [
          { key: 'secondWind', label: 'Second Wind' }
        ] }
      ],
      // weaponMastery is stored per level but isn't a "spend and refill"
      // resource — it's a fixed capacity, shown as a plain read-only pill.
      table: {
        1: { secondWind: 2, weaponMastery: 3 },
        2: { secondWind: 2, weaponMastery: 3 },
        3: { secondWind: 2, weaponMastery: 3 },
        4: { secondWind: 3, weaponMastery: 4 },
        5: { secondWind: 3, weaponMastery: 4 },
        6: { secondWind: 3, weaponMastery: 4 },
        7: { secondWind: 3, weaponMastery: 4 },
        8: { secondWind: 3, weaponMastery: 4 },
        9: { secondWind: 3, weaponMastery: 4 },
        10: { secondWind: 4, weaponMastery: 5 },
        11: { secondWind: 4, weaponMastery: 5 },
        12: { secondWind: 4, weaponMastery: 5 },
        13: { secondWind: 4, weaponMastery: 5 },
        14: { secondWind: 4, weaponMastery: 5 },
        15: { secondWind: 4, weaponMastery: 5 },
        16: { secondWind: 4, weaponMastery: 6 },
        17: { secondWind: 4, weaponMastery: 6 },
        18: { secondWind: 4, weaponMastery: 6 },
        19: { secondWind: 4, weaponMastery: 6 },
        20: { secondWind: 4, weaponMastery: 6 }
      }
    }
  };

  function getClassDef(className) {
    return CLASS_DEFS[className] || CLASS_DEFS.none;
  }
  function getLevelRow(className, level) {
    var def = getClassDef(className);
    return def.table[level] || {};
  }
  function getResourceMax(className, level, key) {
    var v = getLevelRow(className, level)[key];
    return Number.isFinite(v) ? v : 0;
  }
  // Same progression for every class — not stored per-class, just derived
  // from level: +2 at 1-4, +3 at 5-8, +4 at 9-12, +5 at 13-16, +6 at 17-20.
  function getProficiencyBonus(level) {
    var lvl = clamp(Math.round(level), 1, CLASS_MAX_LEVEL);
    return 2 + Math.floor((lvl - 1) / 4);
  }

  // Resets resourceUsed for every group whose rechargeOn matches one of the
  // given tags — e.g. rechargeResources(pc, ['short','long']) after a Short
  // Rest, or rechargeResources(pc, ['day']) at day-rollover.
  function rechargeResources(pc, tags) {
    var def = getClassDef(pc.className);
    def.groups.forEach(function (group) {
      if (tags.indexOf(group.rechargeOn) === -1) return;
      group.resources.forEach(function (res) {
        delete pc.resourceUsed[res.key];
      });
    });
  }

  function exhaustionSummary(level) {
    if (level <= 0) return EXHAUSTION_EFFECTS[0];
    if (level >= 6) return EXHAUSTION_EFFECTS[6];
    return EXHAUSTION_EFFECTS.slice(1, level + 1).join(' ');
  }

  function exhaustionLevelClass(level) {
    if (level <= 0) return 'lvl-0';
    if (level <= 2) return 'lvl-low';
    if (level <= 4) return 'lvl-mid';
    if (level === 5) return 'lvl-high';
    return 'lvl-death';
  }

  /* ---------------------------------------------------------- */
  /* State                                                       */
  /* ---------------------------------------------------------- */

  var state = null;

  // Transient UI state (not persisted): which class-feature dropdown menus
  // are currently open, keyed "pcId:groupKey" — re-rendering a card (e.g.
  // on every pip click) would otherwise silently close them.
  var openFeatureMenus = {};

  function defaultCalendarStructure() {
    return {
      months: GREGORIAN_MONTHS.map(function (m) { return { name: m.name, days: m.days }; }),
      weekdays: GREGORIAN_WEEKDAYS.slice()
    };
  }

  function defaultState() {
    var cal = defaultCalendarStructure();
    cal.current = { year: 1, monthIndex: 0, day: 1, weekdayIndex: 0, hour: 6 };
    return {
      campaignName: 'Ledger & Lantern',
      day: 1,
      log: [],
      pcs: [],
      combat: { round: 1, currentIndex: 0, combatants: [] },
      calendar: cal,
      rationSupply: 10
    };
  }

  function normalizeCalendar(cal) {
    var d = defaultCalendarStructure();

    var months = (cal && Array.isArray(cal.months)) ? cal.months
      .filter(function (m) { return m && Number.isFinite(m.days) && m.days >= 1; })
      .map(function (m) { return { name: (typeof m.name === 'string' && m.name.trim()) ? m.name.trim() : 'Month', days: Math.max(1, Math.round(m.days)) }; })
      : [];
    if (months.length === 0) months = d.months;

    var weekdays = (cal && Array.isArray(cal.weekdays)) ? cal.weekdays
      .map(function (w) { return (typeof w === 'string' && w.trim()) ? w.trim() : 'Day'; })
      : [];
    if (weekdays.length === 0) weekdays = d.weekdays;

    var raw = (cal && cal.current && typeof cal.current === 'object') ? cal.current : {};
    var monthIndex = Number.isFinite(raw.monthIndex) ? clamp(Math.round(raw.monthIndex), 0, months.length - 1) : 0;
    var day = Number.isFinite(raw.day) ? clamp(Math.round(raw.day), 1, months[monthIndex].days) : 1;
    var weekdayIndex = Number.isFinite(raw.weekdayIndex) ? clamp(Math.round(raw.weekdayIndex), 0, weekdays.length - 1) : 0;
    var year = Number.isFinite(raw.year) ? Math.round(raw.year) : 1;
    var hour = Number.isFinite(raw.hour) ? clamp(Math.round(raw.hour), 0, 23) : 6;

    return { months: months, weekdays: weekdays, current: { year: year, monthIndex: monthIndex, day: day, weekdayIndex: weekdayIndex, hour: hour } };
  }

  function advanceCalendarOneDay(cal) {
    cal.current.weekdayIndex = (cal.current.weekdayIndex + 1) % cal.weekdays.length;
    cal.current.day += 1;
    var monthLen = cal.months[cal.current.monthIndex].days;
    if (cal.current.day > monthLen) {
      cal.current.day = 1;
      cal.current.monthIndex += 1;
      if (cal.current.monthIndex >= cal.months.length) {
        cal.current.monthIndex = 0;
        cal.current.year += 1;
      }
    }
  }

  function formatCalendarDateLabel(cal) {
    var m = cal.months[cal.current.monthIndex];
    var w = cal.weekdays[cal.current.weekdayIndex];
    return w + ', ' + cal.current.day + ' ' + m.name + ', Year ' + cal.current.year;
  }

  function formatHour(hour) {
    return (hour < 10 ? '0' : '') + hour + ':00';
  }

  function normalizePC(p) {
    p = p || {};
    var a = p.abilities || {};
    var maxHp = numOr(p.hp && p.hp.max, 10);
    var meal = (p.mealStatus === 'half' || p.mealStatus === 'full') ? p.mealStatus : 'none';
    var className = (p.className === 'wizard' || p.className === 'fighter') ? p.className : 'none';
    var classLevel = clamp(Math.round(numOr(p.classLevel, 1)), 1, CLASS_MAX_LEVEL);
    var resourceUsed = {};
    if (p.resourceUsed && typeof p.resourceUsed === 'object') {
      Object.keys(p.resourceUsed).forEach(function (k) {
        var v = p.resourceUsed[k];
        if (Number.isFinite(v) && v >= 0) resourceUsed[k] = Math.round(v);
      });
    }
    return {
      id: p.id || uid(),
      name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Unnamed',
      abilities: {
        str: numOr(a.str, 10), dex: numOr(a.dex, 10), con: numOr(a.con, 10),
        wis: numOr(a.wis, 10), int: numOr(a.int, 10), cha: numOr(a.cha, 10)
      },
      ac: numOr(p.ac, 10),
      initMod: numOr(p.initMod, 0),
      hp: { current: clamp(numOr(p.hp && p.hp.current, maxHp), 0, maxHp), max: Math.max(1, maxHp) },
      exhaustion: clamp(Math.round(numOr(p.exhaustion, 0)), 0, 6),
      mealStatus: meal,
      restedToday: !!p.restedToday,
      daysWithoutFood: Math.max(0, Math.round(numOr(p.daysWithoutFood, 0))),
      daysHalfRations: Math.max(0, Math.round(numOr(p.daysHalfRations, 0))),
      daysWithoutRest: Math.max(0, Math.round(numOr(p.daysWithoutRest, 0))),
      className: className,
      classLevel: classLevel,
      hitDice: { used: clamp(Math.round(numOr(p.hitDice && p.hitDice.used, 0)), 0, classLevel) },
      resourceUsed: resourceUsed,
      notes: typeof p.notes === 'string' ? p.notes : ''
    };
  }

  function normalizeCombatant(c) {
    c = c || {};
    var hp = null;
    if (c.hp && Number.isFinite(c.hp.max)) {
      hp = { current: clamp(numOr(c.hp.current, c.hp.max), 0, c.hp.max), max: c.hp.max };
    }
    return {
      id: c.id || uid(),
      name: typeof c.name === 'string' && c.name.trim() ? c.name : 'Unnamed',
      isPc: !!c.isPc,
      pcId: c.pcId || null,
      initMod: numOr(c.initMod, 0),
      roll: Number.isFinite(c.roll) ? c.roll : null,
      ac: Number.isFinite(c.ac) ? c.ac : null,
      hp: hp
    };
  }

  function mergeWithDefaults(parsed) {
    var d = defaultState();
    if (!parsed || typeof parsed !== 'object') return d;
    return {
      campaignName: typeof parsed.campaignName === 'string' && parsed.campaignName.trim() ? parsed.campaignName : d.campaignName,
      day: Number.isFinite(parsed.day) ? parsed.day : d.day,
      log: Array.isArray(parsed.log) ? parsed.log
        .filter(function (e) { return e && Number.isFinite(e.day); })
        .map(function (e) {
          return {
            day: e.day,
            note: typeof e.note === 'string' ? e.note : '',
            dateLabel: typeof e.dateLabel === 'string' ? e.dateLabel : '',
            exhaustionNotes: Array.isArray(e.exhaustionNotes) ? e.exhaustionNotes.filter(function (l) { return typeof l === 'string'; }) : []
          };
        }) : [],
      pcs: Array.isArray(parsed.pcs) ? parsed.pcs.map(normalizePC) : [],
      combat: (parsed.combat && typeof parsed.combat === 'object') ? {
        round: Number.isFinite(parsed.combat.round) ? parsed.combat.round : 1,
        currentIndex: Number.isFinite(parsed.combat.currentIndex) ? parsed.combat.currentIndex : 0,
        combatants: Array.isArray(parsed.combat.combatants) ? parsed.combat.combatants.map(normalizeCombatant) : []
      } : d.combat,
      calendar: normalizeCalendar(parsed.calendar),
      rationSupply: Number.isFinite(parsed.rationSupply) ? Math.max(0, roundToTenth(parsed.rationSupply)) : d.rationSupply
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeWithDefaults(JSON.parse(raw));
    } catch (e) {
      // Storage unavailable or corrupted — continue with a fresh campaign.
    }
    return defaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showSavedIndicator();
    } catch (e) {
      // Best-effort persistence only; the session still works from memory.
    }
  }

  /* ---------------------------------------------------------- */
  /* Utilities                                                   */
  /* ---------------------------------------------------------- */

  function uid() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function numOr(v, fallback) { return Number.isFinite(v) ? v : (typeof v === 'number' ? fallback : (isFinite(parseFloat(v)) ? parseFloat(v) : fallback)); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function abilityMod(score) { return Math.floor((score - 10) / 2); }
  function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }
  function roundToTenth(n) { return Math.round(n * 10) / 10; }
  function rollD20() { return Math.floor(Math.random() * 20) + 1; }
  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Generic +/- for any modal number field, driven by data-target/data-delta
  // on the button — used by every stepper in the PC and Combatant forms.
  function stepField(targetId, delta) {
    var el = document.getElementById(targetId);
    if (!el) return;
    var min = el.min !== '' ? parseFloat(el.min) : -Infinity;
    var max = el.max !== '' ? parseFloat(el.max) : Infinity;
    var current = parseFloat(el.value);
    if (isNaN(current)) current = 0;
    el.value = clamp(current + delta, min, max);
  }

  var savedIndicatorTimer = null;
  function showSavedIndicator() {
    var el = $('#saveIndicator');
    if (!el) return;
    el.textContent = 'Saved to this browser';
    el.classList.add('show');
    clearTimeout(savedIndicatorTimer);
    savedIndicatorTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }

  /* ---------------------------------------------------------- */
  /* Rendering — header                                          */
  /* ---------------------------------------------------------- */

  function renderHeader() {
    $('#campaignName').textContent = state.campaignName;
    $('#dayNumber').textContent = state.day;
  }

  /* ---------------------------------------------------------- */
  /* Rendering — Party tab                                       */
  /* ---------------------------------------------------------- */

  function renderPartyTab() {
    var rationInput = $('#rationSupplyInput');
    if (rationInput) rationInput.value = state.rationSupply.toFixed(1);

    var list = $('#pcList');
    if (state.pcs.length === 0) {
      list.innerHTML = '<div class="empty-state">No adventurers enlisted yet.<br>Add your first character to begin the campaign.</div>';
      return;
    }
    list.innerHTML = state.pcs.map(pcCardHTML).join('');
  }

  function pcCardHTML(pc) {
    var hpPct = pc.hp.max > 0 ? Math.round((pc.hp.current / pc.hp.max) * 100) : 0;
    var hpClass = hpPct <= 25 ? 'hp-low' : (hpPct <= 50 ? 'hp-mid' : '');
    var levelRow = getLevelRow(pc.className, pc.classLevel);
    var abilities = ABILITY_DEFS.map(function (def) {
      var label = def[0], key = def[1];
      var score = pc.abilities[key];
      var mod = abilityMod(score);
      return '<div class="ability-chip"><span class="ab-label">' + label + '</span>' +
        '<span class="ab-score">' + score + '</span>' +
        '<span class="ab-mod">' + fmtMod(mod) + '</span></div>';
    }).join('');

    return (
      '<div class="pc-card" data-id="' + pc.id + '">' +
        '<div class="pc-card-head">' +
          '<div class="pc-name">' + escapeHTML(pc.name) + '</div>' +
          '<div class="pc-card-actions">' +
            '<button class="btn btn-icon" data-action="edit-pc" title="Edit character">✎</button>' +
            '<button class="btn btn-icon" data-action="delete-pc" title="Remove character">🗑</button>' +
          '</div>' +
        '</div>' +
        '<div class="pc-stats-row">' +
          '<span class="stat-pill">AC <strong>' + pc.ac + '</strong></span>' +
          '<span class="stat-pill">Init Mod <strong>' + fmtMod(pc.initMod) + '</strong></span>' +
          (pc.className !== 'none' ? '<span class="stat-pill">' + escapeHTML(getClassDef(pc.className).label) + ' <strong>' + pc.classLevel + '</strong></span>' : '') +
          (pc.className !== 'none' ? '<span class="stat-pill">Proficiency <strong>' + fmtMod(getProficiencyBonus(pc.classLevel)) + '</strong></span>' : '') +
          (Number.isFinite(levelRow.weaponMastery) ? '<span class="stat-pill">Weapon Mastery <strong>' + levelRow.weaponMastery + '</strong></span>' : '') +
          (Number.isFinite(levelRow.preparedSpells) ? '<span class="stat-pill">Prepared <strong>' + levelRow.preparedSpells + '</strong></span>' : '') +
        '</div>' +
        '<div class="abilities-row">' + abilities + '</div>' +
        '<div class="hp-row">' +
          '<label>HP</label>' +
          '<div class="hp-bar-track"><div class="hp-bar-fill ' + hpClass + '" style="width:' + hpPct + '%"></div></div>' +
          '<div class="hp-controls">' +
            '<button class="hp-step-btn" data-action="pc-hp-minus" title="-1 HP">−</button>' +
            '<input type="number" data-action="pc-hp-input" value="' + pc.hp.current + '" min="0" max="' + pc.hp.max + '">' +
            '<button class="hp-step-btn" data-action="pc-hp-plus" title="+1 HP">+</button>' +
          '</div>' +
          '<span class="hp-max">/ ' + pc.hp.max + '</span>' +
        '</div>' +
        pcExhaustionBlockHTML(pc) +
        classFeaturesBlockHTML(pc) +
      '</div>'
    );
  }

  function classFeaturesBlockHTML(pc) {
    var def = getClassDef(pc.className);
    var level = pc.classLevel;
    var groupMenus = '';

    if (pc.className !== 'none' && def.groups.length > 0) {
      groupMenus = def.groups.map(function (group) {
        var showLabel = group.resources.length > 1;
        var rows = group.resources.map(function (res) {
          var max = getResourceMax(pc.className, level, res.key);
          if (max <= 0) return '';
          var used = clamp(pc.resourceUsed[res.key] || 0, 0, max);
          var pips = '';
          for (var i = 0; i < max; i++) {
            var filled = i < (max - used);
            pips += filled
              ? '<button type="button" class="pip filled" data-action="resource-spend" data-key="' + res.key + '" title="Spend"></button>'
              : '<button type="button" class="pip hollow" data-action="resource-restore" data-key="' + res.key + '" title="Restore"></button>';
          }
          return '<div class="resource-row">' +
            (showLabel ? '<span class="resource-label">' + escapeHTML(res.label) + '</span>' : '') +
            '<div class="pip-row">' + pips + '</div>' +
          '</div>';
        }).join('');

        if (!rows) return ''; // nothing in this group unlocked yet at this level

        var noteHTML = group.noteFn ? '<p class="feature-menu-note">' + escapeHTML(group.noteFn(level)) + '</p>' : '';
        var menuKey = pc.id + ':' + group.key;
        var openAttr = openFeatureMenus[menuKey] ? ' open' : '';
        return (
          '<details class="feature-menu"' + openAttr + ' data-menu-key="' + menuKey + '">' +
            '<summary>' + escapeHTML(group.label) + '</summary>' +
            '<div class="feature-menu-panel">' + noteHTML + '<div class="resource-list">' + rows + '</div></div>' +
          '</details>'
        );
      }).join('');
    }

    var all = groupMenus + hitDiceMenuHTML(pc);
    if (!all) return '';
    return '<div class="class-feature-menus">' + all + '</div>';
  }

  function hitDiceMenuHTML(pc) {
    var def = getClassDef(pc.className);
    if (pc.className === 'none' || !Number.isFinite(def.hitDie)) return '';
    var max = pc.classLevel;
    var used = clamp(pc.hitDice.used, 0, max);
    var pips = '';
    for (var i = 0; i < max; i++) {
      var filled = i < (max - used);
      pips += filled
        ? '<button type="button" class="pip filled" data-action="hitdie-spend" title="Roll 1d' + def.hitDie + ' + CON and heal"></button>'
        : '<button type="button" class="pip hollow" data-action="hitdie-restore" title="Restore (undo, no healing)"></button>';
    }
    var menuKey = pc.id + ':hitDice';
    var openAttr = openFeatureMenus[menuKey] ? ' open' : '';
    var note = '<p class="feature-menu-note">Click a filled die to roll 1d' + def.hitDie + ' + CON modifier and heal (minimum 1). Spent dice are restored by a Long Rest.</p>';
    return (
      '<details class="feature-menu"' + openAttr + ' data-menu-key="' + menuKey + '">' +
        '<summary>Hit Dice · d' + def.hitDie + '</summary>' +
        '<div class="feature-menu-panel">' + note + '<div class="resource-list"><div class="resource-row"><div class="pip-row">' + pips + '</div></div></div></div>' +
      '</details>'
    );
  }

  function pcExhaustionBlockHTML(pc) {
    var streaks = '';
    if (pc.daysWithoutFood > 0) streaks += '<span class="stat-pill">🍽 ' + pc.daysWithoutFood + 'd without food</span>';
    if (pc.daysHalfRations > 0) streaks += '<span class="stat-pill">🥣 ' + pc.daysHalfRations + 'd on half rations</span>';
    if (pc.daysWithoutRest > 0) streaks += '<span class="stat-pill">😴 ' + pc.daysWithoutRest + 'd without rest</span>';

    return (
      '<div class="exhaustion-block">' +
        '<div class="exhaustion-header">' +
          '<span class="exhaustion-title">Exhaustion</span>' +
          '<div class="exhaustion-stepper">' +
            '<button class="hp-step-btn" data-action="exhaustion-minus" title="-1 level">−</button>' +
            '<span class="exhaustion-level ' + exhaustionLevelClass(pc.exhaustion) + '">' + (pc.exhaustion >= 6 ? '☠' : pc.exhaustion) + '</span>' +
            '<button class="hp-step-btn" data-action="exhaustion-plus" title="+1 level">+</button>' +
          '</div>' +
        '</div>' +
        '<p class="exhaustion-effect">' + exhaustionSummary(pc.exhaustion) + '</p>' +
      '</div>' +
      '<div class="daily-row">' +
        '<div class="daily-field">' +
          '<label>Ate today</label>' +
          '<select data-action="meal-select">' +
            '<option value="none"' + (pc.mealStatus === 'none' ? ' selected' : '') + '>None</option>' +
            '<option value="half"' + (pc.mealStatus === 'half' ? ' selected' : '') + '>Half ration</option>' +
            '<option value="full"' + (pc.mealStatus === 'full' ? ' selected' : '') + '>Full ration</option>' +
          '</select>' +
        '</div>' +
        '<label class="rested-check">' +
          '<input type="checkbox" data-action="rested-check"' + (pc.restedToday ? ' checked' : '') + '> Rested today' +
        '</label>' +
      '</div>' +
      (streaks ? '<div class="streak-row">' + streaks + '</div>' : '')
    );
  }

  /* ---------------------------------------------------------- */
  /* Rendering — Initiative tab                                  */
  /* ---------------------------------------------------------- */

  function renderInitiativeTab() {
    var combat = state.combat;
    $('#roundNumber').textContent = combat.round;

    var current = combat.combatants[combat.currentIndex];
    $('#turnCurrentLabel').textContent = combat.combatants.length === 0
      ? 'No combatants yet'
      : (current ? current.name + "'s turn" : 'No combatants yet');

    var list = $('#combatantList');
    if (combat.combatants.length === 0) {
      list.innerHTML = '<div class="empty-state">No one has joined the fray.<br>Load your party or add a monster to begin tracking initiative.</div>';
      return;
    }

    list.innerHTML = combat.combatants.map(function (c, index) {
      return combatantRowHTML(c, index === combat.currentIndex);
    }).join('');
  }

  function combatantRowHTML(c, isCurrent) {
    var total = c.roll === null ? null : c.roll + c.initMod;
    var totalHTML = total === null
      ? '<span class="total-value unrolled">—</span>'
      : '<span class="total-value">' + total + '</span>';

    var acHTML = c.ac === null ? '<span class="hpmini-none">—</span>' : String(c.ac);

    var hpHTML;
    if (c.hp) {
      hpHTML =
        '<span class="hpmini-label">HP</span>' +
        '<button class="hpmini-step" data-action="comb-hp-minus" title="-1 HP">−</button>' +
        '<input type="number" data-action="comb-hp-input" value="' + c.hp.current + '" min="0" max="' + c.hp.max + '">' +
        '<button class="hpmini-step" data-action="comb-hp-plus" title="+1 HP">+</button>' +
        '<span>/ ' + c.hp.max + '</span>';
    } else {
      hpHTML = '<span class="hpmini-label">HP</span><span class="hpmini-none">—</span>';
    }

    return (
      '<div class="combatant-row' + (isCurrent ? ' is-current' : '') + '" data-id="' + c.id + '">' +
        '<div class="combatant-main">' +
          '<span class="combatant-turn-marker">' + (isCurrent ? '▶' : '') + '</span>' +
          '<div class="combatant-name-block">' +
            '<span class="combatant-name">' + escapeHTML(c.name) + '</span>' +
            '<span class="combatant-tag">' + (c.isPc ? 'Player Character' : 'Monster / NPC') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="combatant-stats">' +
          '<div class="roll-block">' +
            '<label>Roll</label>' +
            '<input type="number" data-action="roll-input" value="' + (c.roll === null ? '' : c.roll) + '" placeholder="—">' +
            '<button class="roll-die-btn" data-action="roll-d20" title="Roll a d20">🎲</button>' +
          '</div>' +
          '<div class="total-block"><span class="total-label">MOD ' + fmtMod(c.initMod) + '</span>' + totalHTML + '</div>' +
          '<div class="ac-block"><span>AC</span>' + acHTML + '</div>' +
          '<div class="hpmini-block">' + hpHTML + '</div>' +
        '</div>' +
        '<button class="combatant-remove" data-action="remove-combatant" title="Remove from combat">✕</button>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------- */
  /* Rendering — Calendar tab                                    */
  /* ---------------------------------------------------------- */

  function renderCalendarTab() {
    var cal = state.calendar;
    var m = cal.months[cal.current.monthIndex];
    var w = cal.weekdays[cal.current.weekdayIndex];

    $('#calendarDateHuge').textContent = cal.current.day + ' ' + m.name;
    $('#calendarSubline').textContent = w + ' · Year ' + cal.current.year + ' · ' + formatHour(cal.current.hour);
    $('#calendarDayCounter').textContent = 'Campaign Day ' + state.day;

    var monthSelect = $('#jumpMonth');
    monthSelect.innerHTML = cal.months.map(function (mo, i) {
      return '<option value="' + i + '">' + escapeHTML(mo.name) + '</option>';
    }).join('');
    monthSelect.value = String(cal.current.monthIndex);

    var weekdaySelect = $('#jumpWeekday');
    weekdaySelect.innerHTML = cal.weekdays.map(function (wd, i) {
      return '<option value="' + i + '">' + escapeHTML(wd) + '</option>';
    }).join('');
    weekdaySelect.value = String(cal.current.weekdayIndex);

    $('#jumpYear').value = cal.current.year;
    $('#jumpDay').value = cal.current.day;
    $('#jumpDay').max = m.days;
    $('#jumpHour').value = cal.current.hour;

    var log = $('#dayLog');
    if (state.log.length === 0) {
      log.innerHTML = '<div class="empty-state">No entries yet. Advance the day to begin the chronicle.</div>';
      return;
    }
    log.innerHTML = state.log.map(function (entry) {
      var notesHTML = (entry.exhaustionNotes && entry.exhaustionNotes.length)
        ? '<ul class="day-log-exhaustion">' + entry.exhaustionNotes.map(function (line) { return '<li>' + escapeHTML(line) + '</li>'; }).join('') + '</ul>'
        : '';
      return (
        '<div class="day-log-entry">' +
          '<div class="day-log-day">Day ' + entry.day + '</div>' +
          '<div class="day-log-body">' +
            (entry.dateLabel ? '<div class="day-log-date">' + escapeHTML(entry.dateLabel) + '</div>' : '') +
            '<div class="day-log-note">' + (entry.note ? escapeHTML(entry.note) : '<span class="hpmini-none">No notes recorded.</span>') + '</div>' +
            notesHTML +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderAll() {
    renderHeader();
    renderPartyTab();
    renderInitiativeTab();
    renderCalendarTab();
  }

  /* ---------------------------------------------------------- */
  /* Party actions                                                */
  /* ---------------------------------------------------------- */

  function findPC(id) {
    for (var i = 0; i < state.pcs.length; i++) if (state.pcs[i].id === id) return state.pcs[i];
    return null;
  }

  function openAddPCModal() {
    $('#pcForm').reset();
    $('#pcId').value = '';
    $('#pcModalTitle').textContent = 'Add Character';
    ['pcStr', 'pcDex', 'pcCon', 'pcWis', 'pcInt', 'pcCha'].forEach(function (id) { $('#' + id).value = 10; });
    $('#pcAc').value = 10;
    $('#pcInitMod').value = 0;
    $('#pcMaxHp').value = 10;
    $('#pcCurrentHp').value = 10;
    $('#pcClass').value = 'none';
    $('#pcClassLevel').value = 1;
    $('#pcNotes').value = '';
    showModal('#pcModalOverlay');
    $('#pcName').focus();
  }

  function openEditPCModal(id) {
    var pc = findPC(id);
    if (!pc) return;
    $('#pcModalTitle').textContent = 'Edit Character';
    $('#pcId').value = pc.id;
    $('#pcName').value = pc.name;
    $('#pcStr').value = pc.abilities.str;
    $('#pcDex').value = pc.abilities.dex;
    $('#pcCon').value = pc.abilities.con;
    $('#pcWis').value = pc.abilities.wis;
    $('#pcInt').value = pc.abilities.int;
    $('#pcCha').value = pc.abilities.cha;
    $('#pcAc').value = pc.ac;
    $('#pcInitMod').value = pc.initMod;
    $('#pcMaxHp').value = pc.hp.max;
    $('#pcCurrentHp').value = pc.hp.current;
    $('#pcClass').value = pc.className;
    $('#pcClassLevel').value = pc.classLevel;
    $('#pcNotes').value = pc.notes;
    showModal('#pcModalOverlay');
    $('#pcName').focus();
  }

  function submitPCForm(e) {
    e.preventDefault();
    var id = $('#pcId').value;
    var maxHp = Math.max(1, parseInt($('#pcMaxHp').value, 10) || 10);
    var currentHp = clamp(parseInt($('#pcCurrentHp').value, 10), 0, maxHp);
    if (isNaN(currentHp)) currentHp = maxHp;

    var data = {
      name: $('#pcName').value.trim() || 'Unnamed',
      abilities: {
        str: parseInt($('#pcStr').value, 10) || 0,
        dex: parseInt($('#pcDex').value, 10) || 0,
        con: parseInt($('#pcCon').value, 10) || 0,
        wis: parseInt($('#pcWis').value, 10) || 0,
        int: parseInt($('#pcInt').value, 10) || 0,
        cha: parseInt($('#pcCha').value, 10) || 0
      },
      ac: parseInt($('#pcAc').value, 10) || 0,
      initMod: parseInt($('#pcInitMod').value, 10) || 0,
      hp: { current: currentHp, max: maxHp },
      className: $('#pcClass').value,
      classLevel: clamp(parseInt($('#pcClassLevel').value, 10) || 1, 1, CLASS_MAX_LEVEL),
      notes: $('#pcNotes').value.trim()
    };

    if (id) {
      var pc = findPC(id);
      if (pc) {
        var classChanged = pc.className !== data.className;
        pc.name = data.name; pc.abilities = data.abilities; pc.ac = data.ac;
        pc.initMod = data.initMod; pc.hp = data.hp; pc.notes = data.notes;
        pc.className = data.className;
        pc.classLevel = data.classLevel;
        if (classChanged) pc.resourceUsed = {};
      }
    } else {
      data.id = uid();
      state.pcs.push(normalizePC(data));
    }
    saveState();
    renderPartyTab();
    closeModal('#pcModalOverlay');
  }

  function deletePC(id) {
    var pc = findPC(id);
    if (!pc) return;
    if (!confirm('Remove ' + pc.name + ' from the party? This cannot be undone.')) return;
    state.pcs = state.pcs.filter(function (p) { return p.id !== id; });

    var combat = state.combat;
    var removedIndex = combat.combatants.findIndex(function (c) { return c.pcId === id; });
    combat.combatants = combat.combatants.filter(function (c) { return c.pcId !== id; });
    if (removedIndex !== -1) fixCurrentIndexAfterRemoval(removedIndex);

    saveState();
    renderPartyTab();
    renderInitiativeTab();
  }

  function adjustPCHP(id, delta) {
    var pc = findPC(id);
    if (!pc) return;
    pc.hp.current = clamp(pc.hp.current + delta, 0, pc.hp.max);
    saveState();
    renderPartyTab();
  }

  function setPCHP(id, value) {
    var pc = findPC(id);
    if (!pc) return;
    var v = parseInt(value, 10);
    if (isNaN(v)) v = pc.hp.current;
    pc.hp.current = clamp(v, 0, pc.hp.max);
    saveState();
    renderPartyTab();
  }

  function adjustExhaustion(id, delta) {
    var pc = findPC(id);
    if (!pc) return;
    pc.exhaustion = clamp(pc.exhaustion + delta, 0, 6);
    saveState();
    renderPartyTab();
  }

  function spendResource(id, key) {
    var pc = findPC(id);
    if (!pc) return;
    var max = getResourceMax(pc.className, pc.classLevel, key);
    pc.resourceUsed[key] = clamp((pc.resourceUsed[key] || 0) + 1, 0, max);
    saveState();
    renderPartyTab();
  }

  function restoreResource(id, key) {
    var pc = findPC(id);
    if (!pc) return;
    var max = getResourceMax(pc.className, pc.classLevel, key);
    pc.resourceUsed[key] = clamp((pc.resourceUsed[key] || 0) - 1, 0, max);
    saveState();
    renderPartyTab();
  }

  function spendHitDie(id) {
    var pc = findPC(id);
    if (!pc || pc.className === 'none') return;
    var def = getClassDef(pc.className);
    if (!Number.isFinite(def.hitDie)) return;
    var max = pc.classLevel;
    if (pc.hitDice.used >= max) return;
    var roll = Math.floor(Math.random() * def.hitDie) + 1;
    var conMod = abilityMod(pc.abilities.con);
    var healed = Math.max(1, roll + conMod);
    pc.hitDice.used = clamp(pc.hitDice.used + 1, 0, max);
    pc.hp.current = clamp(pc.hp.current + healed, 0, pc.hp.max);
    saveState();
    renderPartyTab();
  }

  function restoreHitDie(id) {
    var pc = findPC(id);
    if (!pc) return;
    pc.hitDice.used = clamp(pc.hitDice.used - 1, 0, pc.classLevel);
    saveState();
    renderPartyTab();
  }

  function setMealStatus(id, value) {
    var pc = findPC(id);
    if (!pc) return;
    pc.mealStatus = (value === 'half' || value === 'full') ? value : 'none';
    saveState();
    renderPartyTab();
  }

  function setRestedToday(id, checked) {
    var pc = findPC(id);
    if (!pc) return;
    pc.restedToday = !!checked;
    saveState();
    renderPartyTab();
  }

  function restAll() {
    if (state.pcs.length === 0) return;
    state.pcs.forEach(function (p) { p.restedToday = true; });
    saveState();
    renderPartyTab();
  }

  function adjustRationSupply(delta) {
    state.rationSupply = Math.max(0, roundToTenth(state.rationSupply + delta));
    saveState();
    renderPartyTab();
  }

  function setRationSupply(value) {
    var v = parseFloat(value);
    if (isNaN(v)) v = state.rationSupply;
    state.rationSupply = Math.max(0, roundToTenth(v));
    saveState();
    renderPartyTab();
  }

  function feedAll(portion) {
    if (state.pcs.length === 0) return;
    state.pcs.forEach(function (p) { p.mealStatus = portion; });
    saveState();
    renderPartyTab();
  }

  /* ---------------------------------------------------------- */
  /* Initiative actions                                           */
  /* ---------------------------------------------------------- */

  function findCombatant(id) {
    var arr = state.combat.combatants;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  function loadParty() {
    var combat = state.combat;
    var existingPcIds = {};
    combat.combatants.forEach(function (c) { if (c.pcId) existingPcIds[c.pcId] = true; });

    state.pcs.forEach(function (pc) {
      if (existingPcIds[pc.id]) return;
      combat.combatants.push({
        id: uid(), name: pc.name, isPc: true, pcId: pc.id,
        initMod: pc.initMod, roll: null, ac: pc.ac,
        hp: { current: pc.hp.current, max: pc.hp.max }
      });
    });
    saveState();
    renderInitiativeTab();
  }

  function openAddCombatantModal() {
    $('#combatantForm').reset();
    $('#combInitMod').value = 0;
    showModal('#combatantModalOverlay');
    $('#combName').focus();
  }

  function submitCombatantForm(e) {
    e.preventDefault();
    var name = $('#combName').value.trim() || 'Unnamed';
    var initMod = parseInt($('#combInitMod').value, 10) || 0;
    var acRaw = $('#combAc').value;
    var maxHpRaw = $('#combMaxHp').value;
    var ac = acRaw === '' ? null : (parseInt(acRaw, 10) || 0);
    var maxHp = maxHpRaw === '' ? null : Math.max(1, parseInt(maxHpRaw, 10) || 1);

    state.combat.combatants.push({
      id: uid(), name: name, isPc: false, pcId: null,
      initMod: initMod, roll: null, ac: ac,
      hp: maxHp ? { current: maxHp, max: maxHp } : null
    });
    saveState();
    renderInitiativeTab();
    closeModal('#combatantModalOverlay');
  }

  function removeCombatant(id) {
    var combat = state.combat;
    var idx = combat.combatants.findIndex(function (c) { return c.id === id; });
    if (idx === -1) return;
    combat.combatants.splice(idx, 1);
    fixCurrentIndexAfterRemoval(idx);
    saveState();
    renderInitiativeTab();
  }

  function fixCurrentIndexAfterRemoval(removedIndex) {
    var combat = state.combat;
    if (combat.combatants.length === 0) {
      combat.currentIndex = 0;
      combat.round = 1;
    } else if (removedIndex < combat.currentIndex) {
      combat.currentIndex -= 1;
    } else if (removedIndex === combat.currentIndex) {
      combat.currentIndex = Math.min(combat.currentIndex, combat.combatants.length - 1);
    }
  }

  function setRoll(id, rawValue) {
    var c = findCombatant(id);
    if (!c) return;
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      c.roll = null;
    } else {
      var v = parseInt(rawValue, 10);
      c.roll = isNaN(v) ? null : v;
    }
    saveState();
    renderInitiativeTab();
  }

  function rollOne(id) {
    var c = findCombatant(id);
    if (!c) return;
    c.roll = rollD20();
    saveState();
    renderInitiativeTab();
  }

  function rollAllUnrolled() {
    var combat = state.combat;
    if (combat.combatants.length === 0) return;
    combat.combatants.forEach(function (c) { if (c.roll === null) c.roll = rollD20(); });
    sortNow();
  }

  function sortNow() {
    var combat = state.combat;
    if (combat.combatants.length === 0) return;
    var activeId = combat.combatants[combat.currentIndex] ? combat.combatants[combat.currentIndex].id : null;

    var rolled = combat.combatants.filter(function (c) { return c.roll !== null; });
    var unrolled = combat.combatants.filter(function (c) { return c.roll === null; });
    rolled.sort(function (a, b) { return (b.roll + b.initMod) - (a.roll + a.initMod); });

    combat.combatants = rolled.concat(unrolled);
    if (activeId) {
      var newIndex = combat.combatants.findIndex(function (c) { return c.id === activeId; });
      combat.currentIndex = newIndex === -1 ? 0 : newIndex;
    } else {
      combat.currentIndex = 0;
    }
    saveState();
    renderInitiativeTab();
  }

  function adjustCombatantHP(id, delta) {
    var c = findCombatant(id);
    if (!c || !c.hp) return;
    c.hp.current = clamp(c.hp.current + delta, 0, c.hp.max);
    saveState();
    renderInitiativeTab();
  }

  function setCombatantHP(id, value) {
    var c = findCombatant(id);
    if (!c || !c.hp) return;
    var v = parseInt(value, 10);
    if (isNaN(v)) v = c.hp.current;
    c.hp.current = clamp(v, 0, c.hp.max);
    saveState();
    renderInitiativeTab();
  }

  function nextTurn() {
    var combat = state.combat;
    if (combat.combatants.length === 0) return;
    combat.currentIndex += 1;
    if (combat.currentIndex >= combat.combatants.length) {
      combat.currentIndex = 0;
      combat.round += 1;
    }
    saveState();
    renderInitiativeTab();
  }

  function prevTurn() {
    var combat = state.combat;
    if (combat.combatants.length === 0) return;
    combat.currentIndex -= 1;
    if (combat.currentIndex < 0) {
      combat.currentIndex = combat.combatants.length - 1;
      combat.round = Math.max(1, combat.round - 1);
    }
    saveState();
    renderInitiativeTab();
  }

  function endCombat() {
    if (state.combat.combatants.length === 0) return;
    if (!confirm('End combat and clear the battle order? Character sheets are not affected.')) return;
    state.combat = { round: 1, currentIndex: 0, combatants: [] };
    saveState();
    renderInitiativeTab();
  }

  /* ---------------------------------------------------------- */
  /* Calendar actions                                             */
  /* ---------------------------------------------------------- */

  function processDailyNeeds(pc) {
    var lines = [];
    var conMod = abilityMod(pc.abilities.con);
    var meal = pc.mealStatus;
    var wasRested = pc.restedToday;

    // Only resources tagged to recharge on day-passing reset here now —
    // Spell Slots recharge on a Long Rest and Arcane Recovery / Second Wind
    // recharge on a Short Rest, handled by takeShortRest()/takeLongRest().
    rechargeResources(pc, ['day']);

    // Each character draws from the shared ration pool: 1 for a full ration,
    // 0.5 for a half, nothing if they didn't eat. Clamped at 0 for now —
    // running out has no further consequence yet.
    if (meal === 'full') {
      pc.daysWithoutFood = 0;
      pc.daysHalfRations = 0;
      state.rationSupply = Math.max(0, roundToTenth(state.rationSupply - 1));
    } else if (meal === 'half') {
      pc.daysWithoutFood = 0;
      pc.daysHalfRations += 1;
      state.rationSupply = Math.max(0, roundToTenth(state.rationSupply - 0.5));
      // Half rations only cost a CON save after a sustained streak.
      if (pc.daysHalfRations >= HALF_RATION_SAVE_THRESHOLD) {
        var foodRoll = rollD20();
        var foodTotal = foodRoll + conMod;
        if (foodTotal < CON_SAVE_DC) {
          pc.exhaustion = clamp(pc.exhaustion + 1, 0, 6);
          lines.push(pc.name + ': ' + pc.daysHalfRations + ' days on half rations, failed the DC ' + CON_SAVE_DC + ' CON save (rolled ' + foodRoll + ' ' + fmtMod(conMod) + ' = ' + foodTotal + ') — Exhaustion ' + (pc.exhaustion - 1) + '→' + pc.exhaustion + '.');
        } else {
          lines.push(pc.name + ': ' + pc.daysHalfRations + ' days on half rations but passed the DC ' + CON_SAVE_DC + ' CON save (rolled ' + foodRoll + ' ' + fmtMod(conMod) + ' = ' + foodTotal + ').');
        }
      }
    } else {
      pc.daysHalfRations = 0;
      pc.daysWithoutFood += 1;
      if (pc.daysWithoutFood >= 5) {
        var before = pc.exhaustion;
        pc.exhaustion = clamp(pc.exhaustion + 1, 0, 6);
        lines.push(pc.name + ': ' + pc.daysWithoutFood + ' days without food — automatic Exhaustion ' + before + '→' + pc.exhaustion + '.');
      }
    }

    if (wasRested) {
      pc.daysWithoutRest = 0;
    } else {
      pc.daysWithoutRest += 1;
      if (pc.daysWithoutRest >= 2) {
        var restRoll = rollD20();
        var restTotal = restRoll + conMod;
        if (restTotal < CON_SAVE_DC) {
          pc.exhaustion = clamp(pc.exhaustion + 1, 0, 6);
          lines.push(pc.name + ": hasn't rested in " + pc.daysWithoutRest + ' days, failed the DC ' + CON_SAVE_DC + ' CON save (rolled ' + restRoll + ' ' + fmtMod(conMod) + ' = ' + restTotal + ') — Exhaustion ' + (pc.exhaustion - 1) + '→' + pc.exhaustion + '.');
        } else {
          lines.push(pc.name + ": hasn't rested in " + pc.daysWithoutRest + ' days but passed the DC ' + CON_SAVE_DC + ' CON save (rolled ' + restRoll + ' ' + fmtMod(conMod) + ' = ' + restTotal + ').');
        }
      }
    }

    pc.mealStatus = 'none';
    pc.restedToday = false;
    return lines;
  }

  /* ---------------------------------------------------------- */
  /* Clock: hours, and the day-rollover they can trigger          */
  /* ---------------------------------------------------------- */

  function resolveDayEnd(note) {
    var closingDay = state.day;
    var dateLabel = formatCalendarDateLabel(state.calendar);

    var exhaustionNotes = [];
    state.pcs.forEach(function (p) {
      var lines = processDailyNeeds(p);
      exhaustionNotes = exhaustionNotes.concat(lines);
    });

    state.log.unshift({ day: closingDay, note: (note || '').trim(), dateLabel: dateLabel, exhaustionNotes: exhaustionNotes });
    state.day = closingDay + 1;
    advanceCalendarOneDay(state.calendar);
  }

  // The single place time moves forward. Crossing midnight resolves the day
  // that just ended (food/rest checks, day-tagged resource refill, chronicle
  // entry) exactly once, whether that happens via "Advance Day" or because a
  // rest happened to run past midnight.
  function passHours(n, note) {
    var remainingNote = note;
    state.calendar.current.hour += n;
    while (state.calendar.current.hour >= 24) {
      state.calendar.current.hour -= 24;
      resolveDayEnd(remainingNote);
      remainingNote = ''; // only the first day boundary crossed gets the DM's note
    }
  }

  function advanceDay(note) {
    passHours(24, note);
    saveState();
    renderHeader();
    renderPartyTab();
    renderCalendarTab();
  }

  function advanceDayQuick() {
    if (!confirm('Advance to Day ' + (state.day + 1) + "? Each character's food and rest for the day will be resolved, which may trigger Exhaustion.")) return;
    advanceDay('');
  }

  function advanceDayWithNote() {
    var note = $('#dayNoteInput').value;
    advanceDay(note);
    $('#dayNoteInput').value = '';
  }

  /* ---------------------------------------------------------- */
  /* Rests                                                        */
  /* ---------------------------------------------------------- */

  function takeShortRest() {
    if (state.pcs.length === 0) return;
    if (!confirm('Take a Short Rest as a party? This advances the clock by 1 hour and recharges Short Rest features (Hit Dice can still be spent any time from their own menu).')) return;
    passHours(1, '');
    state.pcs.forEach(function (pc) {
      if (pc.hp.current <= 0) return; // needs at least 1 HP to benefit
      rechargeResources(pc, ['short']);
    });
    saveState();
    renderHeader();
    renderPartyTab();
    renderCalendarTab();
  }

  function takeLongRest() {
    if (state.pcs.length === 0) return;
    if (!confirm('Take a Long Rest as a party? This advances the clock by 8 hours, fully heals everyone, restores Hit Dice, eases Exhaustion by 1 (if well-fed), and recharges Long/Short Rest features.')) return;
    passHours(8, '');
    state.pcs.forEach(function (pc) {
      if (pc.hp.current <= 0) return; // needs at least 1 HP to benefit
      pc.hp.current = pc.hp.max;
      pc.hitDice.used = 0;
      if (pc.mealStatus === 'full' && pc.exhaustion > 0) pc.exhaustion = clamp(pc.exhaustion - 1, 0, 6);
      pc.restedToday = true;
      rechargeResources(pc, ['short', 'long']);
    });
    saveState();
    renderHeader();
    renderPartyTab();
    renderCalendarTab();
  }

  function setCurrentDate() {
    var cal = state.calendar;
    var year = parseInt($('#jumpYear').value, 10);
    if (isNaN(year)) year = cal.current.year;

    var monthIndex = parseInt($('#jumpMonth').value, 10);
    if (isNaN(monthIndex) || monthIndex < 0 || monthIndex >= cal.months.length) monthIndex = cal.current.monthIndex;

    var maxDay = cal.months[monthIndex].days;
    var day = clamp(parseInt($('#jumpDay').value, 10) || 1, 1, maxDay);

    var weekdayIndex = parseInt($('#jumpWeekday').value, 10);
    if (isNaN(weekdayIndex) || weekdayIndex < 0 || weekdayIndex >= cal.weekdays.length) weekdayIndex = cal.current.weekdayIndex;

    var hour = clamp(parseInt($('#jumpHour').value, 10), 0, 23);
    if (isNaN(hour)) hour = cal.current.hour;

    cal.current = { year: year, monthIndex: monthIndex, day: day, weekdayIndex: weekdayIndex, hour: hour };
    saveState();
    renderCalendarTab();
  }

  /* ---------------------------------------------------------- */
  /* Calendar structure editor (months / weekdays)                */
  /* ---------------------------------------------------------- */

  var draftMonths = [];
  var draftWeekdays = [];

  function openCalendarStructureModal() {
    draftMonths = state.calendar.months.map(function (m) { return { name: m.name, days: m.days }; });
    draftWeekdays = state.calendar.weekdays.slice();
    renderMonthsEditor();
    renderWeekdaysEditor();
    showModal('#calendarStructureModalOverlay');
  }

  function renderMonthsEditor() {
    $('#monthsEditorList').innerHTML = draftMonths.map(function (m, i) {
      return (
        '<div class="editor-row">' +
          '<input type="text" class="month-name-input" value="' + escapeHTML(m.name) + '">' +
          '<input type="number" class="month-days-input" value="' + m.days + '" min="1" max="99">' +
          '<button type="button" class="btn-icon" data-action="remove-month-row" data-index="' + i + '" title="Remove month">✕</button>' +
        '</div>'
      );
    }).join('');
  }

  function renderWeekdaysEditor() {
    $('#weekdaysEditorList').innerHTML = draftWeekdays.map(function (w, i) {
      return (
        '<div class="editor-row">' +
          '<input type="text" class="weekday-name-input" value="' + escapeHTML(w) + '">' +
          '<button type="button" class="btn-icon" data-action="remove-weekday-row" data-index="' + i + '" title="Remove day">✕</button>' +
        '</div>'
      );
    }).join('');
  }

  function syncMonthsDraftFromDOM() {
    draftMonths = $all('#monthsEditorList .editor-row').map(function (row) {
      var name = row.querySelector('.month-name-input').value.trim() || 'Month';
      var days = Math.max(1, parseInt(row.querySelector('.month-days-input').value, 10) || 1);
      return { name: name, days: days };
    });
  }

  function syncWeekdaysDraftFromDOM() {
    draftWeekdays = $all('#weekdaysEditorList .editor-row').map(function (row) {
      return row.querySelector('.weekday-name-input').value.trim() || 'Day';
    });
  }

  function addMonthRow() {
    syncMonthsDraftFromDOM();
    draftMonths.push({ name: 'New Month', days: 30 });
    renderMonthsEditor();
  }

  function removeMonthRow(index) {
    syncMonthsDraftFromDOM();
    if (draftMonths.length <= 1) { alert('A calendar needs at least one month.'); return; }
    draftMonths.splice(index, 1);
    renderMonthsEditor();
  }

  function addWeekdayRow() {
    syncWeekdaysDraftFromDOM();
    draftWeekdays.push('New Day');
    renderWeekdaysEditor();
  }

  function removeWeekdayRow(index) {
    syncWeekdaysDraftFromDOM();
    if (draftWeekdays.length <= 1) { alert('A calendar needs at least one weekday.'); return; }
    draftWeekdays.splice(index, 1);
    renderWeekdaysEditor();
  }

  function loadGregorianPresetIntoDraft() {
    var preset = defaultCalendarStructure();
    draftMonths = preset.months;
    draftWeekdays = preset.weekdays;
    renderMonthsEditor();
    renderWeekdaysEditor();
  }

  function saveCalendarStructure() {
    syncMonthsDraftFromDOM();
    syncWeekdaysDraftFromDOM();
    if (draftMonths.length === 0 || draftWeekdays.length === 0) {
      alert('A calendar needs at least one month and one weekday.');
      return;
    }

    state.calendar.months = draftMonths;
    state.calendar.weekdays = draftWeekdays;

    var cur = state.calendar.current;
    cur.monthIndex = clamp(cur.monthIndex, 0, state.calendar.months.length - 1);
    cur.day = clamp(cur.day, 1, state.calendar.months[cur.monthIndex].days);
    cur.weekdayIndex = clamp(cur.weekdayIndex, 0, state.calendar.weekdays.length - 1);

    saveState();
    renderCalendarTab();
    closeModal('#calendarStructureModalOverlay');
  }

  /* ---------------------------------------------------------- */
  /* Campaign name                                                */
  /* ---------------------------------------------------------- */

  function editCampaignName() {
    var next = prompt('Campaign name:', state.campaignName);
    if (next === null) return;
    next = next.trim();
    if (!next) return;
    state.campaignName = next.slice(0, 60);
    saveState();
    renderHeader();
  }

  /* ---------------------------------------------------------- */
  /* Data: export / import / reset                                */
  /* ---------------------------------------------------------- */

  function exportJSON() {
    try {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var slug = state.campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ledger-and-lantern-' + slug + '-day' + state.day + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) {
      alert('This browser could not export a file. Try a different browser, or copy the data manually from your browser\'s developer tools.');
    }
  }

  function triggerImport() {
    $('#importFile').click();
  }

  function handleImportFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        alert('That file could not be read as a Ledger & Lantern campaign.');
        e.target.value = '';
        return;
      }
      if (!confirm('Import this file? It will replace your current campaign data.')) {
        e.target.value = '';
        return;
      }
      state = mergeWithDefaults(parsed);
      saveState();
      renderAll();
      e.target.value = '';
    };
    reader.onerror = function () {
      alert('That file could not be read.');
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function resetCampaign() {
    if (!confirm('Reset the entire campaign? This deletes every character, the battle order, and the chronicle. This cannot be undone.')) return;
    state = defaultState();
    saveState();
    renderAll();
  }

  /* ---------------------------------------------------------- */
  /* Modal helpers                                                */
  /* ---------------------------------------------------------- */

  function showModal(sel) { $(sel).hidden = false; }
  function closeModal(sel) { $(sel).hidden = true; }

  /* ---------------------------------------------------------- */
  /* Tabs                                                         */
  /* ---------------------------------------------------------- */

  function switchTab(tabName) {
    $all('.tab-btn').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $all('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'tab-' + tabName);
    });
  }

  /* ---------------------------------------------------------- */
  /* Event wiring                                                 */
  /* ---------------------------------------------------------- */

  function closestWithAction(el) {
    return el.closest ? el.closest('[data-action]') : null;
  }

  function handleClick(e) {
    var tabBtn = e.target.closest ? e.target.closest('.tab-btn') : null;
    if (tabBtn) { switchTab(tabBtn.getAttribute('data-tab')); return; }

    var actionEl = closestWithAction(e.target);
    if (!actionEl) return;
    var action = actionEl.getAttribute('data-action');

    var pcCard = actionEl.closest ? actionEl.closest('.pc-card') : null;
    var pcId = pcCard ? pcCard.getAttribute('data-id') : null;

    var combRow = actionEl.closest ? actionEl.closest('.combatant-row') : null;
    var combId = combRow ? combRow.getAttribute('data-id') : null;

    var indexAttr = actionEl.getAttribute('data-index');
    var rowIndex = indexAttr !== null ? parseInt(indexAttr, 10) : null;

    switch (action) {
      case 'field-step': {
        var target = actionEl.getAttribute('data-target');
        var delta = parseFloat(actionEl.getAttribute('data-delta')) || 0;
        if (target) stepField(target, delta);
        break;
      }
      case 'edit-campaign-name': editCampaignName(); break;
      case 'advance-day-quick': advanceDayQuick(); break;
      case 'advance-day-with-note': advanceDayWithNote(); break;
      case 'set-current-date': setCurrentDate(); break;

      case 'open-calendar-structure': openCalendarStructureModal(); break;
      case 'close-calendar-structure': closeModal('#calendarStructureModalOverlay'); break;
      case 'save-calendar-structure': saveCalendarStructure(); break;
      case 'load-gregorian-preset': loadGregorianPresetIntoDraft(); break;
      case 'add-month-row': addMonthRow(); break;
      case 'remove-month-row': if (rowIndex !== null) removeMonthRow(rowIndex); break;
      case 'add-weekday-row': addWeekdayRow(); break;
      case 'remove-weekday-row': if (rowIndex !== null) removeWeekdayRow(rowIndex); break;

      case 'open-add-pc': openAddPCModal(); break;
      case 'close-pc-modal': closeModal('#pcModalOverlay'); break;
      case 'edit-pc': if (pcId) openEditPCModal(pcId); break;
      case 'delete-pc': if (pcId) deletePC(pcId); break;
      case 'exhaustion-minus': if (pcId) adjustExhaustion(pcId, -1); break;
      case 'exhaustion-plus': if (pcId) adjustExhaustion(pcId, 1); break;
      case 'resource-spend': if (pcId) { var spendKey = actionEl.getAttribute('data-key'); if (spendKey) spendResource(pcId, spendKey); } break;
      case 'resource-restore': if (pcId) { var restoreKey = actionEl.getAttribute('data-key'); if (restoreKey) restoreResource(pcId, restoreKey); } break;
      case 'hitdie-spend': if (pcId) spendHitDie(pcId); break;
      case 'hitdie-restore': if (pcId) restoreHitDie(pcId); break;
      case 'take-short-rest': takeShortRest(); break;
      case 'take-long-rest': takeLongRest(); break;
      case 'pc-hp-minus': if (pcId) adjustPCHP(pcId, -1); break;
      case 'pc-hp-plus': if (pcId) adjustPCHP(pcId, 1); break;
      case 'rest-all': restAll(); break;
      case 'feed-all-full': feedAll('full'); break;
      case 'feed-all-half': feedAll('half'); break;
      case 'ration-supply-minus': adjustRationSupply(-0.5); break;
      case 'ration-supply-plus': adjustRationSupply(0.5); break;

      case 'open-add-combatant': openAddCombatantModal(); break;
      case 'close-combatant-modal': closeModal('#combatantModalOverlay'); break;
      case 'load-party': loadParty(); break;
      case 'roll-all-unrolled': rollAllUnrolled(); break;
      case 'sort-now': sortNow(); break;
      case 'end-combat': endCombat(); break;
      case 'next-turn': nextTurn(); break;
      case 'prev-turn': prevTurn(); break;
      case 'roll-d20': if (combId) rollOne(combId); break;
      case 'remove-combatant': if (combId) removeCombatant(combId); break;
      case 'comb-hp-minus': if (combId) adjustCombatantHP(combId, -1); break;
      case 'comb-hp-plus': if (combId) adjustCombatantHP(combId, 1); break;

      case 'export-json': exportJSON(); break;
      case 'trigger-import': triggerImport(); break;
      case 'reset-campaign': resetCampaign(); break;
    }
  }

  function handleChange(e) {
    var action = e.target.getAttribute && e.target.getAttribute('data-action');
    if (!action) {
      if (e.target.id === 'importFile') handleImportFile(e);
      return;
    }
    var pcCard = e.target.closest ? e.target.closest('.pc-card') : null;
    var pcId = pcCard ? pcCard.getAttribute('data-id') : null;
    var combRow = e.target.closest ? e.target.closest('.combatant-row') : null;
    var combId = combRow ? combRow.getAttribute('data-id') : null;

    if (action === 'pc-hp-input' && pcId) setPCHP(pcId, e.target.value);
    if (action === 'comb-hp-input' && combId) setCombatantHP(combId, e.target.value);
    if (action === 'roll-input' && combId) setRoll(combId, e.target.value);
    if (action === 'meal-select' && pcId) setMealStatus(pcId, e.target.value);
    if (action === 'rested-check' && pcId) setRestedToday(pcId, e.target.checked);
    if (action === 'ration-supply-input') setRationSupply(e.target.value);
  }

  function handleSubmit(e) {
    if (e.target.id === 'pcForm') submitPCForm(e);
    if (e.target.id === 'combatantForm') submitCombatantForm(e);
  }

  function handleOverlayClick(e) {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
      e.target.hidden = true;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (!$('#pcModalOverlay').hidden) closeModal('#pcModalOverlay');
      if (!$('#combatantModalOverlay').hidden) closeModal('#combatantModalOverlay');
      if (!$('#calendarStructureModalOverlay').hidden) closeModal('#calendarStructureModalOverlay');
    }
  }

  function handleBrandKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      editCampaignName();
    }
  }

  // The native <details> "toggle" event does not bubble, so this listener
  // must be registered with capture:true to observe it via delegation.
  function handleDetailsToggle(e) {
    var details = e.target;
    if (!details.classList || !details.classList.contains('feature-menu')) return;
    var menuKey = details.getAttribute('data-menu-key');
    if (!menuKey) return;
    if (details.open) openFeatureMenus[menuKey] = true;
    else delete openFeatureMenus[menuKey];
  }

  // Floating menus behave like real dropdowns: clicking anywhere outside
  // one closes whatever is open, instead of leaving it hanging over
  // whatever content is underneath.
  function handleOutsideFeatureMenuClick(e) {
    var insideMenu = e.target.closest ? e.target.closest('.feature-menu') : null;
    if (insideMenu) return;
    var openMenus = $all('.feature-menu[open]');
    if (openMenus.length === 0) return;
    openMenus.forEach(function (d) {
      d.open = false;
      var key = d.getAttribute('data-menu-key');
      if (key) delete openFeatureMenus[key];
    });
  }

  /* ---------------------------------------------------------- */
  /* Init                                                         */
  /* ---------------------------------------------------------- */

  function init() {
    state = loadState();
    renderAll();

    document.addEventListener('click', handleClick);
    document.addEventListener('click', handleOverlayClick);
    document.addEventListener('click', handleOutsideFeatureMenuClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('toggle', handleDetailsToggle, true);

    var brand = $('.brand');
    if (brand) brand.addEventListener('keydown', handleBrandKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

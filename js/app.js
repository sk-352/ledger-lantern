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

  function defaultCalendarStructure() {
    return {
      months: GREGORIAN_MONTHS.map(function (m) { return { name: m.name, days: m.days }; }),
      weekdays: GREGORIAN_WEEKDAYS.slice()
    };
  }

  function defaultState() {
    var cal = defaultCalendarStructure();
    cal.current = { year: 1, monthIndex: 0, day: 1, weekdayIndex: 0 };
    return {
      campaignName: 'Ledger & Lantern',
      day: 1,
      log: [],
      pcs: [],
      combat: { round: 1, currentIndex: 0, combatants: [] },
      calendar: cal
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

    return { months: months, weekdays: weekdays, current: { year: year, monthIndex: monthIndex, day: day, weekdayIndex: weekdayIndex } };
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

  function normalizePC(p) {
    p = p || {};
    var a = p.abilities || {};
    var maxHp = numOr(p.hp && p.hp.max, 10);
    var meal = (p.mealStatus === 'half' || p.mealStatus === 'full') ? p.mealStatus : 'none';
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
      daysWithoutRest: Math.max(0, Math.round(numOr(p.daysWithoutRest, 0))),
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
      calendar: normalizeCalendar(parsed.calendar)
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
  function rollD20() { return Math.floor(Math.random() * 20) + 1; }
  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

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
        (pc.notes ? '<div class="pc-notes">' + escapeHTML(pc.notes) + '</div>' : '') +
      '</div>'
    );
  }

  function pcExhaustionBlockHTML(pc) {
    var streaks = '';
    if (pc.daysWithoutFood > 0) streaks += '<span class="stat-pill">🍽 ' + pc.daysWithoutFood + 'd without food</span>';
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
    $('#calendarSubline').textContent = w + ' · Year ' + cal.current.year;
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
      notes: $('#pcNotes').value.trim()
    };

    if (id) {
      var pc = findPC(id);
      if (pc) {
        pc.name = data.name; pc.abilities = data.abilities; pc.ac = data.ac;
        pc.initMod = data.initMod; pc.hp = data.hp; pc.notes = data.notes;
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

    if (meal === 'full') {
      pc.daysWithoutFood = 0;
    } else if (meal === 'half') {
      pc.daysWithoutFood = 0;
      var foodRoll = rollD20();
      var foodTotal = foodRoll + conMod;
      if (foodTotal < CON_SAVE_DC) {
        pc.exhaustion = clamp(pc.exhaustion + 1, 0, 6);
        lines.push(pc.name + ': skipped a full meal, failed the DC ' + CON_SAVE_DC + ' CON save (rolled ' + foodRoll + ' ' + fmtMod(conMod) + ' = ' + foodTotal + ') — Exhaustion ' + (pc.exhaustion - 1) + '→' + pc.exhaustion + '.');
      } else {
        lines.push(pc.name + ': skipped a full meal but passed the DC ' + CON_SAVE_DC + ' CON save (rolled ' + foodRoll + ' ' + fmtMod(conMod) + ' = ' + foodTotal + ').');
      }
    } else {
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

    if (wasRested && meal === 'full' && pc.exhaustion > 0) {
      var beforeRecover = pc.exhaustion;
      pc.exhaustion = clamp(pc.exhaustion - 1, 0, 6);
      lines.push(pc.name + ': rested well-fed — Exhaustion eased ' + beforeRecover + '→' + pc.exhaustion + '.');
    }

    pc.mealStatus = 'none';
    pc.restedToday = false;
    return lines;
  }

  function advanceDay(note) {
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

    cal.current = { year: year, monthIndex: monthIndex, day: day, weekdayIndex: weekdayIndex };
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
      case 'pc-hp-minus': if (pcId) adjustPCHP(pcId, -1); break;
      case 'pc-hp-plus': if (pcId) adjustPCHP(pcId, 1); break;
      case 'rest-all': restAll(); break;
      case 'feed-all-full': feedAll('full'); break;
      case 'feed-all-half': feedAll('half'); break;

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

  /* ---------------------------------------------------------- */
  /* Init                                                         */
  /* ---------------------------------------------------------- */

  function init() {
    state = loadState();
    renderAll();

    document.addEventListener('click', handleClick);
    document.addEventListener('click', handleOverlayClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', handleKeydown);

    var brand = $('.brand');
    if (brand) brand.addEventListener('keydown', handleBrandKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

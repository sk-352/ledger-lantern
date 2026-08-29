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

  /* ---------------------------------------------------------- */
  /* State                                                       */
  /* ---------------------------------------------------------- */

  var state = null;

  function defaultState() {
    return {
      campaignName: 'Ledger & Lantern',
      day: 1,
      log: [],
      pcs: [],
      combat: { round: 1, currentIndex: 0, combatants: [] }
    };
  }

  function normalizePC(p) {
    p = p || {};
    var a = p.abilities || {};
    var maxHp = numOr(p.hp && p.hp.max, 10);
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
      tired: !!p.tired,
      hungry: !!p.hungry,
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
      log: Array.isArray(parsed.log) ? parsed.log.filter(function (e) { return e && Number.isFinite(e.day); }) : [],
      pcs: Array.isArray(parsed.pcs) ? parsed.pcs.map(normalizePC) : [],
      combat: (parsed.combat && typeof parsed.combat === 'object') ? {
        round: Number.isFinite(parsed.combat.round) ? parsed.combat.round : 1,
        currentIndex: Number.isFinite(parsed.combat.currentIndex) ? parsed.combat.currentIndex : 0,
        combatants: Array.isArray(parsed.combat.combatants) ? parsed.combat.combatants.map(normalizeCombatant) : []
      } : d.combat
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
    $('#dayNumberHuge').textContent = state.day;
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
        '<div class="status-row">' +
          '<button class="ink-stamp stamp-tired' + (pc.tired ? ' active' : '') + '" data-action="toggle-tired" title="Toggle Tired">Tired</button>' +
          '<button class="ink-stamp stamp-hungry' + (pc.hungry ? ' active' : '') + '" data-action="toggle-hungry" title="Toggle Hungry">Hungry</button>' +
        '</div>' +
        (pc.notes ? '<div class="pc-notes">' + escapeHTML(pc.notes) + '</div>' : '') +
      '</div>'
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
    var log = $('#dayLog');
    if (state.log.length === 0) {
      log.innerHTML = '<div class="empty-state">No entries yet. Advance the day to begin the chronicle.</div>';
      return;
    }
    log.innerHTML = state.log.map(function (entry) {
      return (
        '<div class="day-log-entry">' +
          '<div class="day-log-day">Day ' + entry.day + '</div>' +
          '<div class="day-log-note">' + (entry.note ? escapeHTML(entry.note) : '<span class="hpmini-none">No notes recorded.</span>') + '</div>' +
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
      data.tired = false;
      data.hungry = false;
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

  function toggleTired(id) {
    var pc = findPC(id);
    if (!pc) return;
    pc.tired = !pc.tired;
    saveState();
    renderPartyTab();
  }

  function toggleHungry(id) {
    var pc = findPC(id);
    if (!pc) return;
    pc.hungry = !pc.hungry;
    saveState();
    renderPartyTab();
  }

  function restAll() {
    if (state.pcs.length === 0) return;
    state.pcs.forEach(function (p) { p.tired = false; });
    saveState();
    renderPartyTab();
  }

  function feedAll() {
    if (state.pcs.length === 0) return;
    state.pcs.forEach(function (p) { p.hungry = false; });
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

  function advanceDay(note) {
    var closingDay = state.day;
    state.log.unshift({ day: closingDay, note: (note || '').trim() });
    state.pcs.forEach(function (p) { p.tired = true; p.hungry = true; });
    state.day = closingDay + 1;
    saveState();
    renderHeader();
    renderPartyTab();
    renderCalendarTab();
  }

  function advanceDayQuick() {
    if (!confirm('Advance to Day ' + (state.day + 1) + '? Every character will become Tired and Hungry.')) return;
    advanceDay('');
  }

  function advanceDayWithNote() {
    var note = $('#dayNoteInput').value;
    advanceDay(note);
    $('#dayNoteInput').value = '';
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

    switch (action) {
      case 'edit-campaign-name': editCampaignName(); break;
      case 'advance-day-quick': advanceDayQuick(); break;
      case 'advance-day-with-note': advanceDayWithNote(); break;

      case 'open-add-pc': openAddPCModal(); break;
      case 'close-pc-modal': closeModal('#pcModalOverlay'); break;
      case 'edit-pc': if (pcId) openEditPCModal(pcId); break;
      case 'delete-pc': if (pcId) deletePC(pcId); break;
      case 'toggle-tired': if (pcId) toggleTired(pcId); break;
      case 'toggle-hungry': if (pcId) toggleHungry(pcId); break;
      case 'pc-hp-minus': if (pcId) adjustPCHP(pcId, -1); break;
      case 'pc-hp-plus': if (pcId) adjustPCHP(pcId, 1); break;
      case 'rest-all': restAll(); break;
      case 'feed-all': feedAll(); break;

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

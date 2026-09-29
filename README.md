# Ledger & Lantern — Game Master's Companion

A single, self-contained, offline tool for tabletop RPG Game Masters. It tracks
your party, runs initiative in combat, and keeps a day-by-day campaign
calendar — all in your browser, with no installation, no server, and no
internet connection required.

## Getting started

1. Unzip this folder anywhere on your computer.
2. Double-click **`index.html`**. It opens in your default browser.
3. That's it. There is nothing to install and nothing to configure.

The app works fully offline. It uses no external fonts, images, CDNs, or
tracking of any kind — everything it needs ships inside this folder.

**Recommended browsers:** a recent version of Chrome, Firefox, Edge, or
Safari. The app is plain HTML/CSS/JavaScript with no build step and no
third-party libraries, so it should also run fine in most other modern
browsers.

## What it does

### Party — Player Character manager
- Add characters with **STR, DEX, CON, WIS, INT, CHA**, **Armor Class**, an
  **Initiative Modifier**, and **HP** (current/max). Ability modifiers are
  calculated automatically next to each score.
- **Exhaustion** is tracked as a single leveled stat (0–6), following the 5e
  Exhaustion rules — the current level's effects (and every level below it)
  are shown right on the card, up to level 6, which is fatal. Adjust it
  manually any time with the −/+ stepper (for anything outside food and
  rest — extreme heat, certain spells, forced marches, and so on).
- Each character has two daily fields you set before advancing the day:
  **Ate today** (None / Half ration / Full ration) and **Rested today**.
  When the day ends, the app resolves them automatically: **half rations**
  only cost a DC 10 Constitution save (rolled for you, using the
  character's CON) once a character has been on half rations for **7 or
  more days in a row** (any full ration or skipped day resets that streak);
  skipping food entirely for 5 straight days adds +1 Exhaustion
  automatically (and again every day after); and missing a second straight
  day of rest risks the same DC 10 save. Every roll and result is written
  into that day's Chronicle entry, and small chips on the card track
  running streaks ("3d without food", "4d on half rations"). Exhaustion is
  eased by a **Long Rest** (see Rests below), not by the day ending.
- **Ration supply:** the party shares one pool of rations, shown as a
  stepper/input in the Party toolbar (starts at 10.0). When a day ends,
  each character draws from it — **1.0** for a full ration, **0.5** for a
  half ration, nothing if they didn't eat — so three characters on half
  rations use 1.5 in a day. Type a number or use the −/+ buttons (steps of
  0.5) to restock. The pool stops at 0; running out has no further effect
  yet — that's groundwork for future features.
- **Full Rations** / **Half Rations** set everyone's meal for today in one
  click (half rations is there for deliberately stretching low supplies),
  and **Mark Rested** flags everyone as rested with no other effects.
  These just set the day's intent — nothing is consumed until the day ends.
- Optionally give a character a **Class** (currently Wizard or Fighter — more
  can be added later) and a **Level** (1–20). This unlocks small dropdown
  menus on the card for that class's *daily-use* features — Wizard gets
  separate **Arcane Recovery** and **Spell Slots** menus; Fighter gets a
  **Second Wind** menu — each showing that feature's uses as clickable pip
  trackers, D&D Beyond/Roll20-style: click a filled pip to spend it, click
  a hollow one to give it back. These menus float above the card instead
  of pushing its content down, and close when you click elsewhere.
  Characters with no class selected show no menus at all, so martial-only
  tables stay uncluttered.
  *How they refill:* each resource recharges on the rest that matches it —
  Arcane Recovery and Second Wind on a **Short Rest**, Spell Slots on a
  **Long Rest** (see Rests below) — nothing refills just because the day
  ended. Spell Slots, Arcane Recovery, and Second Wind all cover the full
  1–20 range.
  Every class also shows a read-only **Proficiency** pill (the same
  progression for every class, by level: +2 at 1–4 up to +6 at 17–20) plus
  whichever level-scaled reference numbers that class defines but doesn't
  "spend" day to day — Wizard shows **Prepared** (Prepared Spells), Fighter
  shows **Weapon Mastery** — as plain text next to the class/level pill,
  not pips. The Arcane Recovery menu also includes a note on how many
  spell-slot levels it actually recovers at the character's level; *which*
  slots to give back isn't modeled — the feature is tracked as a single use
  that refills on a Short Rest.
- Quick HP adjustment with −/+ buttons or by typing a value directly.
- Edit or remove any character at any time. Optional free-text notes per
  character (background, quirks, whatever you like) — saved with the
  character, though not currently shown on the card itself.

  *Simplification:* Exhaustion only eases on a **Long Rest**, and only if
  the character ate a full ration that same day — even for Exhaustion that
  didn't come from hunger. This keeps recovery consistent without tracking
  which level came from which cause.

### Initiative — Battle order organizer
- **Load Party** pulls every character from the Party tab into the battle
  order in one click, carrying over their Initiative Modifier, AC, and HP.
- **+ Add Monster / NPC** for quick ad-hoc combatants that aren't full
  characters.
- For every combatant, just type in the result of your **d20 roll** (or hit
  the 🎲 button to roll one for them) — the app adds it to their Initiative
  Modifier automatically and shows the total.
- **Roll All Unrolled** rolls a d20 for everyone who hasn't rolled yet and
  sorts the order for you. **Sort by Initiative** re-sorts on demand.
- **Next Turn / Prev Turn** step through the order and track the round
  number. The active combatant is highlighted.
- Track HP loss during the fight with the same −/+ controls as the Party
  tab. This HP is a snapshot for the fight — it doesn't change your saved
  character sheet, so you can freely experiment in combat without touching
  the character's permanent record.
- **End Combat** clears the battle order (character sheets are untouched).

### Calendar — Day & clock tracker
- A full calendar date — day, month name, weekday, and year — front and
  center, alongside the original **Campaign Day** counter (both always stay
  in sync), plus a **clock** (hour of day, starts at 06:00 for a new
  campaign).
- It defaults to a standard **Gregorian calendar** (January–December,
  Sunday–Saturday) so it works out of the box with no setup.
- **⚙ Customize Months & Weekdays** opens an editor where you can rename
  months, change how many days each one has, add or remove months
  entirely, and do the same for the days of the week — build any fantasy
  calendar you like. **Load Gregorian Preset** resets the editor back to
  the default before you save. Note: this calendar does not add leap days —
  every year is the same length as defined in your month list.
- **Jump to a specific date** lets you correct or set the current date and
  hour directly, without clicking through "Advance Day" — handy when
  starting a campaign mid-year or fixing a mistake.
- **Advance Day** (in the header, for a quick skip, or in the Calendar tab
  with an optional note about what happened) moves the clock forward a
  full 24 hours and resolves that day's food and rest for every character
  (may trigger Exhaustion — see Rests below).
- Every day that ends is recorded in the **Chronicle**, a running log of
  your campaign's days, calendar dates, and notes, newest first — along
  with a report of any Exhaustion saves or automatic effects that happened
  that day.
- The clock is the one shared mechanism behind all time passing in the
  app: Short Rest, Long Rest, and Advance Day are really the same action
  (advance the clock by 1, 8, or 24 hours) — so a rest that happens to run
  past midnight resolves that day exactly once, same as clicking Advance
  Day would.

### Rests — Short Rest, Long Rest, and Hit Dice
- **⏳ Short Rest** (Party tab toolbar) advances the clock 1 hour and
  recharges every character's Short Rest features (currently: Wizard's
  Arcane Recovery, Fighter's Second Wind).
- **🌙 Long Rest** advances the clock 8 hours and, for every character with
  at least 1 HP: fully heals them, restores all spent Hit Dice, eases
  Exhaustion by 1 (only if they ate a full ration that day), marks them
  rested for the day, and recharges both Long and Short Rest features
  (Spell Slots included). The rest is credited to the day it *started* on:
  if it runs past midnight, the day that closes still counts that meal and
  that rest — and grants the Exhaustion relief — before the new day begins.
- Both are **party-wide** actions — everyone rests together. There's no
  per-character opt-out yet (e.g. someone standing watch through the
  night); that granularity, along with proper rest-interruption tracking,
  is planned but not built.
- **Hit Dice** get their own dropdown per class-having character (die type
  by class: Wizard d6, Fighter d10; count equals character level). Click a
  filled die any time to roll it + your Constitution modifier and heal
  (minimum 1) — not just right after a Short Rest, since this tool doesn't
  enforce turn-by-turn timing. Only a Long Rest restores spent Hit Dice.
- The old **🛌 Mark Rested (no effects)** button is still there for a
  lightweight manual flag with no mechanical benefits, if you'd rather
  skip the full Short/Long Rest machinery for a given day.
- *Simplifications, for now:* rest interruptions (rolling initiative,
  taking damage, casting a leveled spell) aren't detected automatically —
  narrate them at the table and just don't click the rest button if one
  happens. Ability score restoration isn't modeled (the app doesn't track
  reduced ability scores). Long Rest's 16-hour cooldown isn't enforced.

## Saving your campaign

Your campaign (characters, battle order, day, and chronicle) is saved
automatically to your browser's local storage on this device as you work —
look for the small "Saved" note in the footer. Closing the tab and reopening
`index.html` later picks up right where you left off, on that browser and
that computer.

Because that storage is local to one browser, use the footer's data tools to
move a campaign around or keep a backup:

- **Export** downloads your whole campaign as a `.json` file.
- **Import** loads a previously exported `.json` file (this replaces what's
  currently open, so export first if you want to keep both).
- **Reset Campaign** wipes everything and starts fresh — use with care, it
  cannot be undone.

If your browser ever blocks local storage entirely (uncommon, but some
strict privacy modes do this), the app still works normally for your current
session — just use Export before closing the tab so you don't lose your
progress.

## A couple of notes

- Ability score abbreviations follow the standard set: **STR, DEX, CON,
  WIS, INT, CHA**.
- Renaming your campaign: click the "Ledger & Lantern" title/lantern icon in
  the header.
- All the interface text is in English. If you'd like it in another
  language, the labels live in `index.html` and `js/app.js` and are plain
  text strings that can be translated directly.

## File structure

```
ledger-lantern/
├── index.html      # The app shell — open this file
├── css/
│   └── style.css   # All styling (no external fonts or frameworks)
├── js/
│   └── app.js       # All application logic (no external libraries)
└── README.md        # This file
```

No build tools, no `node_modules`, no package manager — just three files
your browser can open directly from disk.

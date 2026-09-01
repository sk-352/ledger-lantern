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
  When you advance the day, the app resolves both automatically per the
  malnutrition and lack-of-rest rules: a half ration risks a DC 10
  Constitution save (rolled for you, using the character's CON) or +1
  Exhaustion; skipping food entirely for 5 straight days adds +1 Exhaustion
  automatically (and again every day after); missing a second straight day
  of rest risks the same DC 10 save; and a day spent well-fed **and**
  rested eases Exhaustion down by 1. Every roll and result is written into
  that day's Chronicle entry, and small chips on the card track running
  streaks ("3d without food").
- **Rest Whole Party** marks everyone as rested today; **Full Rations** /
  **Half Rations** set everyone's meal for today in one click (half rations
  is there for deliberately stretching low supplies). These just set the
  day's intent — nothing happens until you advance the day.
- Quick HP adjustment with −/+ buttons or by typing a value directly.
- Edit or remove any character at any time. Optional free-text notes per
  character (class, background, quirks, whatever you like).

  *Simplification:* reducing Exhaustion always requires both a rest **and**
  a full ration that same day, even for Exhaustion that didn't come from
  hunger — this keeps recovery consistent without tracking which level
  came from which cause.

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

### Calendar — Day tracker
- A full calendar date — day, month name, weekday, and year — front and
  center, alongside the original **Campaign Day** counter (both always stay
  in sync).
- It defaults to a standard **Gregorian calendar** (January–December,
  Sunday–Saturday) so it works out of the box with no setup.
- **⚙ Customize Months & Weekdays** opens an editor where you can rename
  months, change how many days each one has, add or remove months
  entirely, and do the same for the days of the week — build any fantasy
  calendar you like. **Load Gregorian Preset** resets the editor back to
  the default before you save. Note: this calendar does not add leap days —
  every year is the same length as defined in your month list.
- **Jump to a specific date** lets you correct or set the current date
  (year / month / day / weekday) directly, without clicking through
  "Advance Day" — handy when starting a campaign mid-year or fixing a
  mistake.
- **Advance Day** (in the header, for a quick skip, or in the Calendar tab
  with an optional note about what happened) moves the calendar forward by
  one day **and marks every character Tired and Hungry** — exactly as
  requested: an effect that only goes away by your own input on the Party
  tab (or the Rest/Feed Whole Party buttons).
- Every day you advance is recorded in the **Chronicle**, a running log of
  your campaign's days, calendar dates, and notes, newest first.

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

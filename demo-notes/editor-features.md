# Editor Features Playground

Use this file to try out the new editor settings (Settings → Theme,
Keybindings, Keyboard Shortcuts, Fold Regions). Nothing here is graded —
just click around.

## Theme

Open **Settings** and switch between the four palettes (Ayu, Dracula,
Catppuccin, Custom) and the three modes (System, Light, Dark). Dracula is
dark-only, so its mode selector is disabled. Try the "Custom CSS" box too —
paste something like `--primary: oklch(0.7 0.2 30);` and watch the preview
update before you hit Apply.

## Keybindings

Switch **Settings → Keybinding mode** between Helix, Vim, and Normal while
this tab stays open, then try moving the cursor around this paragraph — the
document should stay intact across every switch.

## Outline search

Press the "Go to header" shortcut (default `Mod-o`) and fuzzy-search for
"nested" or "third" below to jump straight to it.

### First section

Some filler text so there's distance to scroll.

#### A nested subsection

More filler.

##### A deeply nested heading

Even more filler.

### Second section

### Third section, deliberately hard to spell: Thrid Sektion

## Shortcuts

Toggle checkbox (default `Mod-Enter`) only renders as a clickable box when
it's proper GFM task-list syntax — `- [ ]`/`- [x]` at the start of a list
item. A `[ ]` embedded mid-sentence stays plain text on purpose; the
keyboard shortcut still toggles it (it just looks for the nearest
`[ ]`/`[x]` on the line), but there's no checkbox widget to click.

- [ ] Put your cursor on this line and toggle it.
- [x] This one starts checked — toggle it back.
- Insert date (default `Mod-Shift-d`): place your cursor at the end of this
  line and trigger it →
- Insert date & time (default `Mod-Alt-d`): place your cursor at the end of
  this line and trigger it → 2026-07-20
- Insert fold region (default `Mod-Shift-r`): select the three lines below
  and trigger it to wrap them in a new fold region.

:::fold Example
  line one of the selection
  line two of the selection
  line three of the selection

:::endfold

## Fold regions

Custom `:::fold` / `:::endfold` markers (configurable in Settings → Fold
Regions). Click the chevron on a start bar to collapse it, or click the
collapsed pill to expand it again. Nesting works too.

:::fold Outer region
This is inside the outer region. It should get a left border once you're
looking at the expanded state.

:::fold Inner region
This is inside the nested inner region.
:::endfold

Back in the outer region, after the nested one closes.
:::endfold

Regular paragraph after the region, unaffected by folding.

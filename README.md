# JUJUTSU ROGUELITE

A top-down action roguelite inspired by *Jujutsu Kaisen*. Vanilla HTML + CSS + JavaScript + Canvas — no build step, no backend, no API keys, no external assets. Every sprite, effect and sound is generated in code.

Play: open `index.html` through any static web server (or GitHub Pages).

## Controls

| Action | Keyboard / Mouse | Touch |
| --- | --- | --- |
| Move | `WASD` / arrow keys | left virtual stick |
| Basic attack (3-hit combo) | `J` / left click | **ATK** |
| Dodge (i-frames, perfect-dodge window) | `Space` | **DGE** |
| Reinforcement / Black Flash timing | `Shift` | **REI** |
| Techniques | `1` `2` `3` `4` (`U` `I` `O` `P`) | **1**–**4** |
| Ultimate | `R` | **ULT** |
| Domain Expansion | `F` | **DOM** |
| Shikigami command | `C` | **SUM** |
| Boogie Woogie (upgrade) | `T` | — |
| Interact | `E` | tap prompt |
| Pause | `Esc` / `P` | **II** |
| Fullscreen | `F11`-style button in the corner | same button |

Black Flash: buy the **Black Sparks Scroll** (permanent, in the hub), then reinforce, attack, and press the reinforcement key again while the red timing ring is open. Yuji's window is wider. It is a timing mechanic, not a random crit.

## What is in the game

- **Hub (Jujutsu High)** — walkable campus, idle-animated NPCs (Gojo, Megumi, Nobara, Yaga, Todo, Kogane), three training dummies with a full live training-stats panel, sparring partners that fight with their real kits, Megumi's Ten Shadows taming rituals, a tribute shrine, and the animated cursed gate with a run-prep screen.
- **Five playable sorcerers** — Yuji, Megumi, Nobara, Gojo, Sukuna. Each has a 3-hit basic chain, four techniques, an ultimate, character-specific timing/costs and a distinct Domain (Gojo, Sukuna, Megumi).
- **Combat** — real hitboxes with startup/active/recovery frames, CE economy, reinforcement, dodge i-frames, perfect dodges, stagger, statuses (bleed/burn/slow/stun/root/mark), readable telegraphs, hitstop, screen shake and particles.
- **Ten Shadows** — all ten shikigami with their own movesets and AI, taming boss encounters, Divine Dogs Totality, Agito (50% meter, 120 s) and Mahoraga (100% meter, 60 s) with a persistent adaptation wheel (Exposure → Recognition → Partial → Advanced, saved between runs).
- **Domains** — Unlimited Void (stun + information overload), Malevolent Shrine (cleave field, sure-hit cutting), Chimera Shadow Garden (shadow floor + free summons), boss domains and domain clashes.
- **Roguelite runs** — seeded branching map, room types (fight/elite/boss/shop/event/rest/taming), Common→Legendary reward picks, ~55 upgrades including six real synergies (Black Flash→Technique, Reinforcement→Summon, Boogie Woogie→Follow-up, Shrine→Marked, Perfect Dodge→CE, Domain→Upgrade).
- **Story** — seven arcs (Fearsome Womb → Shinjuku Showdown) with bosses, dialogue and unlocks, plus the **Culling Games** (Kogane, points, Higuruma, Hakari, Kashimo, Ishigori, Uro).
- **Meta** — versioned localStorage save (`jjk_roguelite_save_v3`), permanent unlocks, tribute track, adaptation memory, local high-score table, pause menu with reset + confirmation, run summary that always returns to the hub (never auto-restarts).

## Dev tools

`tools/` holds the headless checks used while building (not shipped to players):

```bash
npm install --no-save jsdom          # only for smoke.mjs
node tools/smoke.mjs                 # boots the real game in jsdom, drives every scene
node tools/systems.mjs               # combat/progression unit tests (500 assertions)
node tools/kits.mjs                  # every ability of every character must do something
node tools/balance.mjs [arcIndex]    # scripted bot: DPS / damage taken per character
```

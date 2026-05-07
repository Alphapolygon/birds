# Project Avian RPG - Timing & Combo Prototype

This package contains the pivot from the tactical grid prototype into a Super Mario RPG-style timing/combo battle prototype.

## Run

```bash
npm install
npm run dev
```

## Controls

- Wait for a Bird Action Gauge to fill.
- Click a Pig badge to select the target.
- Choose **Attack**, **Charged Attack**, **Shield**, **Wait**, or **Duo Attack**.
- During the impact prompt, press **Space** or click/tap the battlefield.

## Implemented

- Static player and pig formation slots instead of grid movement.
- Continuous Action Gauge timeline.
- Native keyboard/canvas Action Command input bridge outside React state updates.
- ECS timing buffers: timing state, timing clock, command result, action gauge, speed, formation slot.
- Perfect Hit / Perfect Block timing windows.
- Charged attacks with recovery delay.
- Shield action that widens the next block timing window.
- Global Party Combo Meter and Duo Attack flow.
- Timing-focused relics: Greased Feathers, Hourglass Shard, Mirror Shield, Combo Battery, Cursed Weights.
- Golden Egg Thief Pig that flees after 3 gauge fills if not defeated.
- Boss rule corruptions: Hidden Prompts, Time Warp, Combo Drain.
- Single-atlas InstancedMesh sprite rendering with per-entity UV offset/scale buffers.
- Boot-time normalized atlas UVs in `src/game/spriteAtlas.ts`, including Y-axis flipping for 3D texture sampling.
- Idle/attack/hit/shield atlas frame switching from ECS animation state.
- Idle bounce for living units, attack lerp animation, hit/shield/VFX layers, dynamic camera zoom.

## Note

Some old tactical-grid helper files remain in the source tree for compatibility during the pivot, but the active battle loop is now the timing/combo ECS path.

# Bundled 3D assets

- `Soldier.glb` is the Soldier character model provided with the project uploads. The project also previously loaded the same Three.js example model remotely; this local copy keeps match and lobby character loading self-contained.
- The four East `weapons/*_East.glb` files are from the Flat Guns East pack: assault rifle, pump shotgun, compact SMG, and sniper rifle. The source pack documents the Flat Guns East models as CC0 and links the original OpenGameArt source. CC0 allows commercial use and redistribution without attribution.
  - Pack and license notes: https://github.com/petroulacl/fps-asset-kit
  - Original asset source: https://opengameart.org/content/cc0-flat-guns-east

- The four `weapons/*_West.glb` models are from Flat Guns West, also CC0, downloaded from the same asset-kit mirror at revision `a19b7458a593598211c95ec46ef4eb4b6d1f94d7`.
  - Original asset source: https://opengameart.org/content/cc0-flat-guns-west
  - Models, budgets and verification: [weapon variants](../../docs/weapons/variants.md).

## Reactor Facility map

Geometry and material textures from the [Godot TPS Demo](https://github.com/godotengine/tps-demo/tree/a82f15448e9b015440d3bbdf5e10801b260c4e9f), © 2018 Juan Linietsky and Fernando Miguel Calabró, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Converted, spatially partitioned, and modified with entry gates for Horizon. [Source and modifications](../maps/reactor/SOURCE.md) · [Full upstream notices](../maps/reactor/UPSTREAM-LICENSE.md).

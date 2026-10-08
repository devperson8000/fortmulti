# Reactor Facility

Actual structure, prop and reactor geometry from the [Godot TPS Demo](https://github.com/godotengine/tps-demo/tree/a82f15448e9b015440d3bbdf5e10801b260c4e9f), pinned to `a82f15448e9b015440d3bbdf5e10801b260c4e9f`.

Assets © 2018 Juan Linietsky and Fernando Miguel Calabró, licensed [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/). Full upstream notices are in [UPSTREAM-LICENSE.md](UPSTREAM-LICENSE.md). Modified for Horizon: material conversion and resized WebP textures, quantized geometry, spatial partitioning, outer-wall entry gates, and original exterior landing platforms and connecting walkways. No upstream music or game scripts are bundled.

The companion floor-layout image in `docs/maps/facility-top-down-layout.png` is a geometry projection of this source, not a verified navigation diagram. Runtime additions and gate locations can differ from that unmodified-source preview.

`import-reactor-assets.mjs` and `import-reactor-collision.mjs` in the repository's `scripts` directory reproduce the import from the pinned source. Source Y coordinates are translated by +8 metres, consistently for visuals and physics. The existing Ironwood map stays available separately; facility visuals load only when that map is selected.

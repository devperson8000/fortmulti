# Ironwood Island integration — 8 October 2026

User request: find and download a free map, integrate it into HORIZON. Selected theme: military island with forests and outposts.

Downloaded Terrain3D's MIT-licensed demo terrain from its official GitHub repository and Kenney's CC0 tree model/palette from the author's official City Builder repository. This is an adaptation of downloadable terrain and assets, not an unchanged ready-made military map. Exact revisions, terrain checksum, changes, authors and license notices are in `public/maps/ironwood/SOURCE.md`. Asset sites unavailable from this environment were not used.

Ironwood replaces the procedural town map as the default. It uses a 161² centimeter-quantized terrain field over 640 meters, smooth compound clearings, six military regions, 18 traversable barracks, container bays, radio masts, perimeter cover and connected roads. Existing building floors, doors and stairs remain traversable. Rendered triangles, player movement, building placement, loot and pod landing heights share exact triangle interpolation. Both maps use the actual terrain and road coordinates. The island adds a dry-ground landing requirement without changing other worlds' defaults.

The downloaded five-tree model was separated into five centered tree meshes. Every trunk has its own wood resource and destruction range. Runtime geometry is uploaded once; consecutive live resource spans are coalesced without allocating new geometry. Native browser fixture counted 1,060 total resource nodes, 36 chests and 402 solid parts. No large GLB or map texture fetch was added to gameplay; the original tree model and palette are retained as source assets.

## Verification

- `npm run check`: syntax, all **301 unit tests**, and production build passed. New coverage includes triangle interpolation, malformed terrain input, ocean/land minimap pixels, dry pod landing, compound landing corridors and chest clearance, individual trunk/harvest alignment, ordinary uphill movement, and merging resource draw spans while retaining destroyed/distant gaps.
- `scripts/browser-check.mjs`: real host/guest BroadcastChannel gameplay, inventory, hold-E chests, Ctrl/Shift controls, material/rotation costs and connected ramp climbing. Final results in `gameplay-final/browser-results.json`.
- `scripts/map-visual-check.mjs`: actual game renderer at five locations, no browser errors; a real mouse-held pickaxe harvest gave **40 wood**, reduced the targeted node to **0 HP**, and destroyed **one** tree. Before/after and terrain screenshots inspected.
- `scripts/deployment-cinematic-check.mjs`: **14 checks passed** on two real clients, preserving outside boarding/waiting views, sealed ejection/descent, music continuity, logo fade, impact, walkout, salute and camera return. An initial software-rendered run missed the network touchdown timing tolerance by 20.8ms; after resource-span coalescing, the complete run passed the unchanged timing assertions. Detailed timing remains in `deployment-final/deployment-browser-results.json` and `deployment-clock-diagnostics.json`.
- `scripts/lag-benchmark.mjs`, isolated 100 frames: software WebGL at 1280×720, internal 832×468, no MSAA; p50 **50ms**, p95 **66.7ms**, p99 **66.7ms**. The previous map's last comparable benchmark was 50/66.7/66.8ms. This is CPU-rendered Chromium, not evidence of real GPU frame rate or zero lag.
- Independent code review found and confirmed fixes for centered tree harvesting and the distinction between Kenney's MIT software license and CC0 asset notice.

Production assets are copied into tracked `dist` by the normal build. Asset presence and license notices are required by the build. Vercel and Supabase live deployment were not directly tested; local host/guest transport and production artifact packaging were tested.

## Reproducing the asset conversion

Requires Blender, Python with Pillow, and system libzstd. Run from the repository root:

```sh
curl --fail --location https://raw.githubusercontent.com/TokisanGames/Terrain3D/854a4575ef0f6db8f3e2c051d352181da75236a2/project/demo/data/terrain3d_00_00.res --output /tmp/ironwood-source.res
python scripts/map-assets/unpack-terrain.py /tmp/ironwood-source.res /tmp/ironwood-uncompressed.res
blender -b --python scripts/map-assets/bake-forest.py -- /tmp/ironwood-trees.json
python scripts/map-assets/bake-height.py /tmp/ironwood-uncompressed.res /tmp/ironwood-trees.json
npm run check
```

The unpacker verifies the original download's SHA-256 and compression/image layout before conversion. Blender removes the source ground tile, welds facet duplicates to identify the 15 tree components, and centers each of the five trees at its actual native root. The original terrain is vertically reduced and resampled, with smooth clearings and shoreline applied offline. Browser gameplay does not need Blender, Python, libzstd or the Terrain3D native plug-in.

Local artifacts: `/workspace/fortmulti-artifacts/map-integration/`.

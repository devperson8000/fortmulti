# Platform 23

Original map **Platform 23, Beta 13** by Jack “EmperorJack” Purvis for
[Unvanquished](https://unvanquished.net/).
Source: https://github.com/UnvanquishedAssets/map-plat23_src.dpkdir

Map geometry, original map source, custom forcefield/art textures, and adapted
map assets are distributed under **Creative Commons Attribution-ShareAlike 3.0**:
https://creativecommons.org/licenses/by-sa/3.0/
See [original map license](source/platform23-upstream-license.txt).

PK02 textures by Philip “Blazeeer” Klevestav (http://www.philipk.net/), with
modifications by Unvanquished Development, are distributed under **Creative
Commons Attribution 3.0**: https://creativecommons.org/licenses/by/3.0/
Source: https://github.com/UnvanquishedAssets/tex-pk02_src.dpkdir
See [original texture credits/license](source/platform23-texture-license.txt).
The original shader licensing headers are retained in `source/*.shader`.

Changes for Fortmulti: original convex brushes and quadratic Bezier patches
converted to indexed spatial mesh chunks; coordinates scaled at 32 source units
per metre, with source axes `(x,z,-y)` and `+56.75m` world Z translation; long
triangle edges split without changing surfaces or texture mapping; positions and
normals quantized; original diffuse and normal PNGs converted to full resolution
WebP; shader lighting/transparency approximated with Three.js materials; original
convex collision planes and patch triangles extracted. All-caulk courtyard ground tops at world Y=1.5m are exposed with the original
sand texture so walkable source floors remain visible beneath terrain details.
These recovered faces retain their exact original convex polygons. A low-detail,
textured ground apron connects the courtyards and approaches; four visible
perimeter panels provide matching physical boundaries. Rectangular Bezier control
grids are decoded in their original column order with outward triangle winding. Converted map assets remain CC BY-SA 3.0; PK02
texture conversions remain CC BY 3.0. These credits do not imply endorsement.

Pinned upstream revisions and source image SHA-256 checksums are recorded in
`source/revisions.json` and `source/image-provenance.json`. The unchanged original
map is retained as `source/plat23.map.gz`.

Rebuild from repository root using Python 3, NumPy and Pillow:

```sh
python scripts/import-platform23-assets.py
```

The converter downloads missing original PNGs into the external research cache
(`../fortmulti-artifacts/map-candidates` by default), verifies recorded SHA-256
checksums, and writes generated assets. Use `--texture-cache PATH` to select a
separate cache. Geometry/collision rebuilds always read the shipped original map;
there is no dependency on the research GLB or geometry JSON.

`collision-data.js` exposes `PLATFORM_COLLISION`. Brush AABBs are broad-phase
bounds only: a point is inside the actual convex solid when every outward plane
satisfies `dot(normal, point) <= distance`. Native brush support is explicit;
patches and the walkable soup retain actual source triangles. `blocksShots` is
false for player/full clip brushes and sky boundary brushes. `type: boundary`
marks native sky containment; exclude these from walkable support and aerial
entry checks. Runtime movement excludes invisible player/full clips and sky boundaries;
visible source solids and curved surfaces provide the collision. Triggers and all-nonsolid brushes are omitted from collision.

Adaptation: existing horizontal caulk support faces at playable ground
elevations are exposed with the source PK02 sand or metal floor texture. These
faces were invisible collision substrates in the source; rendering them prevents
operators, pods and loot from appearing suspended over the sky. Their exact
authored polygons and collision remain unchanged. Curved collision patches are
represented at runtime by thin triangle prisms, preserving their source shape.

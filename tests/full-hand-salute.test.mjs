import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  MatchCharacterRenderer,
  poseNativeSalute,
} from "../public/match-character-renderer.js";
const loader = new GLTFLoader().register(() => ({
    name: "Textures",
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  })),
  bytes = await readFile("public/models/Soldier.glb");
const r = Object.create(MatchCharacterRenderer.prototype);
Object.assign(r, {
  scene: new THREE.Scene(),
  firstPersonScene: new THREE.Scene(),
  clips: new Map(),
  instances: new Map(),
  weaponTemplates: new Map(),
  firstPersonInstances: new Map(),
});
r._loaded(
  await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  ),
);
function salute(yaw = 0) {
  r.update(
    [
      {
        id: "salute",
        p: [0, 0, 0],
        hp: 100,
        slot: 0,
        inventory: [null, null, null, null, null],
        air: "landed",
        grounded: true,
        allowPickaxe: false,
        yaw,
      },
    ],
    { dt: 1 / 60 },
  );
  const i = r.instances.get("salute");
  poseNativeSalute(i, 1);
  i.holder.updateMatrixWorld(true);
  return i;
}
test("full-hand salute shows the palm toward the front camera at every character heading", () => {
  for (const yaw of [0, 0.7, Math.PI, -1.2]) {
    const i = salute(yaw),
      hand = i.bones.get("mixamorigrighthand"),
      palm = new THREE.Vector3(-1, 0, 0).applyQuaternion(
        hand.getWorldQuaternion(new THREE.Quaternion()),
      ),
      front = new THREE.Vector3(0, 0, -1).applyQuaternion(
        i.holder.getWorldQuaternion(new THREE.Quaternion()),
      );
    assert.ok(
      palm.dot(front) > 0.95,
      "salute shows the armored back instead of the palm",
    );
  }
});
test("index, middle, ring and pinky stay straight and together instead of folding into a two-finger salute", () => {
  const i = salute(),
    hand = i.bones.get("mixamorigrighthand"),
    directions = [];
  for (const f of ["index", "middle", "ring", "pinky"]) {
    const distal =
      i.bones.get("mixamorigrighthand" + f + "3") ||
      i.bones.get("mixamorigrighthand" + f + "2");
    directions.push(
      new THREE.Vector3(0, 1, 0).applyQuaternion(
        distal.getWorldQuaternion(new THREE.Quaternion()),
      ),
    );
  }
  for (const d of directions)
    assert.ok(
      d.dot(directions[0]) > 0.98,
      "a salute finger is curled or splayed",
    );
});
test("salute raises the native fingertip to the temple without changing native bone attachment lengths", () => {
  const i = salute(),
    index = i.bones.get("mixamorigrighthandindex3"),
    head = i.bones.get("mixamorighead"),
    target = head.localToWorld(
      new THREE.Vector3(-5.12026438883, 17.57254662871, 11.4676807885),
    ),
    tip = index.localToWorld(
      new THREE.Vector3(-0.0972724658, 3.7575946381, -0.0024291103),
    );
  assert.ok(tip.distanceTo(target) < 0.012);
  for (const b of i.bones.values())
    assert.ok(b.quaternion.toArray().every(Number.isFinite));
});

test("glove edges meet across all four extended fingers and release cleanly into the next idle pose", () => {
  const i = salute(),
    hand = i.bones.get("mixamorigrighthand"),
    ranges = { index: [], middle: [], ring: [], pinky: [] },
    y = 16.2;
  i.model.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    m.skeleton.update();
    const ix = m.geometry.index,
      skin = m.geometry.attributes.skinIndex,
      weight = m.geometry.attributes.skinWeight;
    const kind = (k) => {
      let best = 0,
        name = "";
      for (let z = 0; z < 4; z++)
        if (weight.getComponent(k, z) > best) {
          best = weight.getComponent(k, z);
          name = m.skeleton.bones[skin.getComponent(k, z)].name.toLowerCase();
        }
      return ["index", "middle", "ring", "pinky"].find((f) =>
        name.includes("righthand" + f),
      );
    };
    for (let n = 0; n < ix.count; n += 3) {
      const ids = [ix.getX(n), ix.getX(n + 1), ix.getX(n + 2)],
        finger = kind(ids[0]);
      if (!finger || !ids.every((k) => kind(k) === finger)) continue;
      const points = ids.map((k) =>
        hand.worldToLocal(
          m
            .getVertexPosition(k, new THREE.Vector3())
            .applyMatrix4(m.matrixWorld),
        ),
      );
      for (let k = 0; k < 3; k++) {
        const a = points[k],
          b = points[(k + 1) % 3];
        if ((a.y - y) * (b.y - y) > 0 || Math.abs(a.y - b.y) < 1e-8) continue;
        const q = (y - a.y) / (b.y - a.y);
        ranges[finger].push(a.z + (b.z - a.z) * q);
      }
    }
  });
  const fingers = ["index", "middle", "ring", "pinky"];
  for (let n = 1; n < fingers.length; n++) {
    const gap =
      Math.min(...ranges[fingers[n - 1]]) - Math.max(...ranges[fingers[n]]);
    assert.ok(gap < 0.05 && gap > -0.15, `${fingers[n]} glove edge gap ${gap}`);
  }
  r.update(
    [
      {
        id: "salute",
        p: [0, 0, 0],
        hp: 100,
        slot: 0,
        inventory: [null, null, null, null, null],
        air: "landed",
        grounded: true,
        allowPickaxe: false,
        yaw: 0,
        saluteProgress: 0,
      },
    ],
    { dt: 1 / 60 },
  );
  for (const [bone, p] of i.saluteFingerOrigins)
    assert.ok(
      bone.position.distanceTo(p) < 5e-5,
      `salute adduction leaked ${bone.name}: ${bone.position.distanceTo(p)} from ${p.toArray()} to ${bone.position.toArray()}`,
    );
});

test("other players retain natural wrist roll and palm contact across every weapon and combat pose", async () => {
  const { WEAPON_FILES } = await import("../public/weapon-assets.js"),
    { WEAPON_PROFILES } = await import("../public/weapon-system.js");
  for (const [type, file] of Object.entries(WEAPON_FILES)) {
    const bytes = await readFile("public/models/weapons/" + file);
    r.weaponTemplates.set(
      type,
      (
        await loader.parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          "",
        )
      ).scene,
    );
    for (const mode of ["idle", "walking", "running", "ads", "reload"]) {
      const p = {
        deploymentState: "match_active",
        id: "peer",
        p: [0, 0, 0],
        hp: 100,
        slot: 1,
        inventory: [{ id: "test", type, ammo: 4 }, null, null, null, null],
        air: "landed",
        grounded: true,
        allowPickaxe: false,
        yaw: 0.7,
        pitch: mode === "ads" ? 0.15 : 0,
        aim: mode === "ads",
        sprinting: mode === "running",
        moveSpeed: mode === "running" ? 10 : mode === "walking" ? 3 : 0,
        animationState:
          mode === "running" ? "run" : mode === "walking" ? "walk" : "idle",
        reload:
          mode === "reload" ? WEAPON_PROFILES[type].reloadDuration * 0.7 : 0,
      };
      for (let n = 0; n < 45; n++) r.update([p], { dt: 1 / 60 });
      const i = r.instances.get("peer");
      assert.equal(i.weaponId, type);
      assert.equal(i.weaponMount.visible, true);
      for (const side of ["right", "left"]) {
        const hand = i.bones.get("mixamorig" + side + "hand"),
          fore = i.bones.get("mixamorig" + side + "forearm"),
          axis = hand
            .getWorldPosition(new THREE.Vector3())
            .sub(fore.getWorldPosition(new THREE.Vector3()))
            .normalize(),
          palm = new THREE.Vector3(1, 0, 0).applyQuaternion(
            hand.getWorldQuaternion(new THREE.Quaternion()),
          ),
          natural = new THREE.Vector3(1, 0, 0).applyQuaternion(
            fore
              .getWorldQuaternion(new THREE.Quaternion())
              .multiply(i.fingerRest.get(hand)),
          );
        const contact = hand
          .getWorldPosition(new THREE.Vector3())
          .add(
            new THREE.Vector3(
              0,
              0.09 * i.model.getWorldScale(new THREE.Vector3()).x,
              0,
            ).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())),
          );
        assert.ok(
          contact.distanceTo(i.weaponMount.userData.contacts[side]) < 0.004,
          `${type} ${mode} ${side} palm slipped`,
        );
        palm.addScaledVector(axis, -palm.dot(axis)).normalize();
        natural.addScaledVector(axis, -natural.dot(axis)).normalize();
        assert.ok(
          palm.dot(natural) > 0.96,
          `${type} ${mode} ${side} twists in the remote view`,
        );
      }
    }
  }
});

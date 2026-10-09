import test from "node:test";
import assert from "node:assert/strict";
import { lobbyTabState } from "../public/lobby-state.js";
import { nickname } from "../public/hcs-rules.js";
test("HCS is a distinct lobby tab without enabling outfit or character layout", () =>
  assert.deepEqual(lobbyTabState("hcs"), {
    activeTab: "hcs",
    characterPreview: false,
    profileOpen: false,
  }));
test("nickname gate rejects blank callsigns and normalizes visible names", () => {
  assert.throws(() => nickname(" "));
  assert.throws(() => nickname("A<script>"));
  assert.equal(nickname("  Field   Ranger "), "Field Ranger");
});

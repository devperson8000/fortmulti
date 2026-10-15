import test from "node:test";
import assert from "node:assert/strict";
const { sendSocketPacket } = await import("../server/hcs-transport.mjs").catch(
  () => ({}),
);
const socket = () => ({
  readyState: 1,
  bufferedAmount: 0,
  sent: [],
  closed: [],
  send(packet) {
    this.sent.push(packet);
  },
  close(...args) {
    this.closed.push(args);
  },
});
test("a briefly congested spectator drops stale snapshots, preserves control messages, and resumes with current state", () => {
  assert.equal(typeof sendSocketPacket, "function");
  const ws = socket();
  ws.bufferedAmount = 70000;
  assert.equal(sendSocketPacket(ws, "old snapshot", { snapshot: true }), false);
  assert.deepEqual(ws.sent, []);
  assert.deepEqual(ws.closed, []);
  sendSocketPacket(ws, { type: "match-cancelled", matchId: "final" });
  assert.deepEqual(JSON.parse(ws.sent[0]), {
    type: "match-cancelled",
    matchId: "final",
  });
  ws.bufferedAmount = 0;
  sendSocketPacket(
    ws,
    { type: "snapshot", state: { elapsed: 200 } },
    { snapshot: true },
  );
  assert.equal(JSON.parse(ws.sent[1]).state.elapsed, 200);
});
test("closed sockets and excessive backlog cannot accumulate more packets", () => {
  assert.equal(typeof sendSocketPacket, "function");
  const ws = socket();
  ws.readyState = 3;
  assert.equal(
    sendSocketPacket(ws, { type: "snapshot" }, { snapshot: true }),
    false,
  );
  assert.deepEqual(ws.sent, []);
  ws.readyState = 1;
  ws.bufferedAmount = 300000;
  assert.equal(
    sendSocketPacket(ws, { type: "snapshot" }, { snapshot: true }),
    false,
  );
  assert.equal(ws.closed[0][0], 1013);
  assert.deepEqual(ws.sent, []);
});
test("uncongested sockets receive the exact shared encoded packet without reserializing it", () => {
  assert.equal(typeof sendSocketPacket, "function");
  const ws = socket(),
    packet = JSON.stringify({
      type: "snapshot",
      state: { players: [{ id: "operator", p: [1, 2, 3] }] },
    });
  assert.equal(sendSocketPacket(ws, packet, { snapshot: true }), true);
  assert.equal(ws.sent[0], packet);
});

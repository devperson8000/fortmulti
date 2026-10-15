// Gameplay snapshots replace older state. Skip them during brief congestion
// while preserving reliable control messages and bounding stalled connections.
export function sendSocketPacket(ws, data, { snapshot = false } = {}) {
  if (ws.readyState !== 1) return false;
  if (ws.bufferedAmount > 262144) {
    ws.close(1013, "Connection is too slow");
    return false;
  }
  if (snapshot && ws.bufferedAmount > 65536) return false;
  ws.send(typeof data === "string" ? data : JSON.stringify(data));
  return true;
}

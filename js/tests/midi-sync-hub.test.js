const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const { createSyncHub } = require('../../server/syncHub');
const Protocol = require('../sync/protocol');

function waitForMessage(ws, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timed out waiting for WebSocket message'));
    }, timeoutMs);
    function onMessage(raw) {
      const result = Protocol.unpack(raw);
      if (!result.ok || !predicate(result.message)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(result.message);
    }
    ws.on('message', onMessage);
  });
}

function openClient(port, role) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/sync`);
  return new Promise((resolve, reject) => {
    ws.once('error', reject);
    ws.once('open', async () => {
      ws.send(JSON.stringify(Protocol.pack(Protocol.MSG.HELLO, {
        role,
        name: role === Protocol.ROLE.MASTER ? 'Test Master' : 'Test Phone'
      })));
      try {
        const welcome = await waitForMessage(
          ws,
          message => message.t === Protocol.MSG.WELCOME
        );
        resolve({ ws, welcome });
      } catch (error) {
        reject(error);
      }
    });
  });
}

(async () => {
  const httpServer = http.createServer();
  const hub = createSyncHub(httpServer, { heartbeatInterval: 500 });
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const port = httpServer.address().port;
  let master;
  let phoneA;
  let phoneB;
  try {
    master = await openClient(port, Protocol.ROLE.MASTER);
    phoneA = await openClient(port, Protocol.ROLE.SLAVE);
    phoneB = await openClient(port, Protocol.ROLE.SLAVE);
    const targetPeerId = phoneA.welcome.p.you.id;
    const scorePayload = {
      score: {
        parts: [{ id: 'part-piano', trackId: 'track-piano' }],
        tracks: [{ id: 'track-piano', notes: [{ startTick: 0 }] }]
      },
      activePartId: 'part-piano',
      scoreVersion: 1
    };

    master.ws.send(JSON.stringify(Protocol.pack(
      Protocol.MSG.MIDI_SCORE,
      scorePayload,
      { targetPeerId }
    )));
    const targeted = await waitForMessage(
      phoneA.ws,
      message => message.t === Protocol.MSG.MIDI_SCORE
    );
    assert.equal(targeted.p.activePartId, 'part-piano');

    const leaked = await waitForMessage(
      phoneB.ws,
      message => message.t === Protocol.MSG.MIDI_SCORE,
      350
    ).then(() => true).catch(() => false);
    assert.equal(leaked, false);

    phoneA.ws.send(JSON.stringify(Protocol.pack(
      Protocol.MSG.MIDI_SCORE_REQUEST,
      { partId: 'part-guitar' }
    )));
    const requestAtMaster = await waitForMessage(
      master.ws,
      message => message.t === Protocol.MSG.MIDI_SCORE_REQUEST
    );
    assert.equal(requestAtMaster.m.requesterId, targetPeerId);

    const musicXmlPayload = {
      score: {
        parts: [{ id: 'P2', name: 'Alto Sax', measures: [{ notes: [{ id: 'n1' }] }] }]
      },
      activePartId: 'P2',
      scoreVersion: 2
    };
    master.ws.send(JSON.stringify(Protocol.pack(
      Protocol.MSG.MUSICXML_SCORE,
      musicXmlPayload,
      { targetPeerId }
    )));
    const targetedMusicXml = await waitForMessage(
      phoneA.ws,
      message => message.t === Protocol.MSG.MUSICXML_SCORE
    );
    assert.equal(targetedMusicXml.p.activePartId, 'P2');
    const leakedMusicXml = await waitForMessage(
      phoneB.ws,
      message => message.t === Protocol.MSG.MUSICXML_SCORE,
      350
    ).then(() => true).catch(() => false);
    assert.equal(leakedMusicXml, false);

    phoneA.ws.send(JSON.stringify(Protocol.pack(
      Protocol.MSG.MUSICXML_SCORE_REQUEST,
      { partId: 'P3' }
    )));
    const xmlRequestAtMaster = await waitForMessage(
      master.ws,
      message => message.t === Protocol.MSG.MUSICXML_SCORE_REQUEST
    );
    assert.equal(xmlRequestAtMaster.m.requesterId, targetPeerId);
  } finally {
    [master?.ws, phoneA?.ws, phoneB?.ws].forEach(ws => {
      try { ws?.close(); } catch (_) {}
    });
    hub.close();
    await new Promise(resolve => httpServer.close(resolve));
  }
  console.log('MIDI sync hub tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

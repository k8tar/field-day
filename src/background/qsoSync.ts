import { ipcMain } from 'electron';
import dgram from 'dgram';

const PORT = 41234;
const BROADCAST_ADDR = '255.255.255.255';

const socket = dgram.createSocket('udp4');
socket.bind(PORT, () => {
  socket.setBroadcast(true);
});

const myQsoLog: any[] = [];
const peers: { address: string, port: number }[] = [];

function addPeer(address: string, port: number) {
  if (!peers.some(p => p.address === address && p.port === port) && address !== '127.0.0.1') {
    peers.push({ address, port });
  }
}

function broadcastQsoSync(qsoLog: any[]) {
  peers.forEach(peer => {
    const syncMsg = Buffer.from(JSON.stringify({ type: 'SYNC_QSO', qsos: qsoLog }));
    socket.send(syncMsg, 0, syncMsg.length, peer.port, peer.address);
  });
}

function mergeQsoLog(remoteQsos: any[]) {
  // Simple merge: add new QSOs not already present (by call+dateTime)
  remoteQsos.forEach(remoteQso => {
    if (!myQsoLog.some(localQso =>
      localQso.call === remoteQso.call &&
      localQso.dateTime === remoteQso.dateTime
    )) {
      myQsoLog.push(remoteQso);
    }
  });
}

// Broadcast presence every 5 seconds
setInterval(() => {
  const message = Buffer.from(JSON.stringify({ type: 'DISCOVER', host: 'my-host', port: PORT }));
  socket.send(message, 0, message.length, PORT, BROADCAST_ADDR);
}, 5000);

// Listen for discovery and sync messages
socket.on('message', (msg, rinfo) => {
  const data = JSON.parse(msg.toString());
  if (data.type === 'DISCOVER') {
    // Respond with ACK and your instance info
    const ack = Buffer.from(JSON.stringify({ type: 'ACK', host: 'my-host', port: PORT }));
    socket.send(ack, 0, ack.length, rinfo.port, rinfo.address);

    // Send your QSO log for sync
    const syncMsg = Buffer.from(JSON.stringify({ type: 'SYNC_QSO', qsos: myQsoLog }));
    socket.send(syncMsg, 0, syncMsg.length, rinfo.port, rinfo.address);
  } else if (data.type === 'ACK') {
    addPeer(rinfo.address, rinfo.port);
    // Optionally, request their QSO log
    const syncMsg = Buffer.from(JSON.stringify({ type: 'SYNC_QSO', qsos: myQsoLog }));
    socket.send(syncMsg, 0, syncMsg.length, rinfo.port, rinfo.address);
  } else if (data.type === 'SYNC_QSO') {
    mergeQsoLog(data.qsos);
    // Notify renderer of new data
    process.send?.({ type: 'QSO_UPDATE', qsos: myQsoLog });
  }
});

// IPC: Receive new QSO from renderer
ipcMain.on('log-qso', (event, qso) => {
  myQsoLog.push(qso);
  broadcastQsoSync([qso]);
});

// IPC: Renderer can request current QSO log
ipcMain.handle('get-qso-log', () => myQsoLog);

export {};
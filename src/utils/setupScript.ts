/**
 * Quick setup commands for Field Day Network Testing
 * 
 * Copy and paste these commands into the browser console to set up test stations
 */

// Setup commands for Port 8080 (PHONE 1)
const setupPort8080 = `
await networkService.setupTestStation('K8TAR', 'PHONE 1', 305);
await networkService.checkFileStorage();
`;

// Setup commands for Port 8081 (PHONE 2)  
const setupPort8081 = `
await networkService.setupTestStation('K8TAR', 'PHONE 2', 0);
await networkService.checkFileStorage();
`;

// Test network discovery
const testDiscovery = `
await networkService.testNetworkDiscovery();
`;

// Quick test connectivity between ports
const testConnectivity = `
const currentPort = parseInt(window.location.port || '8080');
const otherPort = currentPort === 8080 ? 8081 : 8080;
const station = await networkService.checkStationAt('localhost', otherPort);
if (station) {
} else {
}
`;

🎯 Field Day Network Setup Commands
====================================

1️⃣ Setup Port 8080 (PHONE 1):
${setupPort8080}

2️⃣ Setup Port 8081 (PHONE 2):
${setupPort8081}

3️⃣ Test Network Discovery:
${testDiscovery}

4️⃣ Quick Connectivity Test:
${testConnectivity}

📋 Instructions:
1. Open http://localhost:8080 and run command #1
2. Open http://localhost:8081 and run command #2  
3. In either instance, run command #3 or #4 to test discovery

� Manual Commands:
- await networkService.setupTestStation('CALLSIGN', 'DESIGNATOR', QSO_COUNT)
- await networkService.checkFileStorage()
- await debugFileStorage()
`);

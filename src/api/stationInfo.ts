// Simple API endpoint for station discovery using file-based storage
import { fileStorage } from '@/services/fileStorage';

export function setupStationInfoAPI() {
  // In development, we can intercept fetch requests to provide station info
  if (typeof window !== 'undefined') {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to handle our API endpoints
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = input.toString();
      
      // Handle station info requests
      if (url.includes('/api/station-info')) {
        return handleStationInfoRequest();
      }
      
      // For all other requests, use original fetch
      return originalFetch(input, init);
    };
  }
}

async function handleStationInfoRequest(): Promise<Response> {
  // Get actual stored values from file storage
  const stationConfig = await fileStorage.getStationConfig();
  const qsos = await fileStorage.getQsoData();
  const currentPort = window.location.port;
  
  // Debug logging to see what's actually stored
  console.log(`🏠 Station Info Request on port ${currentPort}:`);
  console.log(`   📡 Station config:`, stationConfig);
  
  const qsoCount = qsos.length;
  const score = calculateTotalScore(qsos);
  
  console.log(`   📊 QSO count: ${qsoCount}`);
  console.log(`   🎯 Score: ${score}`);
  
  const stationInfo = {
    callsign: stationConfig.callsign,
    designator: stationConfig.designator,
    qsoCount: qsoCount,
    score: score,
    software: 'K8TAR Field Day Logger',
    version: '1.0.0',
    timestamp: Date.now(),
    port: currentPort ? parseInt(currentPort) : undefined // Include port for debugging
  };
  
  console.log(`   ✅ Returning station info:`, stationInfo);
  
  return Promise.resolve(new Response(JSON.stringify(stationInfo), {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  }));
}

function calculateTotalScore(qsos: any[]): number {
  try {
    if (!Array.isArray(qsos)) {
      return 0;
    }
    
    const score = qsos.reduce((total: number, qso: any) => {
      if (!qso || typeof qso !== 'object') {
        return total;
      }
      
      // Calculate points based on mode (CW/Digital = 2 points, Phone = 1 point)
      const mode = qso.mode || qso.MODE || '';
      const points = (mode === 'CW' || mode === 'DIG' || mode === 'DIGITAL') ? 2 : 1;
      return total + points;
    }, 0);
    
    console.log(`   🏆 Calculated score: ${score} points from ${qsos.length} QSOs`);
    return score;
  } catch (error) {
    console.log(`   ❌ Error calculating score:`, error);
    return 0;
  }
}

// Debug method to check file storage contents (exposed globally)
async function debugFileStorage(): Promise<void> {
  console.log('\n🔍 === FILE STORAGE DEBUG ===');
  console.log(`🌐 Current URL: ${window.location.href}`);
  console.log(`📍 Current port: ${window.location.port || 'default'}`);
  
  // Check file storage
  try {
    const storageInfo = await fileStorage.getStorageInfo();
    console.log(`📊 Storage info:`, storageInfo);
    
    const stationConfig = await fileStorage.getStationConfig();
    console.log(`🏷️ Station config:`, stationConfig);
    
    const qsos = await fileStorage.getQsoData();
    console.log(`📋 QSOs: ${qsos.length} items`);
    if (qsos.length > 0) {
      console.log(`   📝 Sample QSO:`, qsos[0]);
    }
  } catch (error) {
    console.error('❌ Error checking file storage:', error);
  }
  
  // Test station info endpoint
  console.log('\n📡 Testing local station info...');
  try {
    const response = await fetch('/api/station-info');
    const data = await response.json();
    console.log('✅ Station info response:', data);
  } catch (err) {
    console.log('❌ Station info error:', err);
  }
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugFileStorage = debugFileStorage;
  (window as any).fileStorage = fileStorage; // Also expose file storage directly
}

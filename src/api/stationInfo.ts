
// Simple API endpoint for station discovery
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

function handleStationInfoRequest(): Promise<Response> {
  const stationInfo = {
    callsign: localStorage.getItem('stationCallsign') || 'K8TAR',
    designator: localStorage.getItem('stationDesignator') || '1A',
    qsoCount: getQsoCount(),
    score: getTotalScore(),
    software: 'K8TAR Field Day Logger',
    version: '1.0.0',
    timestamp: Date.now()
  };
  
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

function getQsoCount(): number {
  try {
    const qsos = JSON.parse(localStorage.getItem('qsos') || '[]');
    return qsos.length;
  } catch {
    return 0;
  }
}

function getTotalScore(): number {
  try {
    const qsos = JSON.parse(localStorage.getItem('qsos') || '[]');
    return qsos.reduce((total: number, qso: any) => {
      const points = (qso.mode === 'CW' || qso.mode === 'DIG') ? 2 : 1;
      return total + points;
    }, 0);
  } catch {
    return 0;
  }
}

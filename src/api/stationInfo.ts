// Simple API endpoint for station discovery using centralized station info service
import { StationInfoService } from '../services/stationInfoService';

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
  try {
    
    // Use the centralized StationInfoService
    const stationInfo = await StationInfoService.getStationInfo(true); // Include port for debugging
    
    
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
  } catch (error) {
    console.error('❌ Error in handleStationInfoRequest:', error);
    
    // Return fallback error response
    const errorInfo = {
      callsign: 'ERROR',
      designator: '1A',
      networkId: `MESH-error-${Date.now()}`,
      qsoCount: 0,
      score: 0,
      software: 'K8TAR Field Day Logger',
      version: '2.0.0',
      timestamp: Date.now(),
      online: false,
      error: 'Failed to get station info'
    };
    
    return Promise.resolve(new Response(JSON.stringify(errorInfo), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }));
  }
}

// Debug method to check station info service (exposed globally)
async function debugStationInfo(): Promise<void> {
  
  // Check station info service
  try {
    const { StationInfoService } = await import('../services/stationInfoService');
    
    const stationInfo = await StationInfoService.getStationInfo(true);
    
    const isValid = StationInfoService.validateStationInfo(stationInfo);
    
  } catch (error) {
    console.error('❌ Error checking station info service:', error);
  }
  
  // Test station info endpoint
  try {
    const response = await fetch('/api/station-info');
    const data = await response.json();
  } catch (err) {
  }
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugStationInfo = debugStationInfo;
}

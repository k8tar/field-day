
import { backendApi } from '@/services/backendApiService';
import { stationStatusService } from '@/services/stationStatusService';

class StationStatusTracker {
  private intervalId: number | null = null;
  private readonly REFRESH_INTERVAL = 5000; // 5 seconds for real-time updates
  private isRunning = false;

  /**
   * Start the background station status tracking
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 Station status tracker already running');
      return;
    }

    console.log('🚀 Starting station status tracker');
    this.isRunning = true;

    // Start the periodic refresh
    this.intervalId = window.setInterval(async () => {
      await this.updateStationStatuses();
    }, this.REFRESH_INTERVAL);

    // Run initial update
    this.updateStationStatuses();
  }

  /**
   * Stop the background station status tracking
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping station status tracker');
    this.isRunning = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if the tracker is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Update station statuses from backend
   */
  private async updateStationStatuses(): Promise<void> {
    // Only update if backend is connected
    if (!backendApi.connected.value) {
      return;
    }

    try {
      // Get current discovered stations from backend
      const stations = await backendApi.getDiscoveredStations();
      
      // Get IDs of stations seen in this discovery
      const seenStationIds = stations.map(s => s.id);
      
      // Update statuses for seen stations
      stations.forEach(station => {
        stationStatusService.updateStationSeen(station);
      });
      
      // Update request counts for missed stations
      stationStatusService.updateMissedStations(seenStationIds);
      
      // Clean up old offline stations periodically
      if (Math.random() < 0.1) { // 10% chance each update (roughly every 50 seconds)
        stationStatusService.cleanupOldStations();
      }

      // Log significant status changes
      const allStatuses = stationStatusService.getAllStationsWithStatus();
      const offlineStations = allStatuses.filter(s => s.status === 'offline');
      const warningStations = allStatuses.filter(s => s.status === 'warning');
      
      if (offlineStations.length > 0 || warningStations.length > 0) {
        console.log(`📊 Station status update: ${allStatuses.length} total, ${warningStations.length} warning, ${offlineStations.length} offline`);
      }

      // Dispatch a custom event so components can listen for status updates
      window.dispatchEvent(new CustomEvent('stationStatusUpdate', {
        detail: {
          total: allStatuses.length,
          online: allStatuses.filter(s => s.status === 'online').length,
          warning: warningStations.length,
          offline: offlineStations.length,
          stations: allStatuses
        }
      }));

    } catch (error) {
      // Only log errors occasionally to avoid spam
      if (Math.random() < 0.05) { // 5% chance
        console.error('⚠️ Station status update failed:', error);
      }
    }
  }
}

// Create singleton instance
export const stationStatusTracker = new StationStatusTracker();

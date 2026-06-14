import { describe, expect, it } from 'vitest';
import {
  setupPort8080,
  setupPort8081,
  testConnectivity,
  testDiscovery
} from '@/utils/setupScript';

describe('setupScript commands', () => {
  it('exports expected setup command strings for both stations', () => {
    expect(setupPort8080).toContain("setupTestStation('K8TAR', 'PHONE 1', 305)");
    expect(setupPort8080).toContain('checkFileStorage()');

    expect(setupPort8081).toContain("setupTestStation('K8TAR', 'PHONE 2', 0)");
    expect(setupPort8081).toContain('checkFileStorage()');
  });

  it('includes discovery and connectivity command snippets', () => {
    expect(testDiscovery).toContain('testNetworkDiscovery()');

    expect(testConnectivity).toContain("parseInt(window.location.port || '8080')");
    expect(testConnectivity).toContain('checkStationAt');
    expect(testConnectivity).toContain('Connected to station:');
    expect(testConnectivity).toContain('No station found at port');
  });
});

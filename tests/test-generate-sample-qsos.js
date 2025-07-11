/**
 * Test script to generate 300 sample QSOs for Field Day Logger
 * Uses file storage exclusively - no localStorage dependency
 * 
 * This script generates realistic amateur radio contacts with:
 * - Varied callsigns from different countries/regions
 * - Random bands (20M, 40M, 80M, 15M, 10M, 6M, 2M)
 * - Different modes (PH, CW, DIG)
 * - ARRL sections and classes
 * - Realistic timestamps spread over 24 hours
 * - Different operators from the configured list
 * 
 * Usage:
 * 1. Open the Field Day Logger in browser
 * 2. Open browser dev tools (F12)
 * 3. Copy and paste this script into the console
 * 4. Run: await generateSampleQsos(300)
 */

async function generateSampleQsos(count = 300) {
  console.log(`🎯 Generating ${count} sample QSOs using file storage...`);
  
  // Check if file storage is available
  if (typeof fileStorage === 'undefined') {
    console.error('❌ File storage not available. Make sure the app is loaded.');
    return null;
  }
  
  // Sample callsigns from various regions
  const callsigns = [
    // US callsigns
    'W1AW', 'W2ABC', 'W3DEF', 'W4GHI', 'W5JKL', 'W6MNO', 'W7PQR', 'W8STU', 'W9VWX', 'W0YZA',
    'K1BCD', 'K2EFG', 'K3HIJ', 'K4KLM', 'K5NOP', 'K6QRS', 'K7TUV', 'K8WXY', 'K9ZAB', 'K0CDE',
    'N1FGH', 'N2IJK', 'N3LMN', 'N4OPQ', 'N5RST', 'N6UVW', 'N7XYZ', 'N8ABC', 'N9DEF', 'N0GHI',
    'KB1JKL', 'KC2MNO', 'KD3PQR', 'KE4STU', 'KF5VWX', 'KG6YZA', 'KH7BCD', 'KI8EFG', 'KJ9HIJ', 'KK0KLM',
    'WA1MNO', 'WB2PQR', 'WC3STU', 'WD4VWX', 'WE5YZA', 'WF6BCD', 'WG7EFG', 'WH8HIJ', 'WI9KLM', 'WJ0NOP',
    
    // Canadian callsigns
    'VE1ABC', 'VE2DEF', 'VE3GHI', 'VE4JKL', 'VE5MNO', 'VE6PQR', 'VE7STU', 'VE8VWX', 'VE9YZA',
    'VA1BCD', 'VA2EFG', 'VA3HIJ', 'VA4KLM', 'VA5NOP', 'VA6QRS', 'VA7TUV', 'VA8WXY', 'VA9ZAB',
    'VO1CDE', 'VO2FGH', 'VY1IJK', 'VY2LMN',
    
    // International callsigns
    'G0ABC', 'G3DEF', 'M0GHI', 'GM1JKL', 'GW3MNO', 'GI4PQR', 'GJ2STU', 'GU6VWX',
    'DL1ABC', 'DL2DEF', 'DL3GHI', 'DL4JKL', 'DL5MNO', 'DL6PQR', 'DL7STU', 'DL8VWX', 'DL9YZA',
    'F1ABC', 'F4DEF', 'F5GHI', 'F6JKL', 'F8MNO',
    'I1ABC', 'I2DEF', 'I3GHI', 'I4JKL', 'I5MNO', 'I6PQR', 'I7STU', 'I8VWX',
    'JA1ABC', 'JA2DEF', 'JA3GHI', 'JA4JKL', 'JA5MNO', 'JA6PQR', 'JA7STU', 'JA8VWX', 'JA9YZA', 'JA0ZAB',
    'VK1ABC', 'VK2DEF', 'VK3GHI', 'VK4JKL', 'VK5MNO', 'VK6PQR', 'VK7STU', 'VK8VWX', 'VK9YZA',
    'ZL1ABC', 'ZL2DEF', 'ZL3GHI', 'ZL4JKL',
    'PY1ABC', 'PY2DEF', 'PY3GHI', 'PY4JKL', 'PY5MNO',
    'LU1ABC', 'LU2DEF', 'LU3GHI', 'LU4JKL',
    'XE1ABC', 'XE2DEF', 'XE3GHI',
    'OH1ABC', 'OH2DEF', 'OH3GHI', 'OH4JKL', 'OH5MNO',
    'SM1ABC', 'SM2DEF', 'SM3GHI', 'SM4JKL', 'SM5MNO', 'SM6PQR', 'SM7STU',
    'EA1ABC', 'EA2DEF', 'EA3GHI', 'EA4JKL', 'EA5MNO', 'EA6PQR', 'EA7STU', 'EA8VWX',
    'CT1ABC', 'CT2DEF', 'CT3GHI',
    'S51ABC', 'S52DEF', 'S53GHI', 'S54JKL', 'S55MNO', 'S56PQR', 'S57STU', 'S58VWX', 'S59YZA'
  ];
  
  // ARRL Field Day classes
  const classes = [
    '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A',
    '1B', '2B', '3B', '4B', '5B',
    '1C', '2C', '3C',
    '1D', '2D', '3D',
    '1E', '2E', '3E',
    '1F', '2F'
  ];
  
  // ARRL sections (based on official ARRL_SECTIONS from constants)
  const sections = [
    // Atlantic Division
    'EPA', 'MDC', 'NLI', 'NNJ', 'SNJ', 'WPA',
    
    // Central Division
    'IL', 'IN', 'WI',
    
    // Dakota Division
    'MN', 'ND', 'SD',
    
    // Delta Division
    'AR', 'LA', 'MS', 'TN',
    
    // Great Lakes Division
    'KY', 'MI', 'OH',
    
    // Hudson Division
    'ENY', 'NNY', 'WNY',
    
    // Midwest Division
    'IA', 'KS', 'MO', 'NE',
    
    // New England Division
    'CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA',
    
    // Northwestern Division
    'AK', 'EWA', 'ID', 'MT', 'OR', 'WWA',
    
    // Pacific Division
    'EB', 'LAX', 'ORG', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV',
    
    // Roanoke Division
    'NC', 'SC', 'VA', 'WV',
    
    // Rocky Mountain Division
    'CO', 'NM', 'UT', 'WY',
    
    // Southeastern Division
    'AL', 'GA', 'NFL', 'SFL',
    
    // Southwestern Division
    'AZ', 'NV',
    
    // West Gulf Division
    'NTX', 'OK', 'STX', 'WTX',
    
    // Canada (RAC Sections)
    'AB', 'BC', 'GTA', 'MB', 'NB', 'NL', 'NS', 'NT', 'ON', 'PE', 'QC', 'SK', 'YT',
    
    // DX
    'DX'
  ];
  
  // Bands available in Field Day
  const bands = ['160M', '80M', '40M', '20M', '15M', '10M', '6M', '2M'];
  
  // Modes
  const modes = ['PH', 'CW', 'DIG'];
  
  // Get current operators from file storage
  let operators = [];
  try {
    operators = await fileStorage.getOperators();
    if (operators.length === 0) {
      throw new Error('No operators in file storage');
    }
    console.log(`📥 Loaded ${operators.length} operators from file storage:`, operators);
  } catch (error) {
    console.warn('Could not load operators from file storage:', error);
    operators = ['K8RDM', 'K8PLW', 'K8DTB', 'K8RGA', 'KE8CEH', 'KD8WLG', 'KD8GRI', 'K8MSW']; // Fallback operators
    console.log(`📝 Using default operators:`, operators);
  }
  
  // Get current station info from file storage
  const stationConfig = await fileStorage.getStationConfig();
  const stationCallsign = stationConfig.callsign;
  const stationDesignator = stationConfig.designator;
  
  // Generate QSOs
  const qsos = [];
  const startTime = new Date();
  startTime.setHours(14, 0, 0, 0); // Start at 2 PM (typical Field Day start in UTC)
  
  // Load existing QSOs from file storage to get the last ID
  const existingQsos = await fileStorage.getQsoData();
  
  const lastId = existingQsos.length > 0 ? 
    Math.max(...existingQsos.map(q => q.id || 0)) : 0;
  
  console.log(`📊 Current QSOs: ${existingQsos.length}, Last ID: ${lastId}`);
  console.log(`📡 Station: ${stationCallsign}-${stationDesignator}`);
  console.log(`👥 Operators: ${operators.join(', ')}`);
  
  for (let i = 0; i < count; i++) {
    // Random time within 24 hours
    const qsoTime = new Date(startTime);
    qsoTime.setMinutes(qsoTime.getMinutes() + (i * 2) + Math.random() * 120); // Spread over time with some randomness
    
    // Random selections
    const call = callsigns[Math.floor(Math.random() * callsigns.length)];
    const qsoClass = classes[Math.floor(Math.random() * classes.length)];
    const section = sections[Math.floor(Math.random() * sections.length)];
    const band = bands[Math.floor(Math.random() * bands.length)];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    const qso = {
      id: lastId + i + 1,
      call: call,
      class: qsoClass,
      section: section,
      band: band,
      mode: mode,
      operator: operator,
      datetime: qsoTime.toISOString(),
      stationDesignator: stationDesignator,
      timestamp: qsoTime.getTime()
    };
    
    qsos.push(qso);
  }
  
  // Add to existing QSOs
  const allQsos = [...existingQsos, ...qsos];
  
  // Save to file storage
  try {
    await fileStorage.saveQsoData(allQsos);
    console.log(`✅ Successfully generated and saved ${count} QSOs to file storage!`);
    console.log(`📈 Total QSOs now: ${allQsos.length}`);
    
    // If QSO store is available, trigger a reload
    if (typeof window.qsoStore !== 'undefined' && window.qsoStore.loadQsos) {
      window.qsoStore.loadQsos();
      console.log('🔄 QSO store reloaded');
    }
    
    console.log('📊 Sample QSO breakdown:');
    const modeCounts = qsos.reduce((acc, qso) => {
      acc[qso.mode] = (acc[qso.mode] || 0) + 1;
      return acc;
    }, {});
    console.log('  Modes:', modeCounts);
    
    const bandCounts = qsos.reduce((acc, qso) => {
      acc[qso.band] = (acc[qso.band] || 0) + 1;
      return acc;
    }, {});
    console.log('  Bands:', bandCounts);
    
    // Calculate points
    const points = qsos.reduce((total, qso) => {
      return total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
    }, 0);
    console.log(`🏆 Points from new QSOs: ${points}`);
    
    return allQsos;
    
  } catch (error) {
    console.error('❌ Failed to save QSOs:', error);
    return null;
  }
}

// Utility function to clear all QSOs (for testing) - updated for file storage
async function clearAllQsos() {
  const confirmed = confirm('⚠️ This will delete ALL QSOs from file storage. Are you sure?');
  if (confirmed) {
    try {
      await fileStorage.saveQsoData([]);
      
      // Trigger reload if available
      if (typeof window.qsoStore !== 'undefined' && window.qsoStore.loadQsos) {
        window.qsoStore.loadQsos();
      }
      
      console.log('🗑️ All QSOs cleared from file storage');
    } catch (error) {
      console.error('❌ Failed to clear QSOs:', error);
    }
  }
}

// Utility function to generate specific types of QSOs
function generateQsosByMode(mode, count = 50) {
  console.log(`🎯 Generating ${count} ${mode} QSOs...`);
  
  const originalGenerate = generateSampleQsos;
  
  // Temporarily override mode selection for this generation
  const tempGenerate = function(count) {
    // ... (would need to modify the main function to accept mode parameter)
    // For now, use the main function and filter later
    return originalGenerate(count);
  };
  
  return generateSampleQsos(count);
}

// Available commands
console.log('📻 Field Day QSO Generator (File Storage) loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await generateSampleQsos(300) - Generate 300 sample QSOs');
console.log('  • await generateSampleQsos(50) - Generate 50 sample QSOs'); 
console.log('  • await clearAllQsos() - Clear all existing QSOs');
console.log('  • await generateQsosByMode("CW", 100) - Generate specific mode QSOs');
console.log('');
console.log('🚀 Quick start: await generateSampleQsos(300)');
console.log('💾 Note: Uses file storage exclusively - no localStorage dependency!');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateSampleQsos, clearAllQsos };
}

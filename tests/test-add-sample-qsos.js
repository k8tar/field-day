// Test script to generate and add random QSOs via the server API
console.log('🧪 Generating random QSOs via server API...');

// Configuration - change this number to generate more/fewer QSOs
const NUM_QSOS_TO_GENERATE = 50; // Change this to any number you want

// ARRL sections for realistic generation
const arrlSections = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DX' // For international stations
];

const classes = ['1A', '1B', '1C', '1D', '1E', '1F', '2A', '2B', '2C', '2D', '2E', '2F', '3A', '3B', '3C', '3D', '3E', '3F'];
const modes = ['PH', 'CW', 'DIG'];
const bands = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'];
const operators = ['K8TAR', 'W8ABC', 'N8XYZ', 'KB8DEF'];

// Store callsign -> {class, section} mapping to ensure consistency
const callsignDatabase = new Map();

// Generate a random callsign
function generateCallsign() {
  const prefixes = ['W', 'K', 'N', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'KA', 'KB', 'KC', 'KD', 'KE', 'KF', 'KG', 'KH', 'KI', 'KJ', 'KK', 'KL', 'KM', 'KN', 'KO', 'KP', 'KQ', 'KR', 'KS', 'KT', 'KU', 'KV', 'KW', 'KX', 'KY', 'KZ', 'WA', 'WB', 'WC', 'WD', 'WE', 'WF', 'WG', 'WH', 'WI', 'WJ', 'WK', 'WL', 'WM', 'WN', 'WO', 'WP', 'WQ', 'WR', 'WS', 'WT', 'WU', 'WV', 'WW', 'WX', 'WY', 'WZ'];
  const districts = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const suffixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  
  // Generate different callsign formats
  const format = Math.random();
  
  if (format < 0.3) {
    // W8ABC format
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)].charAt(0);
    const district = districts[Math.floor(Math.random() * districts.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + district + suffix;
  } else if (format < 0.6) {
    // AA8ABC format
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const district = districts[Math.floor(Math.random() * districts.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + district + suffix;
  } else if (format < 0.8) {
    // W8AB format (shorter)
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)].charAt(0);
    const district = districts[Math.floor(Math.random() * districts.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + district + suffix;
  } else {
    // International callsigns (VE, JA, etc.)
    const intlPrefixes = ['VE1', 'VE2', 'VE3', 'VE4', 'VE5', 'VE6', 'VE7', 'VE8', 'VE9', 'VK2', 'VK3', 'VK4', 'JA1', 'JA2', 'JA3', 'JA6', 'JA7', 'JH1', 'JH2', 'G3', 'G0', 'M0', 'DL1', 'DL2', 'DL3', 'F1', 'F5', 'F6', 'EA1', 'EA3', 'EA7', 'CT1', 'CT2', 'CT3'];
    const prefix = intlPrefixes[Math.floor(Math.random() * intlPrefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)] + 
                   suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + suffix;
  }
}

// Get or generate class and section for a callsign
function getCallsignInfo(callsign) {
  if (callsignDatabase.has(callsign)) {
    return callsignDatabase.get(callsign);
  }
  
  // Generate new info for this callsign
  const info = {
    class: classes[Math.floor(Math.random() * classes.length)],
    section: arrlSections[Math.floor(Math.random() * arrlSections.length)]
  };
  
  callsignDatabase.set(callsign, info);
  return info;
}

// Generate a random datetime within the last 24 hours
function generateRandomDatetime() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const randomTime = oneDayAgo + Math.random() * (24 * 60 * 60 * 1000);
  return new Date(randomTime).toISOString();
}

// Generate the specified number of QSOs
function generateQsos(count) {
  const qsos = [];
  const baseTimestamp = Date.now();
  
  for (let i = 0; i < count; i++) {
    const callsign = generateCallsign();
    const callsignInfo = getCallsignInfo(callsign);
    
    const qso = {
      id: baseTimestamp + i,
      call: callsign,
      class: callsignInfo.class,
      section: callsignInfo.section,
      datetime: generateRandomDatetime(),
      band: bands[Math.floor(Math.random() * bands.length)],
      mode: modes[Math.floor(Math.random() * modes.length)],
      operator: operators[Math.floor(Math.random() * operators.length)],
      stationDesignator: 'PHONE 1',
      timestamp: baseTimestamp + i
    };
    
    qsos.push(qso);
  }
  
  // Sort by datetime for more realistic order
  qsos.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  
  return qsos;
}

// Add QSOs one by one via the server API
async function addSampleQsos() {
  console.log(`📤 Generating ${NUM_QSOS_TO_GENERATE} random QSOs...`);
  
  const sampleQsos = generateQsos(NUM_QSOS_TO_GENERATE);
  
  console.log(`📊 Generated QSOs with ${callsignDatabase.size} unique callsigns`);
  console.log('📤 Adding QSOs to server...');
  
  let addedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < sampleQsos.length; i++) {
    const qso = sampleQsos[i];
    
    try {
      const response = await fetch('/api/qsos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add',
          qso: qso,
          stationId: 'test-station',
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        addedCount++;
        if (i % 10 === 0 || i === sampleQsos.length - 1) {
          console.log(`✅ Added ${addedCount}/${sampleQsos.length} QSOs (${qso.call} - ${qso.class} ${qso.section})`);
        }
      } else {
        console.error(`❌ Failed to add QSO ${qso.call}: ${response.status}`);
        errorCount++;
      }
      
      // Wait a bit between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.error(`❌ Error adding QSO ${qso.call}:`, error);
      errorCount++;
    }
  }
  
  console.log('🏁 Finished adding sample QSOs');
  console.log(`📊 Results: ${addedCount} added, ${errorCount} errors`);
  console.log(`📊 Unique callsigns: ${callsignDatabase.size}`);
  console.log('🔄 QSOs should now appear in the Recent Contacts list');
  console.log('📊 Check the station info to see updated QSO count and score');
  
  // Show some stats about what was generated
  const modeStats = {};
  const bandStats = {};
  sampleQsos.forEach(qso => {
    modeStats[qso.mode] = (modeStats[qso.mode] || 0) + 1;
    bandStats[qso.band] = (bandStats[qso.band] || 0) + 1;
  });
  
  console.log('📈 Mode distribution:', modeStats);
  console.log('📈 Band distribution:', bandStats);
}

// Run the function
addSampleQsos();

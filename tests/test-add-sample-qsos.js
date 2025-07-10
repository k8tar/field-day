// Test script to add sample QSOs to browser localStorage for testing manual upload
console.log('Adding sample QSOs to localStorage for testing...');

const sampleQsos = [
  {
    id: 1,
    call: 'W8ABC',
    class: '2A',
    section: 'OH',
    datetime: '2024-07-10 14:30:00',
    band: '20m',
    mode: 'PH',
    operator: 'K8TAR',
    stationDesignator: '1A',
    timestamp: new Date('2024-07-10 14:30:00').getTime()
  },
  {
    id: 2,
    call: 'K9XYZ',
    class: '1B',
    section: 'MI',
    datetime: '2024-07-10 14:35:00',
    band: '40m',
    mode: 'CW',
    operator: 'K8TAR',
    stationDesignator: '1A',
    timestamp: new Date('2024-07-10 14:35:00').getTime()
  },
  {
    id: 3,
    call: 'N0DEF',
    class: '3A',
    section: 'WI',
    datetime: '2024-07-10 14:40:00',
    band: '15m',
    mode: 'PH',
    operator: 'K8TAR',
    stationDesignator: '1A',
    timestamp: new Date('2024-07-10 14:40:00').getTime()
  }
];

localStorage.setItem('qsos', JSON.stringify(sampleQsos));
localStorage.removeItem('qsos_uploaded_to_server'); // Remove upload flag so manual upload will work

console.log(`Added ${sampleQsos.length} sample QSOs to localStorage`);
console.log('You can now test the manual upload feature in the Network modal');

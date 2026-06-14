<template>
  <div v-if="isOpen" class="stats-modal" @click.self="closeModal">
    <div class="stats-modal-content">
      <div class="modal-header">
        <h2>QSO Statistics</h2>
        <button class="close-button" @click="closeModal">
          <span class="material-icons">close</span>
        </button>
      </div>
      
      <div class="modal-body">
        <!-- Summary Cards -->
        <div class="stats-summary">
          <div class="stat-card">
            <div class="stat-value">{{ totalQsos }}</div>
            <div class="stat-label">Total QSOs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ totalSections }}</div>
            <div class="stat-label">Sections Worked</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ qsosPerHour.toFixed(1) }}</div>
            <div class="stat-label">QSOs/Hour</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ totalScore.toLocaleString() }}</div>
            <div class="stat-label">Total Score</div>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
          <!-- QSOs over Time Chart -->
          <div class="chart-container">
            <h3>QSOs Over Time</h3>
            <div class="chart-wrapper">
              <canvas ref="qsoTimeChart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Band Distribution Chart -->
          <div class="chart-container">
            <h3>Band Distribution</h3>
            <div class="chart-wrapper">
              <canvas ref="bandChart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Mode Distribution Chart -->
          <div class="chart-container">
            <h3>Mode Distribution</h3>
            <div class="chart-wrapper">
              <canvas ref="modeChart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Operator Performance Chart -->
          <div class="chart-container">
            <h3>Operator Performance</h3>
            <div class="chart-wrapper">
              <canvas ref="operatorChart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Hourly Activity Chart -->
          <div class="chart-container">
            <h3>Hourly Activity</h3>
            <div class="chart-wrapper">
              <canvas ref="hourlyChart" width="400" height="200"></canvas>
            </div>
          </div>

          <!-- Station Activity Chart -->
          <div class="chart-container">
            <h3>Station Activity</h3>
            <div class="chart-wrapper">
              <canvas ref="stationChart" width="400" height="200"></canvas>
            </div>
          </div>
        </div>

        <!-- Detailed Tables -->
        <div class="stats-tables">
          <!-- Top Operators Table -->
          <div class="table-container">
            <h3>Top Operators</h3>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>QSOs</th>
                  <th>Sections</th>
                  <th>Points</th>
                  <th>Rate (QSOs/hr)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="op in topOperators" :key="op.operator">
                  <td>{{ op.operator }}</td>
                  <td>{{ op.qsos }}</td>
                  <td>{{ op.sections }}</td>
                  <td>{{ op.points }}</td>
                  <td>{{ op.rate.toFixed(1) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Band/Mode Breakdown -->
          <div class="table-container">
            <h3>Band/Mode Breakdown</h3>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Band</th>
                  <th>CW</th>
                  <th>PH</th>
                  <th>DIG</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="band in bandModeBreakdown" :key="band.band">
                  <td>{{ band.band }}</td>
                  <td>{{ band.cw }}</td>
                  <td>{{ band.ph }}</td>
                  <td>{{ band.dig }}</td>
                  <td>{{ band.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Activity Timeline -->
        <div class="activity-timeline">
          <h3>Activity Timeline</h3>
          <div class="timeline-container">
            <div class="timeline-chart">
              <canvas ref="timelineChart" width="800" height="100"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue';
import type { QSO } from '@/store/qso';

interface Props {
  isOpen: boolean;
  qsos: QSO[];
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

// Chart canvas refs
const qsoTimeChart = ref<HTMLCanvasElement | null>(null);
const bandChart = ref<HTMLCanvasElement | null>(null);
const modeChart = ref<HTMLCanvasElement | null>(null);
const operatorChart = ref<HTMLCanvasElement | null>(null);
const hourlyChart = ref<HTMLCanvasElement | null>(null);
const stationChart = ref<HTMLCanvasElement | null>(null);
const timelineChart = ref<HTMLCanvasElement | null>(null);

function closeModal() {
  emit('close');
}

// Computed statistics
const totalQsos = computed(() => props.qsos.length);

const totalSections = computed(() => {
  const sections = new Set(props.qsos.map(qso => qso.section.toUpperCase()));
  return sections.size;
});

const qsosPerHour = computed(() => {
  if (props.qsos.length === 0) return 0;
  
  const sortedQsos = [...props.qsos].sort((a, b) => 
    new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );
  
  const firstQso = new Date(sortedQsos[0].datetime);
  const lastQso = new Date(sortedQsos[sortedQsos.length - 1].datetime);
  const hoursActive = (lastQso.getTime() - firstQso.getTime()) / (1000 * 60 * 60);
  
  return hoursActive > 0 ? props.qsos.length / hoursActive : 0;
});

const totalScore = computed(() => {
  const qsoPoints = props.qsos.reduce((total, qso) => {
    // CW and Digital modes are worth 2 points, Phone is worth 1 point
    return total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
  }, 0);
  
  return qsoPoints * totalSections.value;
});

const topOperators = computed(() => {
  const operatorStats = new Map();
  
  props.qsos.forEach(qso => {
    const op = qso.operator || 'Unknown';
    if (!operatorStats.has(op)) {
      operatorStats.set(op, {
        operator: op,
        qsos: 0,
        sections: new Set(),
        points: 0,
        firstQso: null as Date | null,
        lastQso: null as Date | null
      });
    }
    
    const stats = operatorStats.get(op);
    stats.qsos++;
    stats.sections.add(qso.section.toUpperCase());
    stats.points += qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1;
    
    const qsoTime = new Date(qso.datetime);
    if (!stats.firstQso || qsoTime < stats.firstQso) {
      stats.firstQso = qsoTime;
    }
    if (!stats.lastQso || qsoTime > stats.lastQso) {
      stats.lastQso = qsoTime;
    }
  });
  
  return Array.from(operatorStats.values())
    .map(stats => ({
      ...stats,
      sections: stats.sections.size,
      rate: stats.firstQso && stats.lastQso ? 
        stats.qsos / ((stats.lastQso.getTime() - stats.firstQso.getTime()) / (1000 * 60 * 60)) : 0
    }))
    .sort((a, b) => b.qsos - a.qsos);
});

const bandModeBreakdown = computed(() => {
  const bands = new Map();
  
  props.qsos.forEach(qso => {
    const band = qso.band || 'Unknown';
    if (!bands.has(band)) {
      bands.set(band, { band, cw: 0, ph: 0, dig: 0, total: 0 });
    }
    
    const stats = bands.get(band);
    stats.total++;
    
    switch (qso.mode) {
      case 'CW':
        stats.cw++;
        break;
      case 'PH':
        stats.ph++;
        break;
      case 'DIG':
        stats.dig++;
        break;
    }
  });
  
  return Array.from(bands.values()).sort((a, b) => b.total - a.total);
});

// Chart drawing functions
function drawChart(canvas: HTMLCanvasElement | null, drawFunction: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.scale(dpr, dpr);
  
  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  drawFunction(ctx, rect.width, rect.height);
}

function drawQsoTimeChart() {
  drawChart(qsoTimeChart.value, (ctx, width, height) => {
    if (props.qsos.length === 0) return;
    
    // Group QSOs by hour
    const hourlyData = new Map();
    props.qsos.forEach(qso => {
      const hour = new Date(qso.datetime).getHours();
      hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1);
    });
    
    const maxQsos = Math.max(...Array.from(hourlyData.values()));
    const barWidth = width / 24;
    const maxBarHeight = height - 40;
    
    // Draw bars
    ctx.fillStyle = 'var(--primary-color)';
    for (let hour = 0; hour < 24; hour++) {
      const qsos = hourlyData.get(hour) || 0;
      const barHeight = (qsos / maxQsos) * maxBarHeight;
      const x = hour * barWidth;
      const y = height - barHeight - 20;
      
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
      
      // Draw hour labels
      ctx.fillStyle = 'var(--text-color)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(hour.toString().padStart(2, '0'), x + barWidth / 2, height - 5);
      
      // Draw value on top of bar if there's room
      if (barHeight > 15) {
        ctx.fillText(qsos.toString(), x + barWidth / 2, y + 12);
      }
      
      ctx.fillStyle = 'var(--primary-color)';
    }
  });
}

function drawBandChart() {
  drawChart(bandChart.value, (ctx, width, height) => {
    const bandData = new Map();
    props.qsos.forEach(qso => {
      const band = qso.band || 'Unknown';
      bandData.set(band, (bandData.get(band) || 0) + 1);
    });
    
    const bands = Array.from(bandData.entries()).sort((a, b) => b[1] - a[1]);
    if (bands.length === 0) return;
    
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    let currentAngle = 0;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    bands.forEach(([band, count], index) => {
      const sliceAngle = (count / props.qsos.length) * 2 * Math.PI;
      
      // Draw slice
      ctx.fillStyle = colors[index % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      
      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(band, labelX, labelY);
      ctx.fillText(count.toString(), labelX, labelY + 15);
      
      currentAngle += sliceAngle;
    });
  });
}

function drawModeChart() {
  drawChart(modeChart.value, (ctx, width, height) => {
    const modeData = { CW: 0, PH: 0, DIG: 0 };
    props.qsos.forEach(qso => {
      if (qso.mode in modeData) {
        modeData[qso.mode as keyof typeof modeData]++;
      }
    });
    
    const modes = Object.entries(modeData).filter(([, count]) => count > 0);
    if (modes.length === 0) return;
    
    const barWidth = (width - 40) / modes.length;
    const maxCount = Math.max(...modes.map(([, count]) => count));
    const maxBarHeight = height - 40;
    
    const colors = { CW: '#FF6384', PH: '#36A2EB', DIG: '#FFCE56' };
    
    modes.forEach(([mode, count], index) => {
      const barHeight = (count / maxCount) * maxBarHeight;
      const x = 20 + index * barWidth;
      const y = height - barHeight - 20;
      
      ctx.fillStyle = colors[mode as keyof typeof colors];
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
      
      // Draw labels
      ctx.fillStyle = 'var(--text-color)';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(mode, x + barWidth / 2, height - 5);
      ctx.fillText(count.toString(), x + barWidth / 2, y - 5);
    });
  });
}

function drawOperatorChart() {
  drawChart(operatorChart.value, (ctx, width, height) => {
    const topOps = topOperators.value.slice(0, 5);
    if (topOps.length === 0) return;
    
    const barHeight = (height - 60) / topOps.length;
    const maxQsos = topOps[0].qsos;
    const maxBarWidth = width - 100;
    
    topOps.forEach((op, index) => {
      const barWidth = (op.qsos / maxQsos) * maxBarWidth;
      const y = 20 + index * barHeight;
      
      // Draw bar
      ctx.fillStyle = `hsl(${(index * 60) % 360}, 70%, 50%)`;
      ctx.fillRect(80, y + 5, barWidth, barHeight - 10);
      
      // Draw operator name
      ctx.fillStyle = 'var(--text-color)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(op.operator, 75, y + barHeight / 2 + 4);
      
      // Draw QSO count
      ctx.textAlign = 'left';
      ctx.fillText(op.qsos.toString(), 85 + barWidth, y + barHeight / 2 + 4);
    });
  });
}

function drawHourlyChart() {
  drawChart(hourlyChart.value, (ctx, width, height) => {
    if (props.qsos.length === 0) return;
    
    // Group QSOs by hour for the last 24 hours or available data
    const hourlyData = new Array(24).fill(0);
    
    props.qsos.forEach(qso => {
      const qsoTime = new Date(qso.datetime);
      const hour = qsoTime.getHours();
      hourlyData[hour]++;
    });
    
    const maxQsos = Math.max(...hourlyData);
    if (maxQsos === 0) return;
    
    const barWidth = width / 24;
    const maxBarHeight = height - 40;
    
    // Draw activity bars
    ctx.fillStyle = 'var(--accent-color)';
    hourlyData.forEach((count, hour) => {
      const barHeight = (count / maxQsos) * maxBarHeight;
      const x = hour * barWidth;
      const y = height - barHeight - 20;
      
      ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    });
    
    // Draw time labels (every 4 hours)
    ctx.fillStyle = 'var(--text-color)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    for (let hour = 0; hour < 24; hour += 4) {
      const x = hour * barWidth + barWidth / 2;
      ctx.fillText(`${hour}:00`, x, height - 5);
    }
  });
}

function drawStationChart() {
  drawChart(stationChart.value, (ctx, width, height) => {
    const stationData = new Map();
    props.qsos.forEach(qso => {
      const station = qso.stationDesignator || 'Unknown';
      stationData.set(station, (stationData.get(station) || 0) + 1);
    });
    
    const stations = Array.from(stationData.entries()).sort((a, b) => b[1] - a[1]);
    if (stations.length === 0) return;
    
    const barWidth = (width - 40) / stations.length;
    const maxCount = Math.max(...stations.map(([, count]) => count));
    const maxBarHeight = height - 40;
    
    stations.forEach(([station, count], index) => {
      const barHeight = (count / maxCount) * maxBarHeight;
      const x = 20 + index * barWidth;
      const y = height - barHeight - 20;
      
      ctx.fillStyle = `hsl(${(index * 45) % 360}, 70%, 50%)`;
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
      
      // Draw labels
      ctx.fillStyle = 'var(--text-color)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(station, x + barWidth / 2, height - 5);
      if (barHeight > 15) {
        ctx.fillText(count.toString(), x + barWidth / 2, y + 12);
      }
    });
  });
}

function drawTimelineChart() {
  drawChart(timelineChart.value, (ctx, width, height) => {
    if (props.qsos.length === 0) return;
    
    const sortedQsos = [...props.qsos].sort((a, b) => 
      new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
    
    const startTime = new Date(sortedQsos[0].datetime).getTime();
    const endTime = new Date(sortedQsos[sortedQsos.length - 1].datetime).getTime();
    const timeSpan = endTime - startTime;
    
    if (timeSpan === 0) return;
    
    const barHeight = height - 20;
    
    // Draw activity timeline
    sortedQsos.forEach(qso => {
      const qsoTime = new Date(qso.datetime).getTime();
      const x = ((qsoTime - startTime) / timeSpan) * width;
      
      // Color by mode
      const colors = { CW: '#FF6384', PH: '#36A2EB', DIG: '#FFCE56' };
      ctx.fillStyle = colors[qso.mode as keyof typeof colors] || '#999';
      ctx.fillRect(x - 1, 10, 2, barHeight);
    });
    
    // Draw time labels
    ctx.fillStyle = 'var(--text-color)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(new Date(startTime).toLocaleTimeString(), 5, height - 2);
    ctx.textAlign = 'right';
    ctx.fillText(new Date(endTime).toLocaleTimeString(), width - 5, height - 2);
  });
}

function drawAllCharts() {
  nextTick(() => {
    drawQsoTimeChart();
    drawBandChart();
    drawModeChart();
    drawOperatorChart();
    drawHourlyChart();
    drawStationChart();
    drawTimelineChart();
  });
}

// Watch for modal opening and QSO changes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    drawAllCharts();
  }
});

watch(() => props.qsos.length, () => {
  if (props.isOpen) {
    drawAllCharts();
  }
});

onMounted(() => {
  if (props.isOpen) {
    drawAllCharts();
  }
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.stats-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--modal-bg);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 0;
  box-sizing: border-box;
}

.stats-modal-content {
  background: var(--modal-content);
  border-radius: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  border: none;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--primary-color);
  color: white;
  border-radius: 0;
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
  }
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  color: white;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .material-icons {
    font-size: 24px;
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  color: var(--text-color);
  height: 0; /* Force flex item to shrink */
  min-height: 0; /* Override min-height: auto for flex items */
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  max-width: none;
}

.stat-card {
  background: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-color);
  opacity: 0.8;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.chart-container {
  background: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-color);
  }
}

.chart-wrapper {
  position: relative;
  width: 100%;
  height: 250px;

  canvas {
    width: 100%;
    height: 100%;
    border-radius: 4px;
  }
}

.stats-tables {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.table-container {
  background: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-color);
  }
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;

  th {
    background: var(--header-color);
    color: var(--text-color);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
  }

  td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-color);
  }

  tbody tr:hover {
    background: var(--bg-color);
  }
}

.activity-timeline {
  background: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-color);
  }
}

.timeline-container {
  width: 100%;
  height: 100px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.timeline-chart {
  width: 100%;
  height: 100%;

  canvas {
    width: 100%;
    height: 100%;
  }
}

/* Responsive design for full screen */
@media (max-width: 1600px) {
  .charts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1200px) {
  .stats-tables {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-body {
    padding: 1rem;
  }
  
  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .chart-wrapper {
    height: 200px;
  }
}

@media (max-width: 600px) {
  .stats-summary {
    grid-template-columns: 1fr;
  }
  
  .modal-header {
    padding: 1rem;
  }
  
  .modal-header h2 {
    font-size: 1.2rem;
  }
}
</style>

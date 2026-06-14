<template>
  <div class="fieldday-grid">
    <div class="current-qso">Current QSO Entry</div>
    <div class="recent-contacts">Recent Contacts</div>
    <div class="score-stats">Score Statistics</div>
    <div class="entry-form">
      <QsoEntryForm @log-qso="handleLogQso" />
    </div>
    <div class="possible-dupes">Possible Duplicates</div>
    <div class="section-map">Section Map</div>
    <div class="band-mode-table">Band/Mode Table</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import QsoEntryForm from '@/components/QsoEntryForm.vue';

interface Qso {
  call: string;
  qsoClass: string;
  section: string;
  band: string;
  operator: string;
  dateTime: string;
}

export default defineComponent({
  name: 'LogView',
  components: { QsoEntryForm },
  methods: {
    handleLogQso(_qso: Qso) {
      // Add logic to save QSO to your log
    }
  }
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.fieldday-grid {
  display: grid;
  grid-template-areas:
    "current-qso recent-contacts score-stats"
    "entry-form section-map score-stats"
    "possible-dupes section-map score-stats"
    "band-mode-table band-mode-table band-mode-table";
  grid-template-columns: 2fr 3fr 1.5fr;
  grid-template-rows: auto auto auto 1fr;
  gap: 10px;
  height: 100vh;
  background: #e6f0ff;
  padding: 10px;
}

.current-qso { grid-area: current-qso; background: #fff; border: 2px solid #0055a5; }
.recent-contacts { grid-area: recent-contacts; background: #fff; border: 2px solid #0055a5; }
.score-stats { grid-area: score-stats; background: #002b5c; color: #fff; border: 2px solid #0055a5; }
.entry-form { grid-area: entry-form; background: #fff; border: 2px solid #0055a5; }
.possible-dupes { grid-area: possible-dupes; background: #e0f7fa; border: 2px solid #0055a5; }
.section-map { grid-area: section-map; background: #fff; border: 2px solid #0055a5; }
.band-mode-table { grid-area: band-mode-table; background: #fff; border: 2px solid #0055a5; }
</style>

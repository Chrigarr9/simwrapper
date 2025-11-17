<template lang="pug">
.stats-panel
  active-time-histogram-plotly(
    :requests="requests"
    :baseline-requests="baselineRequests"
    :selected-bins="selectedTimebins"
    :show-comparison="showComparison"
    :is-dark-mode="isDarkMode"
    @bin-clicked="onBinClicked"
  )

  main-mode-pie-chart-plotly(
    :requests="requests"
    :baseline-requests="baselineRequests"
    :selected-modes="selectedModes"
    :show-comparison="showComparison"
    :is-dark-mode="isDarkMode"
    @mode-clicked="onModeClicked"
  )

  .panel-item.summary-stats
    .stat-row
      .stat-label Total Requests
      .stat-value {{ requests.length }}

    .stat-row(v-if="showComparison && baselineRequests.length > 0")
      .stat-label Filtered / Baseline
      .stat-value {{ requests.length }} / {{ baselineRequests.length }}

    .stat-row
      .stat-label Unique Modes
      .stat-value {{ uniqueModes }}

    .stat-row
      .stat-label Active Clusters
      .stat-value {{ activeClusters }}

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request } from '../../CommuterRequestsConfig'

import ActiveTimeHistogramPlotly from './ActiveTimeHistogramPlotly.vue'
import MainModePieChartPlotly from './MainModePieChartPlotly.vue'

export default defineComponent({
  name: 'StatsPanel',
  components: {
    ActiveTimeHistogramPlotly,
    MainModePieChartPlotly,
  },

  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    baselineRequests: { type: Array as PropType<Request[]>, default: () => [] },
    selectedTimebins: { type: Set as PropType<Set<string>>, required: true },
    selectedModes: { type: Set as PropType<Set<string>>, required: true },
    showComparison: { type: Boolean, default: false },
    clusterType: { type: String as PropType<'origin' | 'destination' | 'spatial'>, required: true },
    isDarkMode: { type: Boolean, default: false },
  },

  computed: {
    uniqueModes(): number {
      const modes = new Set<string>()
      for (const request of this.requests) {
        const mode = request.main_mode || request.mode
        if (mode) modes.add(mode)
      }
      return modes.size
    },

    activeClusters(): number {
      const clusterColumn =
        this.clusterType === 'origin'
          ? 'origin_cluster'
          : this.clusterType === 'destination'
          ? 'destination_cluster'
          : 'spatial_cluster'

      const clusters = new Set<number>()
      for (const request of this.requests) {
        const clusterId = request[clusterColumn]
        if (clusterId !== undefined && clusterId !== -1) {
          clusters.add(clusterId)
        }
      }
      return clusters.size
    },
  },

  methods: {
    onBinClicked(binLabel: string) {
      this.$emit('timebin-clicked', binLabel)
    },

    onModeClicked(mode: string) {
      this.$emit('mode-clicked', mode)
    },
  },
})
</script>

<style scoped lang="scss">
.stats-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.5rem;
  overflow-y: auto;
}

.panel-item {
  background-color: var(--bgPanel);
  border: 1px solid var(--borderDim);
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.summary-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;

  .stat-label {
    font-size: 0.8rem;
    color: var(--textFaded);
  }

  .stat-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }
}
</style>

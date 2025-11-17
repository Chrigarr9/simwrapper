<template lang="pug">
.panel-item
  .panel-header
    h5 Mode Share

  vue-plotly.chart(
    v-if="plotData.length > 0"
    :data="plotData"
    :layout="plotLayout"
    :options="plotOptions"
    @click="onPlotClick"
  )

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request } from '../../CommuterRequestsConfig'
import { getModeColorHex } from '../../utils/colorSchemes'
import VuePlotly from '@/components/VuePlotly.vue'

export default defineComponent({
  name: 'MainModePieChartPlotly',
  components: { VuePlotly },

  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    baselineRequests: { type: Array as PropType<Request[]>, default: () => [] },
    selectedModes: { type: Set as PropType<Set<string>>, default: () => new Set() },
    showComparison: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },

  computed: {
    modeData(): { labels: string[]; values: number[]; colors: string[] } {
      return this.calculateModeData(this.requests)
    },

    baselineModeData(): { labels: string[]; values: number[]; colors: string[] } {
      if (!this.showComparison || this.baselineRequests.length === 0) {
        return { labels: [], values: [], colors: [] }
      }
      return this.calculateModeData(this.baselineRequests)
    },

    plotData(): any[] {
      const data: any[] = []

      // Apply opacity based on selection
      const colors = this.modeData.labels.map((label, i) => {
        const baseColor = this.modeData.colors[i]
        // If modes are selected, dim unselected ones
        if (this.selectedModes.size > 0) {
          return this.selectedModes.has(label) ? baseColor : baseColor + '40' // 25% opacity
        }
        return baseColor
      })

      // Main pie chart
      data.push({
        labels: this.modeData.labels,
        values: this.modeData.values,
        type: 'pie',
        hole: 0.4, // Donut chart
        marker: {
          colors: colors,
          line: {
            color: this.modeData.labels.map(label =>
              this.selectedModes.has(label) ? '#3b82f6' : 'transparent'
            ),
            width: this.modeData.labels.map(label => (this.selectedModes.has(label) ? 3 : 0)),
          },
        },
        textinfo: 'label+percent',
        textposition: 'outside',
        hovertemplate: '<b>%{label}</b><br>%{value} requests (%{percent})<extra></extra>',
        domain: this.showComparison ? { x: [0.15, 0.85], y: [0.15, 0.85] } : undefined,
      })

      // Baseline ring (if comparison mode)
      if (this.showComparison && this.baselineModeData.labels.length > 0) {
        data.push({
          labels: this.baselineModeData.labels,
          values: this.baselineModeData.values,
          type: 'pie',
          hole: 0.7,
          marker: {
            colors: this.baselineModeData.colors.map(c => c + '80'), // Add transparency
          },
          textinfo: 'none',
          hovertemplate: '<b>Baseline: %{label}</b><br>%{value} requests<extra></extra>',
          domain: { x: [0, 1], y: [0, 1] },
        })
      }

      return data
    },

    plotLayout(): any {
      const textColor = this.isDarkMode ? '#e5e7eb' : '#374151'
      const bgColor = this.isDarkMode ? '#1f2937' : '#ffffff'

      return {
        height: 250,
        margin: { l: 20, r: 20, t: 10, b: 10 },
        plot_bgcolor: bgColor,
        paper_bgcolor: bgColor,
        font: { color: textColor, size: 10 },
        showlegend: false,
        annotations: [
          {
            text: `<b>${this.requests.length}</b><br><span style="font-size:9px">requests</span>`,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            showarrow: false,
            font: { size: 16, color: textColor },
          },
        ],
      }
    },

    plotOptions(): any {
      return {
        displayModeBar: false,
        responsive: true,
      }
    },
  },

  methods: {
    calculateModeData(requests: Request[]): {
      labels: string[]
      values: number[]
      colors: string[]
    } {
      const modeCounts = new Map<string, number>()

      for (const request of requests) {
        const mode = request.main_mode || request.mode || 'unknown'
        modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1)
      }

      // Sort by count descending
      const sorted = Array.from(modeCounts.entries()).sort((a, b) => b[1] - a[1])

      return {
        labels: sorted.map(([mode]) => mode),
        values: sorted.map(([, count]) => count),
        colors: sorted.map(([mode]) => getModeColorHex(mode)),
      }
    },

    onPlotClick(event: any) {
      // Plotly click event structure: event.points[0].label contains the mode name
      if (event && event.points && event.points.length > 0) {
        const clickedMode = event.points[0].label
        this.$emit('mode-clicked', clickedMode)
      }
    },
  },
})
</script>

<style scoped lang="scss">
.panel-item {
  background-color: var(--bgPanel);
  border: 1px solid var(--borderDim);
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.panel-header {
  margin-bottom: 0.5rem;

  h5 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }
}

.chart {
  width: 100%;
}
</style>

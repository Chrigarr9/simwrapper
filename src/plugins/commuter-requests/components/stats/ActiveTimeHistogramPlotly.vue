<template lang="pug">
.panel-item
  .panel-header
    h5 Active Time Distribution

  vue-plotly.chart(
    v-if="plotData.length > 0"
    :data="plotData"
    :layout="plotLayout"
    :options="plotOptions"
    @click="handleBarClick"
  )

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request } from '../../CommuterRequestsConfig'
import VuePlotly from '@/components/VuePlotly.vue'

interface TimeBin {
  label: string
  start: number
  end: number
  count: number
}

export default defineComponent({
  name: 'ActiveTimeHistogramPlotly',
  components: { VuePlotly },

  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    baselineRequests: { type: Array as PropType<Request[]>, default: () => [] },
    selectedBins: { type: Set as PropType<Set<string>>, required: true },
    showComparison: { type: Boolean, default: false },
    binSize: { type: Number, default: 15 }, // minutes
    isDarkMode: { type: Boolean, default: false },
  },

  computed: {
    bins(): TimeBin[] {
      return this.calculateBins(this.requests)
    },

    baselineBins(): TimeBin[] {
      if (!this.showComparison || this.baselineRequests.length === 0) {
        return []
      }
      return this.calculateBins(this.baselineRequests)
    },

    plotData(): any[] {
      const data: any[] = []

      // Baseline trace (if comparison mode)
      if (this.showComparison && this.baselineBins.length > 0) {
        data.push({
          x: this.baselineBins.map(b => b.label),
          y: this.baselineBins.map(b => b.count),
          type: 'bar',
          name: 'Baseline',
          marker: {
            color: 'rgba(156, 163, 175, 0.5)',
          },
        })
      }

      // Filtered trace
      const colors = this.bins.map(bin =>
        this.selectedBins.has(bin.label)
          ? 'rgba(59, 130, 246, 1)' // Selected - bright blue
          : 'rgba(59, 130, 246, 0.7)' // Not selected - slightly transparent
      )

      data.push({
        x: this.bins.map(b => b.label),
        y: this.bins.map(b => b.count),
        type: 'bar',
        name: this.showComparison ? 'Filtered' : 'Active Requests',
        marker: {
          color: colors,
          line: {
            color: this.bins.map(bin =>
              this.selectedBins.has(bin.label) ? 'rgba(30, 64, 175, 1)' : 'transparent'
            ),
            width: this.bins.map(bin => this.selectedBins.has(bin.label) ? 2 : 0),
          },
        },
        hovertemplate: '<b>%{x}</b><br>%{y} requests<extra></extra>',
      })

      return data
    },

    plotLayout(): any {
      const textColor = this.isDarkMode ? '#e5e7eb' : '#374151'
      const gridColor = this.isDarkMode ? '#374151' : '#e5e7eb'
      const bgColor = this.isDarkMode ? '#1f2937' : '#ffffff'

      return {
        xaxis: {
          title: { text: 'Time of Day', font: { size: 11 } },
          tickangle: -45,
          tickfont: { size: 9 },
          gridcolor: gridColor,
          color: textColor,
        },
        yaxis: {
          title: { text: 'Active Requests', font: { size: 11 } },
          tickfont: { size: 9 },
          gridcolor: gridColor,
          color: textColor,
        },
        margin: { l: 50, r: 20, t: 10, b: 60 },
        height: 220,
        plot_bgcolor: bgColor,
        paper_bgcolor: bgColor,
        font: { color: textColor },
        showlegend: this.showComparison,
        legend: {
          x: 1,
          xanchor: 'right',
          y: 1,
          font: { size: 10 },
        },
        barmode: this.showComparison ? 'group' : 'overlay',
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
    calculateBins(requests: Request[]): TimeBin[] {
      const binSizeSeconds = this.binSize * 60
      const numBins = Math.ceil((24 * 3600) / binSizeSeconds)

      const bins: TimeBin[] = []
      for (let i = 0; i < numBins; i++) {
        const start = i * binSizeSeconds
        const end = (i + 1) * binSizeSeconds

        const hours = Math.floor(start / 3600)
        const minutes = Math.floor((start % 3600) / 60)
        const label = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

        bins.push({ label, start, end, count: 0 })
      }

      // Count active requests in each bin
      for (const request of requests) {
        const requestStart = request.treq
        const requestEnd = request.treq + request.travel_time

        for (const bin of bins) {
          if (requestStart <= bin.end && requestEnd >= bin.start) {
            bin.count++
          }
        }
      }

      return bins
    },

    handleBarClick(event: any) {
      if (event.points && event.points.length > 0) {
        const binLabel = event.points[0].x
        this.$emit('bin-clicked', binLabel)
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

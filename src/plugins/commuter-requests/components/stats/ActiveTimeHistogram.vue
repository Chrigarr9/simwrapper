<template lang="pug">
.active-time-histogram
  .chart-header
    h4 Active Time Distribution
    .legend(v-if="showComparison")
      .legend-item
        .legend-color.filtered
        span Filtered
      .legend-item
        .legend-color.baseline
        span Baseline

  .chart-container(ref="chartContainer")
    svg(:width="width" :height="height")
      // Y-axis
      g.y-axis(:transform="`translate(${margin.left}, ${margin.top})`")
        line(
          v-for="tick in yTicks"
          :key="tick"
          :y1="yScale(tick)"
          :y2="yScale(tick)"
          :x2="chartWidth"
          stroke="var(--borderDim)"
          stroke-dasharray="2,2"
        )
        text(
          v-for="tick in yTicks"
          :key="tick"
          :y="yScale(tick)"
          x="-8"
          text-anchor="end"
          dominant-baseline="middle"
          fill="var(--textFaded)"
          font-size="11"
        ) {{ tick }}

      // Bars (baseline if comparison mode)
      g.bars-baseline(
        v-if="showComparison"
        :transform="`translate(${margin.left}, ${margin.top})`"
      )
        rect(
          v-for="bin in baselineBins"
          :key="`baseline-${bin.label}`"
          :x="xScale(bin.label)"
          :y="yScale(bin.count)"
          :width="barWidth * 0.45"
          :height="chartHeight - yScale(bin.count)"
          :fill="baselineColor"
          opacity="0.5"
          @click="onBinClick(bin.label)"
          style="cursor: pointer"
        )

      // Bars (filtered)
      g.bars-filtered(:transform="`translate(${margin.left}, ${margin.top})`")
        rect(
          v-for="bin in bins"
          :key="`filtered-${bin.label}`"
          :x="showComparison ? xScale(bin.label) + barWidth * 0.5 : xScale(bin.label)"
          :y="yScale(bin.count)"
          :width="showComparison ? barWidth * 0.45 : barWidth"
          :height="chartHeight - yScale(bin.count)"
          :fill="filteredColor"
          :class="{ selected: selectedBins.has(bin.label) }"
          @click="onBinClick(bin.label)"
          @mouseenter="hoveredBin = bin"
          @mouseleave="hoveredBin = null"
          style="cursor: pointer"
        )

      // X-axis
      g.x-axis(:transform="`translate(${margin.left}, ${height - margin.bottom})`")
        text(
          v-for="(bin, i) in bins"
          :key="`xaxis-${bin.label}`"
          :x="xScale(bin.label) + barWidth / 2"
          y="16"
          text-anchor="middle"
          fill="var(--textFaded)"
          font-size="10"
        ) {{ i % 4 === 0 ? bin.label : '' }}

      // Axis labels
      g.labels
        text(
          :x="width / 2"
          :y="height - 4"
          text-anchor="middle"
          fill="var(--text)"
          font-size="12"
          font-weight="500"
        ) Time of Day

        text(
          :x="12"
          :y="height / 2"
          text-anchor="middle"
          fill="var(--text)"
          font-size="12"
          font-weight="500"
          :transform="`rotate(-90, 12, ${height / 2})`"
        ) Active Requests

    // Tooltip
    .tooltip(
      v-if="hoveredBin"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    )
      .tooltip-content
        strong {{ hoveredBin.label }}
        span {{ hoveredBin.count }} requests

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request } from '../../CommuterRequestsConfig'

interface TimeBin {
  label: string
  start: number
  end: number
  count: number
}

export default defineComponent({
  name: 'ActiveTimeHistogram',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    baselineRequests: { type: Array as PropType<Request[]>, default: () => [] },
    selectedBins: { type: Set as PropType<Set<string>>, required: true },
    showComparison: { type: Boolean, default: false },
    binSize: { type: Number, default: 15 }, // minutes
  },

  data() {
    return {
      width: 600,
      height: 250,
      margin: { top: 20, right: 20, bottom: 50, left: 50 },
      hoveredBin: null as TimeBin | null,
      tooltipX: 0,
      tooltipY: 0,
      filteredColor: '#3b82f6',
      baselineColor: '#9ca3af',
    }
  },

  computed: {
    chartWidth(): number {
      return this.width - this.margin.left - this.margin.right
    },

    chartHeight(): number {
      return this.height - this.margin.top - this.margin.bottom
    },

    bins(): TimeBin[] {
      return this.calculateBins(this.requests)
    },

    baselineBins(): TimeBin[] {
      if (!this.showComparison || this.baselineRequests.length === 0) {
        return []
      }
      return this.calculateBins(this.baselineRequests)
    },

    maxCount(): number {
      const filteredMax = Math.max(...this.bins.map((b) => b.count), 0)
      const baselineMax = this.baselineBins.length
        ? Math.max(...this.baselineBins.map((b) => b.count), 0)
        : 0
      return Math.max(filteredMax, baselineMax)
    },

    yTicks(): number[] {
      const max = this.maxCount
      const step = Math.ceil(max / 5)
      return Array.from({ length: 6 }, (_, i) => i * step)
    },

    barWidth(): number {
      return this.chartWidth / this.bins.length
    },

    xScale() {
      return (label: string) => {
        const index = this.bins.findIndex((b) => b.label === label)
        return index * this.barWidth
      }
    },

    yScale() {
      return (value: number) => {
        return this.chartHeight - (value / this.maxCount) * this.chartHeight
      }
    },
  },

  mounted() {
    this.updateDimensions()
    window.addEventListener('resize', this.updateDimensions)
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.updateDimensions)
  },

  methods: {
    calculateBins(requests: Request[]): TimeBin[] {
      // Create 15-minute bins for 24 hours
      const binSizeSeconds = this.binSize * 60
      const numBins = Math.ceil((24 * 3600) / binSizeSeconds)

      const bins: TimeBin[] = []
      for (let i = 0; i < numBins; i++) {
        const start = i * binSizeSeconds
        const end = (i + 1) * binSizeSeconds

        // Format label as HH:MM
        const hours = Math.floor(start / 3600)
        const minutes = Math.floor((start % 3600) / 60)
        const label = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

        bins.push({ label, start, end, count: 0 })
      }

      // Count active requests in each bin
      // Active if: treq <= bin_end AND (treq + travel_time) >= bin_start
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

    onBinClick(label: string) {
      this.$emit('bin-clicked', label)
    },

    updateDimensions() {
      const container = this.$refs.chartContainer as HTMLElement
      if (container) {
        this.width = container.clientWidth
      }
    },
  },
})
</script>

<style scoped lang="scss">
.active-time-histogram {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background-color: var(--bgPanel);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .legend {
    display: flex;
    gap: 1rem;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--textFaded);

      .legend-color {
        width: 16px;
        height: 16px;
        border-radius: 2px;

        &.filtered {
          background-color: #3b82f6;
        }

        &.baseline {
          background-color: #9ca3af;
          opacity: 0.5;
        }
      }
    }
  }
}

.chart-container {
  position: relative;
  width: 100%;
  min-height: 250px;

  svg {
    overflow: visible;

    rect {
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.8;
      }

      &.selected {
        stroke: #1e40af;
        stroke-width: 2;
      }
    }
  }
}

.tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 100;

  .tooltip-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background-color: var(--bgPanel);
    border: 1px solid var(--borderDim);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    font-size: 0.75rem;
    color: var(--text);
    white-space: nowrap;

    strong {
      font-weight: 600;
    }

    span {
      color: var(--textFaded);
    }
  }
}
</style>

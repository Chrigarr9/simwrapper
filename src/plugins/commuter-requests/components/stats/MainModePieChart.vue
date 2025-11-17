<template lang="pug">
.main-mode-pie-chart
  .chart-header
    h4 Mode Share
    .legend(v-if="showComparison")
      .legend-item
        .legend-color.filtered
        span Filtered
      .legend-item
        .legend-color.baseline
        span Baseline

  .chart-content
    .pie-container(ref="pieContainer")
      svg(:width="width" :height="height")
        // Baseline pie (outer ring) if comparison mode
        g.pie-baseline(
          v-if="showComparison"
          :transform="`translate(${width / 2}, ${height / 2})`"
        )
          path(
            v-for="slice in baselineSlices"
            :key="`baseline-${slice.mode}`"
            :d="slice.path"
            :fill="slice.color"
            opacity="0.3"
            @mouseenter="hoveredSlice = { ...slice, isBaseline: true }"
            @mouseleave="hoveredSlice = null"
          )

        // Filtered pie (main)
        g.pie-filtered(:transform="`translate(${width / 2}, ${height / 2})`")
          path(
            v-for="slice in slices"
            :key="`filtered-${slice.mode}`"
            :d="slice.path"
            :fill="slice.color"
            @mouseenter="hoveredSlice = { ...slice, isBaseline: false }"
            @mouseleave="hoveredSlice = null"
            style="cursor: pointer"
          )

          // Center text
          text(
            text-anchor="middle"
            dominant-baseline="middle"
            fill="var(--text)"
            font-size="24"
            font-weight="600"
          ) {{ requests.length }}
          text(
            y="20"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="var(--textFaded)"
            font-size="11"
          ) requests

    .legend-list
      .mode-item(
        v-for="slice in slices"
        :key="slice.mode"
        @mouseenter="hoveredSlice = { ...slice, isBaseline: false }"
        @mouseleave="hoveredSlice = null"
      )
        .mode-color(:style="{ backgroundColor: slice.color }")
        .mode-info
          .mode-name {{ slice.mode }}
          .mode-stats
            span.percentage {{ slice.percentage.toFixed(1) }}%
            span.count(v-if="hoveredSlice && hoveredSlice.mode === slice.mode")
              | ({{ slice.count }} requests)

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request } from '../../CommuterRequestsConfig'
import { getModeColorHex } from '../../utils/colorSchemes'

interface PieSlice {
  mode: string
  count: number
  percentage: number
  color: string
  path: string
  startAngle: number
  endAngle: number
}

export default defineComponent({
  name: 'MainModePieChart',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    baselineRequests: { type: Array as PropType<Request[]>, default: () => [] },
    showComparison: { type: Boolean, default: false },
  },

  data() {
    return {
      width: 200,
      height: 200,
      hoveredSlice: null as (PieSlice & { isBaseline: boolean }) | null,
    }
  },

  computed: {
    radius(): number {
      return Math.min(this.width, this.height) / 2 - 10
    },

    innerRadius(): number {
      // Donut chart
      return this.radius * 0.6
    },

    outerRadiusBaseline(): number {
      // Larger outer ring for baseline if comparison mode
      return this.showComparison ? this.radius + 15 : this.radius
    },

    slices(): PieSlice[] {
      return this.calculateSlices(this.requests, this.radius, this.innerRadius)
    },

    baselineSlices(): PieSlice[] {
      if (!this.showComparison || this.baselineRequests.length === 0) {
        return []
      }
      return this.calculateSlices(
        this.baselineRequests,
        this.outerRadiusBaseline,
        this.radius + 5
      )
    },
  },

  methods: {
    calculateSlices(
      requests: Request[],
      outerRadius: number,
      innerRadius: number
    ): PieSlice[] {
      // Count requests by main_mode
      const modeCounts = new Map<string, number>()
      for (const request of requests) {
        const mode = request.main_mode || request.mode || 'unknown'
        modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1)
      }

      // Convert to array and sort by count (descending)
      const modeArray = Array.from(modeCounts.entries())
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count)

      // Calculate slices
      const total = requests.length
      let currentAngle = -Math.PI / 2 // Start at top

      const slices: PieSlice[] = []
      for (const { mode, count } of modeArray) {
        const percentage = (count / total) * 100
        const angleSize = (count / total) * 2 * Math.PI
        const endAngle = currentAngle + angleSize

        const path = this.createArcPath(currentAngle, endAngle, outerRadius, innerRadius)

        slices.push({
          mode,
          count,
          percentage,
          color: getModeColorHex(mode),
          path,
          startAngle: currentAngle,
          endAngle,
        })

        currentAngle = endAngle
      }

      return slices
    },

    createArcPath(
      startAngle: number,
      endAngle: number,
      outerRadius: number,
      innerRadius: number
    ): string {
      const x1 = Math.cos(startAngle) * outerRadius
      const y1 = Math.sin(startAngle) * outerRadius
      const x2 = Math.cos(endAngle) * outerRadius
      const y2 = Math.sin(endAngle) * outerRadius
      const x3 = Math.cos(endAngle) * innerRadius
      const y3 = Math.sin(endAngle) * innerRadius
      const x4 = Math.cos(startAngle) * innerRadius
      const y4 = Math.sin(startAngle) * innerRadius

      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

      return `
        M ${x1} ${y1}
        A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
        Z
      `
    },
  },
})
</script>

<style scoped lang="scss">
.main-mode-pie-chart {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background-color: var(--bgPanel);
  border-radius: 0.5rem;
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
          opacity: 0.3;
        }
      }
    }
  }
}

.chart-content {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.pie-container {
  flex-shrink: 0;

  svg {
    overflow: visible;

    path {
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.8;
      }
    }
  }
}

.legend-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bgHover);
  }

  .mode-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .mode-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;

    .mode-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
    }

    .mode-stats {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;

      .percentage {
        color: var(--text);
        font-weight: 600;
      }

      .count {
        color: var(--textFaded);
      }
    }
  }
}
</style>

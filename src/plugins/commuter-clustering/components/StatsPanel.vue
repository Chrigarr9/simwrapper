<template lang="pug">
.stats-panel

  //- Summary metrics
  .panel-section
    h3 Summary
    .metrics-grid
      .metric
        .metric-label Total Requests
        .metric-value {{ requests.length }}
        .metric-baseline(v-if="showComparison") / {{ baseline.length }}

      .metric
        .metric-label Unique Passengers
        .metric-value {{ uniquePassengers }}

      .metric
        .metric-label Mean Travel Time
        .metric-value {{ meanTravelTime }} min

      .metric
        .metric-label Mean Distance
        .metric-value {{ meanDistance }} km

      .metric
        .metric-label Mean Detour
        .metric-value {{ meanDetour }}x

      .metric(v-if="hasPriceData")
        .metric-label Mean Max Price
        .metric-value {{ meanMaxPrice }} €/km

  //- Mode distribution
  .panel-section
    h3 Mode Distribution
    .bar-chart
      .bar-item(v-for="mode in topModes" :key="mode.mode")
        .bar-label {{ mode.mode }}
        .bar-wrapper
          .bar-fill(:style="{ width: `${(mode.count / requests.length) * 100}%`, backgroundColor: getModeColor(mode.mode) }")
          .bar-value {{ mode.count }}

  //- Activity distribution
  .panel-section(v-if="hasActivities")
    h3 Activity Distribution
    .bar-chart
      .bar-item(v-for="activity in topActivities" :key="activity.type")
        .bar-label {{ activity.type }}
        .bar-wrapper
          .bar-fill(:style="{ width: `${(activity.count / requests.length) * 100}%`, backgroundColor: getActivityColor(activity.type) }")
          .bar-value {{ activity.count }}

  //- Time distribution
  .panel-section
    h3 Departure Time Distribution
    .time-histogram
      .histogram-bar(
        v-for="bin in timeBins"
        :key="bin.hour"
        :style="{ height: `${(bin.count / maxBinCount) * 100}%` }"
        :title="`${bin.hour}:00 - ${bin.hour + 1}:00: ${bin.count} requests`"
      )
      .histogram-labels
        span.hour-label(v-for="hour in [0, 6, 12, 18, 24]" :key="hour") {{ hour }}:00

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { Request } from '../CommuterClusteringConfig'

export default defineComponent({
  name: 'StatsPanel',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    baseline: { type: Array as PropType<Request[]>, required: true },
    showComparison: { type: Boolean, default: false },
    modeColors: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
    activityColors: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  },
  computed: {
    uniquePassengers(): number {
      const uniquePax = new Set(this.requests.map(r => r.pax_id))
      return uniquePax.size
    },
    meanTravelTime(): string {
      if (this.requests.length === 0) return '0'
      const sum = this.requests.reduce((acc, r) => acc + (r.travel_time || 0), 0)
      return (sum / this.requests.length / 60).toFixed(1)  // Convert to minutes
    },
    meanDistance(): string {
      if (this.requests.length === 0) return '0'
      const sum = this.requests.reduce((acc, r) => acc + (r.distance || 0), 0)
      return (sum / this.requests.length).toFixed(1)
    },
    meanDetour(): string {
      if (this.requests.length === 0) return '0'
      const sum = this.requests.reduce((acc, r) => acc + (r.max_detour || 1.0), 0)
      return (sum / this.requests.length).toFixed(2)
    },
    meanMaxPrice(): string {
      if (this.requests.length === 0) return '0'
      const validPrices = this.requests.filter(r => r.max_price !== undefined && r.max_price > 0)
      if (validPrices.length === 0) return '0'
      const sum = validPrices.reduce((acc, r) => acc + (r.max_price || 0), 0)
      return (sum / validPrices.length).toFixed(2)
    },
    hasPriceData(): boolean {
      return this.requests.some(r => r.max_price !== undefined && r.max_price > 0)
    },
    topModes(): Array<{ mode: string; count: number }> {
      const modeCounts = new Map<string, number>()
      this.requests.forEach(r => {
        const mode = r.main_mode || r.mode
        modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1)
      })
      return Array.from(modeCounts.entries())
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    },
    topActivities(): Array<{ type: string; count: number }> {
      const activityCounts = new Map<string, number>()
      this.requests.forEach(r => {
        const activity = r.start_activity_type
        if (activity) {
          activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1)
        }
      })
      return Array.from(activityCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    },
    hasActivities(): boolean {
      return this.requests.some(r => r.start_activity_type)
    },
    timeBins(): Array<{ hour: number; count: number }> {
      // Create 24-hour bins
      const bins = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))

      this.requests.forEach(r => {
        if (r.treq !== undefined && r.treq !== null) {
          const hours = Math.floor(r.treq / 3600) % 24
          if (hours >= 0 && hours < 24) {
            bins[hours].count++
          }
        }
      })

      return bins
    },
    maxBinCount(): number {
      if (this.timeBins.length === 0) return 1
      return Math.max(...this.timeBins.map(b => b.count), 1)
    },
  },
  methods: {
    getModeColor(mode: string): string {
      const defaultColors: Record<string, string> = {
        car: '#ff4444',
        pt: '#4477ff',
        bike: '#44ff77',
        walk: '#ffbb44',
      }
      return this.modeColors[mode] || defaultColors[mode] || '#777777'
    },
    getActivityColor(activity: string): string {
      const defaultColors: Record<string, string> = {
        home: '#4477ff',
        work: '#ff4477',
        education: '#44ff77',
        shopping: '#ff7744',
        leisure: '#aa44ff',
      }
      return this.activityColors[activity] || defaultColors[activity] || '#777777'
    },
  },
})
</script>

<style scoped lang="scss">
.stats-panel {
  background-color: var(--bgCream);
  border-radius: 4px;
  padding: 1rem;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.metric {
  background-color: var(--bgPanel);
  padding: 0.75rem;
  border-radius: 4px;

  .metric-label {
    font-size: 0.75rem;
    color: var(--textFaded);
    margin-bottom: 0.25rem;
  }

  .metric-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
  }

  .metric-baseline {
    font-size: 0.85rem;
    color: var(--textFaded);
    margin-top: 0.25rem;
  }
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .bar-label {
    min-width: 60px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
    text-transform: capitalize;
  }

  .bar-wrapper {
    flex: 1;
    position: relative;
    height: 28px;
    background-color: var(--bgPanel);
    border-radius: 4px;
    overflow: visible;

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
      min-width: 2px;
    }

    .bar-value {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text);
      text-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
    }
  }
}

.time-histogram {
  position: relative;
  height: 120px;
  background-color: var(--bgPanel);
  border-radius: 4px;
  padding: 0.75rem 0.5rem 1.75rem 0.5rem;
  display: flex;
  align-items: flex-end;
  gap: 1px;

  .histogram-bar {
    flex: 1;
    background: linear-gradient(to top, var(--link), var(--linkHover));
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    transition: all 0.2s;
    cursor: pointer;

    &:hover {
      opacity: 0.8;
      transform: scaleY(1.05);
    }
  }

  .histogram-labels {
    position: absolute;
    bottom: 0.25rem;
    left: 0.5rem;
    right: 0.5rem;
    display: flex;
    justify-content: space-between;

    .hour-label {
      font-size: 0.7rem;
      color: var(--textFaded);
      font-weight: 500;
    }
  }
}
</style>

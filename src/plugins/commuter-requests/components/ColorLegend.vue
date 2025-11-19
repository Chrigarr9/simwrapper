<template lang="pug">
.color-legend(v-if="legendItems.length > 0 || isNumeric")
  .legend-title {{ title }}

  //- Categorical legend (discrete values)
  .legend-items(v-if="!isNumeric && legendItems.length > 0")
    .legend-item(v-for="item in legendItems" :key="item.label")
      .legend-swatch(:style="{ backgroundColor: item.color }")
      .legend-label {{ item.label }}

  //- Numeric legend (gradient bar)
  .legend-gradient(v-if="isNumeric")
    .gradient-bar(:style="{ background: gradientStyle }")
    .gradient-labels
      .gradient-label.min {{ formatNumber(minValue) }}
      .gradient-label.max {{ formatNumber(maxValue) }}
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'

interface LegendItem {
  label: string
  color: string
}

export default defineComponent({
  name: 'ColorLegend',
  props: {
    title: { type: String, required: true },
    legendItems: { type: Array as PropType<LegendItem[]>, required: true },
    isNumeric: { type: Boolean, default: false },
    minValue: { type: Number, default: 0 },
    maxValue: { type: Number, default: 100 },
  },

  computed: {
    gradientStyle(): string {
      // Viridis color scale gradient (purple → blue → green → yellow)
      return 'linear-gradient(to right, #440154, #31688e, #35b779, #fde724)'
    },
  },

  methods: {
    formatNumber(value: number): string {
      // Format numbers based on magnitude
      if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'k'
      } else if (value % 1 === 0) {
        return value.toFixed(0)
      } else {
        return value.toFixed(2)
      }
    },
  },

  mounted() {
    console.log('ColorLegend mounted:', {
      title: this.title,
      legendItemsCount: this.legendItems.length,
      isNumeric: this.isNumeric,
      minValue: this.minValue,
      maxValue: this.maxValue,
    })
  },

  watch: {
    legendItems: {
      handler(newVal) {
        console.log('ColorLegend.legendItems changed:', {
          title: this.title,
          itemsCount: newVal.length,
          items: newVal,
        })
      },
      deep: true,
    },
    isNumeric(newVal) {
      console.log('ColorLegend.isNumeric changed:', newVal)
    },
  },
})
</script>

<style scoped lang="scss">
.color-legend {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  background-color: var(--bgCream);
  border: 1px solid var(--borderStrong);
  border-radius: 4px;
  padding: 0.75rem;
  max-width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000; // Ensure it's above map layers (typically z-index: 0-500)
  pointer-events: auto; // Ensure it's interactive
}

.legend-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.5rem;
  display: block;
}

// Categorical legend styles
.legend-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-swatch {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border: 1px solid var(--borderStrong);
  border-radius: 2px;
}

.legend-label {
  font-size: 0.8rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Numeric gradient legend styles
.legend-gradient {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gradient-bar {
  width: 100%;
  height: 1.5rem;
  border: 1px solid var(--borderStrong);
  border-radius: 2px;
}

.gradient-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gradient-label {
  font-size: 0.75rem;
  color: var(--text);
  font-weight: 500;

  &.min {
    text-align: left;
  }

  &.max {
    text-align: right;
  }
}
</style>

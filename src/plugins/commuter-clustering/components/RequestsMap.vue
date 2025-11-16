<template lang="pug">
.requests-map

  //- Deck.gl map
  deck-map-component(
    :requests="requests"
    :clusters="clusters"
    :color-by="localColorBy"
    :show-boundaries="localShowBoundaries"
    :show-centroids="localShowCentroids"
    :show-flows="localShowFlows"
    :map-settings="mapSettings"
    :view-id="viewId"
    :mode-colors="modeColors"
    :activity-colors="activityColors"
    :selected-request-id="selectedRequestId"
    @request-selected="handleRequestSelected"
    @cluster-selected="handleClusterSelected"
  )

  //- Controls (top-right)
  .map-controls(v-if="!thumbnail")
    .control-group
      label Color by:
      select(v-model="localColorBy" @change="handleColorChange")
        option(value="mode") Mode
        option(value="activity") Activity
        option(value="price") Max Price
        option(value="detour") Max Detour

    .control-group
      label Layers:
      .checkbox-group
        label
          input(type="checkbox" v-model="localShowBoundaries" @change="handleLayerChange")
          span Boundaries
        label
          input(type="checkbox" v-model="localShowCentroids" @change="handleLayerChange")
          span Centroids
        label
          input(type="checkbox" v-model="localShowFlows" @change="handleLayerChange")
          span Flows

  //- Time slider (bottom)
  .time-slider-container(v-if="!thumbnail")
    p Time Slider: {{ formatTime(timeRange[0]) }} - {{ formatTime(timeRange[1]) }}

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { Request, ColorByMode } from '../CommuterClusteringConfig'
import { formatTimeMinutes } from '../utils/timeFilter'
import DeckMapComponent from './DeckMapComponent.vue'

export default defineComponent({
  name: 'RequestsMap',
  components: {
    DeckMapComponent,
  },
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    clusters: { type: Array as PropType<any[]>, required: true },
    timeRange: { type: Array as PropType<[number, number]>, required: true },
    colorBy: { type: String as PropType<ColorByMode>, required: true },
    showBoundaries: { type: Boolean, default: true },
    showCentroids: { type: Boolean, default: false },
    showFlows: { type: Boolean, default: false },
    mapSettings: { type: Object, default: () => ({}) },
    modeColors: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
    activityColors: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
    thumbnail: { type: Boolean, default: false },
    selectedRequestId: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  emits: ['request-selected', 'cluster-selected', 'time-changed', 'color-changed'],
  data() {
    return {
      localColorBy: this.colorBy,
      localShowBoundaries: this.showBoundaries,
      localShowCentroids: this.showCentroids,
      localShowFlows: this.showFlows,
      viewId: Math.floor(1e12 * Math.random()),
    }
  },
  methods: {
    formatTime(seconds: number): string {
      return formatTimeMinutes(seconds)
    },
    handleColorChange() {
      this.$emit('color-changed', this.localColorBy)
    },
    handleLayerChange() {
      // Emit layer visibility changes if needed
    },
    handleRequestSelected(paxId: string) {
      this.$emit('request-selected', paxId)
    },
    handleClusterSelected(clusterId: number) {
      this.$emit('cluster-selected', clusterId)
    },
  },
})
</script>

<style scoped lang="scss">
.requests-map {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #e8e8e8;
}

.map-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;

  p {
    margin: 0.25rem;
    font-size: 0.9rem;
  }
}

.map-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 1rem;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 1000;

  .control-group {
    margin-bottom: 0.75rem;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-weight: bold;
      margin-bottom: 0.25rem;
      font-size: 0.85rem;
    }

    select {
      width: 100%;
      padding: 0.25rem;
      border: 1px solid #ccc;
      border-radius: 3px;
    }

    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      label {
        display: flex;
        align-items: center;
        font-weight: normal;
        margin: 0;

        input {
          margin-right: 0.5rem;
        }
      }
    }
  }
}

.time-slider-container {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 1000;

  p {
    margin: 0;
    font-size: 0.85rem;
  }
}
</style>

<template lang="pug">
.deck-map
  .map-container(:id="`map-${viewId}`")
  .deck-tooltip(v-if="tooltipHTML" v-html="tooltipHTML" :style="tooltipStyle")
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { LineLayer, GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { color } from 'd3-color'

import globalStore from '@/store'
import type { Request, ClusterBoundary, ColorByMode } from '../CommuterClusteringConfig'

const BASE_URL = import.meta.env.BASE_URL

export default defineComponent({
  name: 'DeckMapComponent',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    clusters: { type: Array as PropType<ClusterBoundary[]>, required: true },
    colorBy: { type: String as PropType<ColorByMode>, required: true },
    showBoundaries: { type: Boolean, required: true },
    showCentroids: { type: Boolean, required: true },
    showFlows: { type: Boolean, required: true },
    mapSettings: { type: Object, required: true },
    viewId: { type: Number, required: true },
    modeColors: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
    activityColors: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
    selectedRequestId: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  emits: ['request-selected', 'cluster-selected'],

  data() {
    return {
      mymap: null as maplibregl.Map | null,
      deckOverlay: null as InstanceType<typeof MapboxOverlay> | null,
      globalState: globalStore.state,
      tooltipHTML: '',
      tooltipStyle: {
        position: 'absolute',
        padding: '8px 12px',
        display: 'block',
        top: 0,
        left: 0,
        color: globalStore.state.isDarkMode ? '#ccc' : '#223',
        backgroundColor: globalStore.state.isDarkMode ? '#2a3c4f' : 'white',
        borderRadius: '4px',
        fontSize: '0.85rem',
        pointerEvents: 'none',
        zIndex: 20000,
      } as any,
    }
  },

  watch: {
    layers() {
      this.deckOverlay?.setProps({
        layers: this.layers,
      })
    },

    'globalState.isDarkMode'() {
      const style = `${BASE_URL}map-styles/${this.globalState.isDarkMode ? 'dark' : 'positron'}.json`
      this.mymap?.setStyle(style)
    },
  },

  computed: {
    dark() {
      return this.globalState.isDarkMode
    },

    // Convert requests to line segments for O-D flow visualization
    requestLines() {
      return this.requests.map((req: Request) => ({
        source: [req.origin_lon, req.origin_lat],
        target: [req.dest_lon, req.dest_lat],
        requestId: req.request_id || req.pax_id,
        paxId: req.pax_id,
        mode: req.main_mode || req.mode,
        activity: req.start_activity_type,
        price: req.max_price,
        detour: req.max_detour,
      }))
    },

    // Convert requests to origin/destination points
    requestPoints() {
      const origins = this.requests.map((req: Request) => ({
        position: [req.origin_lon, req.origin_lat],
        requestId: req.request_id || req.pax_id,
        paxId: req.pax_id,
        type: 'origin',
        mode: req.main_mode || req.mode,
      }))

      const destinations = this.requests.map((req: Request) => ({
        position: [req.dest_lon, req.dest_lat],
        requestId: req.request_id || req.pax_id,
        paxId: req.pax_id,
        type: 'destination',
        mode: req.main_mode || req.mode,
      }))

      return [...origins, ...destinations]
    },

    // Cluster centroids for labels
    clusterCentroids() {
      return this.clusters
        .filter((cluster: ClusterBoundary) => cluster.properties.centroid)
        .map((cluster: ClusterBoundary) => ({
          position: cluster.properties.centroid,
          clusterId: cluster.properties.cluster_id,
          count: cluster.properties.num_requests || 0,
        }))
    },

    layers() {
      const layers = []

      // CLUSTER BOUNDARIES (POLYGONS)
      if (this.showBoundaries && this.clusters.length > 0) {
        layers.push(
          new GeoJsonLayer({
            id: 'cluster-boundaries',
            data: {
              type: 'FeatureCollection',
              features: this.clusters,
            },
            getFillColor: [100, 150, 200, 50],
            getLineColor: this.dark ? [180, 200, 220] : [80, 120, 160],
            getLineWidth: 2,
            lineWidthUnits: 'pixels',
            stroked: true,
            filled: true,
            pickable: true,
            autoHighlight: true,
          })
        )
      }

      // O-D FLOW LINES
      if (this.showFlows && this.requestLines.length > 0) {
        layers.push(
          new LineLayer({
            id: 'request-flows',
            data: this.requestLines,
            getSourcePosition: (d: any) => d.source,
            getTargetPosition: (d: any) => d.target,
            getColor: (d: any) => this.getLineColorWithHighlight(d),
            getWidth: (d: any) => this.isRequestSelected(d.requestId) ? 3 : 1.5,
            widthUnits: 'pixels',
            widthMinPixels: 1,
            widthMaxPixels: 8,
            pickable: true,
            autoHighlight: true,
            opacity: 1,
          })
        )
      }

      // ORIGIN/DESTINATION POINTS
      if (!this.showFlows && this.requestPoints.length > 0) {
        layers.push(
          new ScatterplotLayer({
            id: 'request-points',
            data: this.requestPoints,
            getPosition: (d: any) => d.position,
            getRadius: (d: any) => this.isRequestSelected(d.requestId) ? 100 : 50,
            radiusUnits: 'meters',
            radiusMinPixels: 3,
            radiusMaxPixels: 15,
            getFillColor: (d: any) => this.getPointColorWithHighlight(d),
            pickable: true,
            autoHighlight: true,
            opacity: 1,
          })
        )
      }

      // CLUSTER CENTROIDS (if enabled)
      if (this.showCentroids && this.clusterCentroids.length > 0) {
        layers.push(
          new ScatterplotLayer({
            id: 'cluster-centroids',
            data: this.clusterCentroids,
            getPosition: (d: any) => d.position,
            getRadius: 100,
            radiusUnits: 'meters',
            radiusMinPixels: 6,
            radiusMaxPixels: 15,
            getFillColor: [255, 140, 0],
            pickable: true,
            opacity: 0.9,
          })
        )

        // Cluster labels
        layers.push(
          new TextLayer({
            id: 'cluster-labels',
            data: this.clusterCentroids,
            getPosition: (d: any) => d.position,
            getText: (d: any) => `${d.clusterId}`,
            getSize: 14,
            getColor: this.dark ? [255, 255, 255] : [0, 0, 0],
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            pickable: false,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            outlineWidth: 2,
            outlineColor: this.dark ? [0, 0, 0] : [255, 255, 255],
          })
        )
      }

      return layers
    },
  },

  mounted() {
    const style = `${BASE_URL}map-styles/${this.globalState.isDarkMode ? 'dark' : 'positron'}.json`
    const container = `map-${this.viewId}`

    const center = this.mapSettings.center || [11.5, 48.15]
    const zoom = this.mapSettings.zoom || 10

    this.mymap = new maplibregl.Map({
      container,
      style,
      center: center as [number, number],
      zoom,
      bearing: this.mapSettings.bearing || 0,
      pitch: this.mapSettings.pitch || 0,
    })

    this.mymap.on('style.load', () => {
      this.deckOverlay = new MapboxOverlay({
        interleaved: false,
        useDevicePixels: true,
        layers: this.layers,
        pickingRadius: 5,
        onClick: this.handleClick,
        onHover: this.getTooltip,
        getCursor: (c: any) => {
          return c.isHovering ? 'pointer' : 'grab'
        },
      })
      this.mymap?.addControl(this.deckOverlay)
    })
  },

  beforeUnmount() {
    if (this.deckOverlay) this.mymap?.removeControl(this.deckOverlay)
    this.mymap?.remove()
  },

  methods: {
    isRequestSelected(requestId: string | number): boolean {
      if (this.selectedRequestId === null) return false
      return String(this.selectedRequestId) === String(requestId)
    },

    getLineColor(d: any): [number, number, number] {
      if (this.colorBy === 'mode') {
        return this.getModeColor(d.mode)
      } else if (this.colorBy === 'activity') {
        return this.getActivityColor(d.activity)
      } else if (this.colorBy === 'price') {
        return this.getPriceColor(d.price)
      } else if (this.colorBy === 'detour') {
        return this.getDetourColor(d.detour)
      }
      return [150, 150, 150]
    },

    getLineColorWithHighlight(d: any): [number, number, number, number] {
      const baseColor = this.getLineColor(d)
      const isSelected = this.isRequestSelected(d.requestId)

      // If nothing is selected, show all at full opacity
      if (this.selectedRequestId === null) {
        return [...baseColor, 255] as [number, number, number, number]
      }

      // If this request is selected, full saturation and opacity
      if (isSelected) {
        return [...baseColor, 255] as [number, number, number, number]
      }

      // Otherwise, reduce opacity significantly (low-light)
      return [...baseColor, 40] as [number, number, number, number]
    },

    getPointColorWithHighlight(d: any): [number, number, number, number] {
      const baseColor = d.type === 'origin' ? [50, 150, 50] : [200, 50, 50]
      const isSelected = this.isRequestSelected(d.requestId)

      // If nothing is selected, show all at full opacity
      if (this.selectedRequestId === null) {
        return [...baseColor, 180] as [number, number, number, number]
      }

      // If this request is selected, full opacity
      if (isSelected) {
        return [...baseColor, 255] as [number, number, number, number]
      }

      // Otherwise, reduce opacity significantly (low-light)
      return [...baseColor, 40] as [number, number, number, number]
    },

    getModeColor(mode: string): [number, number, number] {
      const modeColorMap: Record<string, string> = {
        car: this.modeColors.car || '#ff4444',
        pt: this.modeColors.pt || '#4477ff',
        bike: this.modeColors.bike || '#44ff77',
        walk: this.modeColors.walk || '#ffbb44',
        ...this.modeColors,
      }
      return this.colorToRGB(modeColorMap[mode] || '#777777')
    },

    getActivityColor(activity: string): [number, number, number] {
      const activityColorMap: Record<string, string> = {
        home: this.activityColors.home || '#4477ff',
        work: this.activityColors.work || '#ff4477',
        education: this.activityColors.education || '#44ff77',
        shopping: this.activityColors.shopping || '#ff7744',
        leisure: this.activityColors.leisure || '#aa44ff',
        ...this.activityColors,
      }
      return this.colorToRGB(activityColorMap[activity] || '#777777')
    },

    getPriceColor(price: number): [number, number, number] {
      // Green to red gradient based on price (0-5 EUR/km range)
      const normalized = Math.min(price / 5, 1)
      const r = Math.floor(normalized * 255)
      const g = Math.floor((1 - normalized) * 255)
      return [r, g, 50]
    },

    getDetourColor(detour: number): [number, number, number] {
      // Green to red gradient based on detour factor (1.0 - 2.0 range)
      const normalized = Math.min((detour - 1.0) / 1.0, 1)
      const r = Math.floor(normalized * 255)
      const g = Math.floor((1 - normalized) * 255)
      return [r, g, 50]
    },

    colorToRGB(colorString: string): [number, number, number] {
      try {
        const rgb = color(colorString)
        if (!rgb) return [0, 0, 0]
        return [rgb.r, rgb.g, rgb.b]
      } catch (error) {
        return [0, 0, 0]
      }
    },

    handleClick(info: any) {
      if (!info.object) return

      if (info.layer?.id === 'request-flows' || info.layer?.id === 'request-points') {
        const requestId = info.object.requestId
        this.$emit('request-selected', requestId)
      } else if (info.layer?.id === 'cluster-boundaries') {
        const clusterId = info.object.properties?.cluster_id
        if (clusterId !== undefined) {
          this.$emit('cluster-selected', clusterId)
        }
      }
    },

    getTooltip(info: any) {
      if (!info.object) {
        this.tooltipHTML = ''
        return
      }

      if (info.layer?.id === 'request-flows' || info.layer?.id === 'request-points') {
        const d = info.object
        this.tooltipHTML = `
          <strong>Request: ${d.requestId}</strong><br/>
          Pax: ${d.paxId}<br/>
          Mode: ${d.mode || 'N/A'}<br/>
          Activity: ${d.activity || 'N/A'}
        `
      } else if (info.layer?.id === 'cluster-boundaries') {
        const props = info.object.properties
        this.tooltipHTML = `
          <strong>Cluster ${props.cluster_id}</strong><br/>
          Requests: ${props.num_requests || 0}
        `
      } else if (info.layer?.id === 'cluster-centroids') {
        const d = info.object
        this.tooltipHTML = `
          <strong>Cluster ${d.clusterId}</strong><br/>
          Requests: ${d.count}
        `
      } else {
        this.tooltipHTML = ''
        return
      }

      this.tooltipStyle.left = `${info.x}px`
      this.tooltipStyle.top = `${info.y}px`
    },
  },
})
</script>

<style scoped lang="scss">
.deck-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
}

.deck-tooltip {
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  max-width: 300px;
  line-height: 1.4;
}
</style>

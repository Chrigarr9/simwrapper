<template lang="pug">
.requests-map-container
  .map(:id="mapId")
  .map-overlay(v-if="isLoading")
    p Loading map...
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import maplibregl from 'maplibre-gl'
import { LineLayer, PolygonLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'

import type { Request, ClusterBoundary } from '../CommuterRequestsConfig'
import { getModeColorRGB } from '../utils/colorSchemes'

export default defineComponent({
  name: 'RequestsMap',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true }, // All requests
    filteredRequests: { type: Array as PropType<Request[]>, required: true }, // Filtered requests
    geometries: { type: Array as PropType<any[]>, required: true },
    clusterBoundaries: { type: Array as PropType<ClusterBoundary[]>, required: true },
    selectedClusters: { type: Set as PropType<Set<string | number>>, required: true },
    selectedRequestIds: { type: Set as PropType<Set<string>>, required: true },
    hoveredRequestId: { type: String as PropType<string | null>, default: null },
    clusterType: { type: String as PropType<'origin' | 'destination' | 'spatial'>, required: true },
    colorBy: { type: String as PropType<'mode' | 'activity' | 'detour'>, default: 'mode' },
    showComparison: { type: Boolean, default: false },
    hasActiveFilters: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },

  data() {
    return {
      mapId: `requests-map-${Math.random().toString(36).substring(7)}`,
      map: null as maplibregl.Map | null,
      deckOverlay: null as MapboxOverlay | null,
      isLoading: true,
    }
  },

  mounted() {
    this.initMap()
  },

  beforeUnmount() {
    if (this.map) {
      this.map.remove()
    }
  },

  watch: {
    requests() {
      this.updateLayers()
    },
    geometries() {
      this.updateLayers()
    },
    clusterBoundaries() {
      this.updateLayers()
    },
    filteredRequests() {
      this.updateLayers()
    },
    selectedClusters: {
      handler() {
        this.updateLayers()
      },
      deep: true,
    },
    selectedRequestIds: {
      handler() {
        this.updateLayers()
      },
      deep: true,
    },
    hoveredRequestId() {
      this.updateLayers()
    },
    hasActiveFilters() {
      this.updateLayers()
    },
    colorBy() {
      this.updateLayers()
    },
    isDarkMode(newVal) {
      // Update map style when theme changes
      if (this.map) {
        const mapStyle = newVal
          ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
          : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
        this.map.setStyle(mapStyle)
      }
    },
  },

  methods: {
    initMap() {
      // Initialize MapLibre map with dynamic style based on theme
      const mapStyle = this.isDarkMode
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

      this.map = new maplibregl.Map({
        container: this.mapId,
        style: mapStyle,
        center: [13.4, 52.52], // Berlin center (adjust based on data)
        zoom: 10,
      })

      this.map.on('load', () => {
        this.isLoading = false
        this.initDeckOverlay()
        this.updateLayers()
        this.fitBounds()
      })
    },

    initDeckOverlay() {
      if (!this.map) return

      this.deckOverlay = new MapboxOverlay({
        layers: [],
        getTooltip: ({ object }: any) => {
          if (object) {
            // Check if it's a request line (has request_id in properties)
            if (object.properties && object.properties.request_id) {
              const props = object.properties
              return {
                html: `
                  <div>
                    <b>Request ${props.request_id}</b><br/>
                    Mode: ${props.main_mode || props.mode || 'N/A'}<br/>
                    Origin Cluster: ${props.origin_cluster || 'N/A'}<br/>
                    Dest Cluster: ${props.destination_cluster || 'N/A'}
                  </div>
                `,
                style: {
                  backgroundColor: this.isDarkMode ? '#1f2937' : 'white',
                  color: this.isDarkMode ? '#e5e7eb' : '#111827',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  border: this.isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                },
              }
            }
            // Check if it's a cluster polygon (has cluster_id in properties)
            else if (object.properties && object.properties.cluster_id !== undefined) {
              const props = object.properties
              return {
                html: `
                  <div>
                    <b>Cluster ${props.cluster_id}</b><br/>
                    Requests: ${props.num_requests || 0}
                  </div>
                `,
                style: {
                  backgroundColor: this.isDarkMode ? '#1f2937' : 'white',
                  color: this.isDarkMode ? '#e5e7eb' : '#111827',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  border: this.isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                },
              }
            }
          }
          return null
        },
      })

      this.map.addControl(this.deckOverlay as any)
    },

    updateLayers() {
      if (!this.deckOverlay) return

      console.log('RequestsMap.updateLayers called:', {
        geometriesCount: this.geometries.length,
        requestsCount: this.requests.length,
        clusterBoundariesCount: this.clusterBoundaries.length,
      })

      const layers = []

      // Cluster polygons layer (behind request lines)
      if (this.clusterBoundaries.length > 0) {
        // Convert Vue reactive objects to plain objects and filter to Polygon/MultiPolygon only
        const validBoundaries = this.clusterBoundaries
          .map((d: any) => {
            // Convert to plain object to avoid Vue reactivity issues with Deck.gl
            return JSON.parse(JSON.stringify(d))
          })
          .filter((d: any) => {
            if (!d.geometry || !d.geometry.coordinates) {
              console.warn('Invalid cluster geometry:', d)
              return false
            }
            // PolygonLayer only accepts Polygon and MultiPolygon (not Point)
            if (d.geometry.type !== 'Polygon' && d.geometry.type !== 'MultiPolygon') {
              return false
            }
            return true
          })

        if (validBoundaries.length === 0) {
          console.warn('No valid cluster boundaries found')
        } else {
          layers.push(
            new PolygonLayer({
              id: 'cluster-boundaries',
              data: validBoundaries,
              pickable: true,
              stroked: true,
              filled: true,
              wireframe: true,
              lineWidthMinPixels: 2,
              getPolygon: (d: any) => {
                try {
                  // Handle different GeoJSON geometry types
                  const coords = d.geometry.coordinates
                  // For Polygon, coords[0] is the outer ring
                  // For MultiPolygon, coords is array of polygons
                  if (d.geometry.type === 'Polygon') {
                    return coords[0]
                  } else if (d.geometry.type === 'MultiPolygon') {
                    // Return first polygon's outer ring for simplicity
                    return coords[0][0]
                  }
                  return coords
                } catch (error) {
                  console.error('Error parsing polygon coordinates:', d, error)
                  return []
                }
              },
            getFillColor: (d: any) => {
              const isSelected = this.selectedClusters.has(d.properties.cluster_id)
              // Increased opacity for better visibility
              return isSelected ? [59, 130, 246, 120] : [156, 163, 175, 60]
            },
            getLineColor: (d: any) => {
              const isSelected = this.selectedClusters.has(d.properties.cluster_id)
              // Stronger contrast for borders
              return isSelected ? [59, 130, 246, 255] : [100, 116, 139, 180]
            },
            getLineWidth: (d: any) => {
              const isSelected = this.selectedClusters.has(d.properties.cluster_id)
              return isSelected ? 4 : 2
            },
              onClick: (info: any) => {
                if (info.object) {
                  this.$emit('cluster-clicked', info.object.properties.cluster_id)
                }
              },
            })
          )
        }
      }

      // Request lines layer - always show all requests, highlight filtered/hovered
      if (this.geometries.length > 0) {
        console.log('Creating LineLayer with geometries:', {
          count: this.geometries.length,
          sample: this.geometries[0],
        })
        
        // Create Set of filtered request IDs for quick lookup
        const filteredRequestIds = new Set(this.filteredRequests.map(r => String(r.request_id)))
        
        layers.push(
          new LineLayer({
            id: 'request-lines',
            data: this.geometries,
            pickable: true,
            getWidth: (d: any) => {
              const requestId = String(d.properties.request_id)
              const isHovered = requestId === this.hoveredRequestId
              const isFiltered = filteredRequestIds.has(requestId)
              
              // Hover: increase width
              if (isHovered) return 6
              // Filtered (passes current filters): increase width
              if (isFiltered) return 4
              // Unfiltered when filters active: thinner
              if (this.hasActiveFilters && !isFiltered) return 1
              // Default (no active filters)
              return 2
            },
            getSourcePosition: (d: any) => d.geometry.coordinates[0],
            getTargetPosition: (d: any) => d.geometry.coordinates[1],
            getColor: (d: any) => {
              const requestId = String(d.properties.request_id)
              const isHovered = requestId === this.hoveredRequestId
              const isFiltered = filteredRequestIds.has(requestId)
              
              const mode = d.properties.main_mode || d.properties.mode || 'default'
              const baseColor = getModeColorRGB(mode, 255)
              
              // Hover: full saturation, full opacity
              if (isHovered) return [...baseColor.slice(0, 3), 255]
              
              // Filtered (passes current filters): high saturation, high opacity
              if (isFiltered) {
                return [...baseColor.slice(0, 3), 220]
              }
              
              // Unfiltered when filters active: low saturation, low opacity
              if (this.hasActiveFilters && !isFiltered) {
                // Desaturate by averaging with gray and reduce opacity
                const desaturated = baseColor.map(c => Math.round((c + 180) / 2))
                return [...desaturated.slice(0, 3), 60]
              }
              
              // Default: normal saturation and opacity
              return [...baseColor.slice(0, 3), 200]
            },
            onClick: (info: any) => {
              if (info.object) {
                this.$emit('request-clicked', info.object.properties.request_id)
              }
            },
            onHover: (info: any) => {
              // Emit hover event (null when no longer hovering)
              this.$emit('request-hovered', info.object ? info.object.properties.request_id : null)
            },
            autoHighlight: false, // We handle highlighting manually
            updateTriggers: {
              getWidth: [this.hoveredRequestId, this.selectedRequestIds, this.hasActiveFilters, this.filteredRequests],
              getColor: [this.hoveredRequestId, this.selectedRequestIds, this.hasActiveFilters, this.filteredRequests],
            },
          })
        )
      } else {
        console.log('No geometries to display on map')
      }

      this.deckOverlay.setProps({ layers })
    },

    fitBounds() {
      if (!this.map || this.geometries.length === 0) return

      // Calculate bounds from geometries
      const bounds = new maplibregl.LngLatBounds()

      this.geometries.forEach((feature: any) => {
        feature.geometry.coordinates.forEach((coord: [number, number]) => {
          bounds.extend(coord)
        })
      })

      this.map.fitBounds(bounds, { padding: 50 })
    },
  },
})
</script>

<style scoped lang="scss">
.requests-map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  width: 100%;
  height: 100%;
}

.map-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 1000;

  p {
    font-size: 1.2rem;
    color: #666;
  }
}
</style>

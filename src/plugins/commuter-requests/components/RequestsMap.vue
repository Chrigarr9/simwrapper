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
import { LineLayer, PolygonLayer, ArcLayer, ScatterplotLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PathStyleExtension } from '@deck.gl/extensions'

import type { Request, ClusterBoundary, ColorByConfig } from '../CommuterRequestsConfig'
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
    colorByAttribute: { type: String, default: 'main_mode' },
    colorByConfig: { type: Object as PropType<ColorByConfig>, default: undefined },
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
      hoveredClusterId: null as number | null, // Track hovered cluster for highlighting
      hoveredFlowId: null as string | null, // Track hovered flow for highlighting
    }
  },

  computed: {
    // Extract flow features from cluster boundaries
    clusterFlows(): any[] {
      if (!this.clusterBoundaries || this.clusterBoundaries.length === 0) {
        return []
      }

      // Filter for flow features (LineStrings with geometry_type="flow" and cluster_type="od")
      const flows = this.clusterBoundaries
        .map((d: any) => JSON.parse(JSON.stringify(d))) // Deep clone to avoid reactivity issues
        .filter((d: any) => {
          return (
            d.properties?.geometry_type === 'flow' &&
            d.properties?.cluster_type === 'od' &&
            d.geometry?.type === 'LineString'
          )
        })

      console.log('Computed clusterFlows:', {
        totalBoundaries: this.clusterBoundaries.length,
        flowsFound: flows.length,
        clusterType: this.clusterType,
      })

      return flows
    },

    // Filter flows based on selected clusters
    filteredClusterFlows(): any[] {
      if (this.selectedClusters.size === 0) {
        // No selection: show all flows
        return this.clusterFlows
      }

      // Filter to only show flows where the cluster_id is selected
      return this.clusterFlows.filter((flow: any) => {
        const clusterId = flow.properties.cluster_id
        return this.selectedClusters.has(clusterId) || this.selectedClusters.has(String(clusterId))
      })
    },
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
    clusterBoundaries(newVal, oldVal) {
      console.log('RequestsMap: clusterBoundaries changed:', {
        oldLength: oldVal?.length || 0,
        newLength: newVal?.length || 0,
        clusterType: this.clusterType
      })
      this.updateLayers()
    },
    clusterType(newVal, oldVal) {
      console.log('RequestsMap: clusterType prop changed:', { from: oldVal, to: newVal })
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
    hoveredClusterId() {
      this.updateLayers()
    },
    hoveredFlowId() {
      this.updateLayers()
    },
    hasActiveFilters() {
      this.updateLayers()
    },
    colorBy(newVal, oldVal) {
      console.log('RequestsMap: colorBy prop changed:', { from: oldVal, to: newVal })
      this.updateLayers()
    },
    colorByAttribute(newVal, oldVal) {
      console.log('RequestsMap: colorByAttribute prop changed:', { from: oldVal, to: newVal })
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
            // Check if it's a flow arrow (has geometry_type="flow" in properties)
            if (object.properties && object.properties.geometry_type === 'flow') {
              const props = object.properties
              return {
                html: `
                  <div>
                    <b>Cluster Flow ${props.cluster_id}</b><br/>
                    Requests: ${props.num_requests || 0}<br/>
                    Avg Travel Time: ${props.mean_travel_time ? Math.round(props.mean_travel_time / 60) + ' min' : 'N/A'}<br/>
                    Avg Distance: ${props.mean_distance ? (props.mean_distance / 1000).toFixed(1) + ' km' : 'N/A'}
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
              const clusterType = props.cluster_type || 'unknown'
              const boundaryPart = props.boundary_part // 'origin' or 'destination' for OD clusters

              let title = `Cluster ${props.cluster_id}`
              let extraInfo = ''

              if (clusterType === 'od' && boundaryPart) {
                // OD cluster with boundary part
                title = `OD Cluster ${props.cluster_id} - ${boundaryPart.charAt(0).toUpperCase() + boundaryPart.slice(1)}`
                extraInfo = `Part: ${boundaryPart}<br/>`
              } else if (clusterType === 'origin') {
                title = `Origin Cluster ${props.cluster_id}`
              } else if (clusterType === 'destination') {
                title = `Destination Cluster ${props.cluster_id}`
              } else if (clusterType === 'spatial') {
                title = `Spatial Cluster ${props.cluster_id}`
              } else if (clusterType === 'temporal') {
                title = `Temporal Cluster ${props.cluster_id}`
              }

              return {
                html: `
                  <div>
                    <b>${title}</b><br/>
                    Requests: ${props.num_requests || 0}<br/>
                    Type: ${clusterType}<br/>
                    ${extraInfo}
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
            // Check if it's a request line (has request_id in properties)
            else if (object.properties && object.properties.request_id) {
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
                const clusterId = d.properties.cluster_id
                const isSelected = this.selectedClusters.has(clusterId)
                const isClusterHovered = this.hoveredClusterId === clusterId
                const isFlowHovered = this.hoveredFlowId === `${clusterId}`

                if (isSelected) {
                  return [59, 130, 246, 120] // Blue when selected
                }
                // Highlight cluster when either cluster or its flow is hovered
                if (isClusterHovered || isFlowHovered) {
                  return [251, 146, 60, 100] // Orange when hovered
                }
                return [156, 163, 175, 60] // Gray default
              },
              getLineColor: (d: any) => {
                const clusterId = d.properties.cluster_id
                const isSelected = this.selectedClusters.has(clusterId)
                const isClusterHovered = this.hoveredClusterId === clusterId
                const isFlowHovered = this.hoveredFlowId === `${clusterId}`

                if (isSelected) {
                  return [59, 130, 246, 255] // Blue border when selected
                }
                // Highlight cluster when either cluster or its flow is hovered
                if (isClusterHovered || isFlowHovered) {
                  return [251, 146, 60, 255] // Orange border when hovered
                }
                return [100, 116, 139, 180] // Gray default
              },
              getLineWidth: (d: any) => {
                const clusterId = d.properties.cluster_id
                const isSelected = this.selectedClusters.has(clusterId)
                const isClusterHovered = this.hoveredClusterId === clusterId
                const isFlowHovered = this.hoveredFlowId === `${clusterId}`

                if (isSelected) return 4 // Thick border when selected
                // Highlight cluster when either cluster or its flow is hovered
                if (isClusterHovered || isFlowHovered) return 3 // Medium border when hovered
                return 2 // Default border
              },
              onHover: (info: any) => {
                if (info.object) {
                  const clusterId = info.object.properties.cluster_id
                  const clusterType = info.object.properties.cluster_type
                  const boundaryPart = info.object.properties.boundary_part

                  console.log('Cluster hover:', { clusterId, clusterType, boundaryPart })
                  this.hoveredClusterId = clusterId
                } else {
                  this.hoveredClusterId = null
                }
              },
              onClick: (info: any) => {
                if (info.object) {
                  this.$emit('cluster-clicked', info.object.properties.cluster_id)
                }
              },
              updateTriggers: {
                getFillColor: [this.selectedClusters, this.hoveredClusterId, this.hoveredFlowId],
                getLineColor: [this.selectedClusters, this.hoveredClusterId, this.hoveredFlowId],
                getLineWidth: [this.selectedClusters, this.hoveredClusterId, this.hoveredFlowId],
              },
            })
          )
        }
      }

      // Cluster flow arrows layer - show when viewing spatial (OD) clusters
      if (this.clusterType === 'spatial' && this.filteredClusterFlows.length > 0) {
        console.log('Creating flow arrows layer:', {
          totalFlows: this.clusterFlows.length,
          filteredFlows: this.filteredClusterFlows.length,
          selectedClusters: Array.from(this.selectedClusters),
        })

        // Calculate max num_requests for width scaling
        const maxRequests = Math.max(
          ...this.filteredClusterFlows.map((f: any) => f.properties.num_requests || 1)
        )

        // Flow arrows (arcs)
        layers.push(
          new ArcLayer({
            id: 'cluster-flows',
            data: this.filteredClusterFlows,
            pickable: true,
            // Arc configuration for curved lines
            greatCircle: false, // Use simple arcs, not great circle paths
            getWidth: (d: any) => {
              const flowId = `${d.properties.cluster_id}`
              const clusterId = d.properties.cluster_id
              const isFlowHovered = flowId === this.hoveredFlowId
              const isClusterHovered = this.hoveredClusterId === clusterId
              const isSelected = this.selectedClusters.has(clusterId) || this.selectedClusters.has(String(clusterId))

              // Scale width based on num_requests (min 4, max 14)
              const numRequests = d.properties.num_requests || 1
              const normalizedWidth = (numRequests / maxRequests) * 10 + 4

              // Increase width for hovered or selected flows (cluster hover also highlights flow)
              if (isFlowHovered || isClusterHovered) return normalizedWidth * 1.5
              if (isSelected) return normalizedWidth * 1.2
              return normalizedWidth
            },
            getSourcePosition: (d: any) => d.geometry.coordinates[0],
            getTargetPosition: (d: any) => d.geometry.coordinates[1],
            getSourceColor: (d: any) => {
              const flowId = `${d.properties.cluster_id}`
              const clusterId = d.properties.cluster_id
              const isSelected = this.selectedClusters.has(clusterId) || this.selectedClusters.has(String(clusterId))
              const isFlowHovered = flowId === this.hoveredFlowId
              const isClusterHovered = this.hoveredClusterId === clusterId

              if (isFlowHovered || isClusterHovered) {
                return [251, 146, 60, 255] // Orange when hovered (full opacity)
              }
              if (isSelected) {
                return [59, 130, 246, 200] // Blue when selected
              }
              return [156, 163, 175, 180] // Gray default
            },
            getTargetColor: (d: any) => {
              // Same color as source for uniform arc
              const flowId = `${d.properties.cluster_id}`
              const clusterId = d.properties.cluster_id
              const isSelected = this.selectedClusters.has(clusterId) || this.selectedClusters.has(String(clusterId))
              const isFlowHovered = flowId === this.hoveredFlowId
              const isClusterHovered = this.hoveredClusterId === clusterId

              if (isFlowHovered || isClusterHovered) {
                return [251, 146, 60, 255] // Orange when hovered (full opacity)
              }
              if (isSelected) {
                return [59, 130, 246, 200] // Blue when selected
              }
              return [156, 163, 175, 180] // Gray default
            },
            // Tilt parameter creates the arc curvature (0 = straight, 1 = max arc)
            getTilt: () => 25, // Slight upward tilt for visual distinction
            getHeight: () => 0.2, // needs hight to render tilted arcs
            onHover: (info: any) => {
              if (info.object) {
                const flowId = `${info.object.properties.cluster_id}`
                console.log('Flow hover:', { flowId, properties: info.object.properties })
                this.hoveredFlowId = flowId
              } else {
                this.hoveredFlowId = null
              }
            },
            onClick: (info: any) => {
              if (info.object) {
                // Clicking a flow arrow should select BOTH origin and destination clusters
                // They share the same cluster_id, so emit it to select both
                const clusterId = info.object.properties.cluster_id
                console.log('Flow arrow clicked - selecting cluster pair:', clusterId)
                this.$emit('cluster-clicked', clusterId)
              }
            },
            updateTriggers: {
              getWidth: [this.hoveredFlowId, this.hoveredClusterId, this.selectedClusters, this.filteredClusterFlows],
              getSourceColor: [this.hoveredFlowId, this.hoveredClusterId, this.selectedClusters, this.filteredClusterFlows],
              getTargetColor: [this.hoveredFlowId, this.hoveredClusterId, this.selectedClusters, this.filteredClusterFlows],
            },
          })
        )

        // Arrow tips at destinations (small circles to indicate direction)
        layers.push(
          new ScatterplotLayer({
            id: 'cluster-flow-arrows',
            data: this.filteredClusterFlows,
            pickable: true,
            radiusMinPixels: 10,
            radiusMaxPixels: 20,
            getPosition: (d: any) => d.geometry.coordinates[1], // Destination position
            getRadius: (d: any) => {
              const flowId = `${d.properties.cluster_id}`
              const clusterId = d.properties.cluster_id
              const isFlowHovered = flowId === this.hoveredFlowId
              const isClusterHovered = this.hoveredClusterId === clusterId
              const isSelected = this.selectedClusters.has(clusterId) || this.selectedClusters.has(String(clusterId))

              // Scale radius based on num_requests
              const numRequests = d.properties.num_requests || 1
              const normalizedRadius = (numRequests / maxRequests) * 4 + 3

              if (isFlowHovered || isClusterHovered) return normalizedRadius * 1.5
              if (isSelected) return normalizedRadius * 1.2
              return normalizedRadius
            },
            getFillColor: (d: any) => {
              const flowId = `${d.properties.cluster_id}`
              const clusterId = d.properties.cluster_id
              const isSelected = this.selectedClusters.has(clusterId) || this.selectedClusters.has(String(clusterId))
              const isFlowHovered = flowId === this.hoveredFlowId
              const isClusterHovered = this.hoveredClusterId === clusterId

              if (isFlowHovered || isClusterHovered) {
                return [251, 146, 60, 255] // Orange when hovered
              }
              if (isSelected) {
                return [59, 130, 246, 255] // Blue when selected (full opacity for tips)
              }
              return [156, 163, 175, 220] // Gray default
            },
            getLineColor: [255, 255, 255, 200], // White outline for visibility
            lineWidthMinPixels: 1,
            onHover: (info: any) => {
              if (info.object) {
                const flowId = `${info.object.properties.cluster_id}`
                this.hoveredFlowId = flowId
              } else {
                this.hoveredFlowId = null
              }
            },
            onClick: (info: any) => {
              if (info.object) {
                const clusterId = info.object.properties.cluster_id
                this.$emit('cluster-clicked', clusterId)
              }
            },
            updateTriggers: {
              getRadius: [this.hoveredFlowId, this.hoveredClusterId, this.selectedClusters, this.filteredClusterFlows],
              getFillColor: [this.hoveredFlowId, this.hoveredClusterId, this.selectedClusters, this.filteredClusterFlows],
            },
          })
        )
      }

      // Request lines layer - always show all requests, highlight filtered/hovered
      if (this.geometries.length > 0) {
        console.log('Creating LineLayer with geometries:', {
          count: this.geometries.length,
          sample: this.geometries[0],
        })

        // Create Set of filtered request IDs for quick lookup
        const filteredRequestIds = new Set(this.filteredRequests.map(r => String(r.request_id)))

        // Request lines
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

              // Get base color based on selected attribute
              const baseColor = this.getLineColor(d)

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
              getColor: [this.hoveredRequestId, this.selectedRequestIds, this.hasActiveFilters, this.filteredRequests, this.colorByAttribute],
            },
          })
        )

        // Direction indicator circles at destination (same pattern as cluster flows)
        layers.push(
          new ScatterplotLayer({
            id: 'request-destination-circles',
            data: this.geometries,
            pickable: true,
            radiusMinPixels: 3,
            radiusMaxPixels: 8,
            getPosition: (d: any) => d.geometry.coordinates[1], // Destination position
            getRadius: (d: any) => {
              const requestId = String(d.properties.request_id)
              const isHovered = requestId === this.hoveredRequestId
              const isFiltered = filteredRequestIds.has(requestId)

              // Base radius
              let radius = 3

              // Hover: increase radius
              if (isHovered) radius = 8
              // Filtered: increase radius slightly
              else if (isFiltered) radius = 5
              // Unfiltered when filters active: smaller
              else if (this.hasActiveFilters && !isFiltered) radius = 2

              return radius
            },
            getFillColor: (d: any) => {
              const requestId = String(d.properties.request_id)
              const isHovered = requestId === this.hoveredRequestId
              const isFiltered = filteredRequestIds.has(requestId)

              // Get base color based on selected attribute
              const baseColor = this.getLineColor(d)

              // Hover: full saturation, full opacity
              if (isHovered) return [...baseColor.slice(0, 3), 255]

              // Filtered (passes current filters): high saturation, high opacity
              if (isFiltered) {
                return [...baseColor.slice(0, 3), 240]
              }

              // Unfiltered when filters active: low saturation, low opacity
              if (this.hasActiveFilters && !isFiltered) {
                // Desaturate by averaging with gray and reduce opacity
                const desaturated = baseColor.map(c => Math.round((c + 180) / 2))
                return [...desaturated.slice(0, 3), 80]
              }

              // Default: normal saturation and opacity
              return [...baseColor.slice(0, 3), 220]
            },
            getLineColor: [255, 255, 255, 200], // White outline for visibility
            lineWidthMinPixels: 1,
            onClick: (info: any) => {
              if (info.object) {
                this.$emit('request-clicked', info.object.properties.request_id)
              }
            },
            onHover: (info: any) => {
              // Emit hover event (null when no longer hovering)
              this.$emit('request-hovered', info.object ? info.object.properties.request_id : null)
            },
            updateTriggers: {
              getRadius: [this.hoveredRequestId, this.selectedRequestIds, this.hasActiveFilters, this.filteredRequests],
              getFillColor: [this.hoveredRequestId, this.selectedRequestIds, this.hasActiveFilters, this.filteredRequests, this.colorByAttribute],
            },
          })
        )
      } else {
        console.log('No geometries to display on map')
      }

      this.deckOverlay.setProps({ layers })
    },

    getLineColor(feature: any): [number, number, number, number] {
      const value = feature.properties[this.colorByAttribute]

      // Debug logging (only log first few to avoid spam)
      if (Math.random() < 0.01) {
        console.log('getLineColor called:', {
          attribute: this.colorByAttribute,
          value,
          requestId: feature.properties.request_id
        })
      }

      // Get attribute configuration to determine type
      const attrConfig = this.getAttributeConfig(this.colorByAttribute)

      if (attrConfig?.type === 'categorical') {
        return this.getCategoricalColor(this.colorByAttribute, value)
      } else {
        // Numeric: use color scale
        return this.getNumericColor(value, attrConfig?.scale)
      }
    },

    getAttributeConfig(attribute: string) {
      // Find attribute config from colorByConfig
      if (!this.colorByConfig || !this.colorByConfig.attributes) {
        return null
      }
      return this.colorByConfig.attributes.find(attr => attr.attribute === attribute)
    },

    getCategoricalColor(attribute: string, value: any): [number, number, number, number] {
      // Mode coloring
      if (attribute === 'main_mode') {
        return getModeColorRGB(value || 'default', 255)
      }

      // Activity type coloring
      if (attribute === 'start_activity_type' || attribute === 'end_activity_type') {
        return this.getActivityColorRGB(value || 'other')
      }

      // Cluster coloring (categorical)
      if (['origin_cluster', 'destination_cluster', 'od_cluster', 'temporal_cluster', 'cluster'].includes(attribute)) {
        return this.getClusterColorRGB(value)
      }

      // Default: gray
      return [128, 128, 128, 255]
    },

    getNumericColor(value: number, scale?: [number, number]): [number, number, number, number] {
      // Handle missing or invalid values
      if (value === null || value === undefined || isNaN(value)) {
        return [200, 200, 200, 255] // Light gray for missing values
      }

      // Normalize value to 0-1
      let normalized = 0
      if (scale && scale.length === 2) {
        // Use provided scale
        const [min, max] = scale
        normalized = (value - min) / (max - min)
      } else {
        // Auto-scale: find min/max in current filtered data
        const values = this.filteredRequests
          .map(r => r[this.colorByAttribute])
          .filter(v => typeof v === 'number' && !isNaN(v))

        if (values.length === 0) {
          return [128, 128, 128, 255]
        }

        const min = Math.min(...values)
        const max = Math.max(...values)

        if (min === max) {
          normalized = 0.5 // All values are the same
        } else {
          normalized = (value - min) / (max - min)
        }
      }

      // Clamp to 0-1
      normalized = Math.max(0, Math.min(1, normalized))

      // Apply viridis color scale
      return this.viridisColorScale(normalized)
    },

    viridisColorScale(t: number): [number, number, number, number] {
      // Simplified viridis color scale
      // t: 0 (purple) -> 1 (yellow)
      // Based on viridis color map approximation
      const r = Math.round(255 * (0.267004 + t * (0.534773 + t * (0.198970 - t * 0.088840))))
      const g = Math.round(255 * (0.004874 + t * (1.392667 + t * (-0.398406 + t * 0.200716))))
      const b = Math.round(255 * (0.329415 + t * (-0.794048 + t * (0.464556 - t * 0.126100))))

      return [r, g, b, 255]
    },

    getActivityColorRGB(activity: string): [number, number, number, number] {
      const activityColors: { [key: string]: [number, number, number, number] } = {
        home: [68, 119, 255, 255],      // #4477ff
        work: [255, 68, 119, 255],      // #ff4477
        education: [68, 255, 119, 255], // #44ff77
        shopping: [255, 119, 68, 255],  // #ff7744
        leisure: [170, 68, 255, 255],   // #aa44ff
        other: [119, 119, 119, 255],    // #777777
      }
      return activityColors[activity] || [153, 153, 153, 255]
    },

    getClusterColorRGB(clusterId: any): [number, number, number, number] {
      // Simple hash-based color generation for clusters
      if (clusterId === undefined || clusterId === null) {
        return [128, 128, 128, 255]
      }

      const hash = String(clusterId).split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc)
      }, 0)

      const hue = Math.abs(hash % 360)
      const rgb = this.hslToRgb(hue / 360, 0.7, 0.5)
      return [...rgb, 255] as [number, number, number, number]
    },

    hslToRgb(h: number, s: number, l: number): [number, number, number] {
      let r, g, b

      if (s === 0) {
        r = g = b = l
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1
          if (t > 1) t -= 1
          if (t < 1/6) return p + (q - p) * 6 * t
          if (t < 1/2) return q
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
          return p
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1/3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1/3)
      }

      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
    },

    fitBounds() {
      if (!this.map || this.geometries.length === 0) return

      // Calculate bounds from geometries (LineString with 2 points: origin and destination)
      const bounds = new maplibregl.LngLatBounds()

      this.geometries.forEach((feature: any) => {
        if (!feature.geometry || !feature.geometry.coordinates) return

        // For LineString geometry, coordinates is an array of [lon, lat] points
        const coords = feature.geometry.coordinates

        // Extend bounds with each point (ensure we're passing [lon, lat] array)
        coords.forEach((coord: any) => {
          // Validate coordinate is a proper [lon, lat] array
          if (Array.isArray(coord) && coord.length >= 2) {
            bounds.extend([coord[0], coord[1]] as [number, number])
          }
        })
      })

      // Only fit bounds if we have valid bounds
      if (!bounds.isEmpty()) {
        this.map.fitBounds(bounds, { padding: 50 })
      }
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

/**
 * LayerColoringManager - Adaptive layer coloring based on visibility relationships
 *
 * This manager analyzes which layers are visible and determines coloring roles:
 * - Primary: Layer receives full colorBy data-driven coloring
 * - Secondary: Layer receives subdued coloring (future use)
 * - Neutral: Layer receives theme-neutral styling
 *
 * The key insight is that layers sharing the same linkage.geoProperty form
 * a "layer group" - they are semantically connected and should coordinate
 * their coloring behavior.
 *
 * Usage:
 *   import { computeAllLayerRoles } from './LayerColoringManager'
 *
 *   // In MapCard's updateLayers()
 *   const roles = computeAllLayerRoles(visibleLayers, 'auto')
 *   const roleForLayer = roles.get(layerName)
 */

// Debug flag - set to true to enable console logging for layer role computation
// Helps diagnose why layers get certain roles (primary/neutral)
const DEBUG_LAYER_COLORING = false

import type {
  ColorByRole,
  LayerStrategy,
  LayerColoringRole,
  LayerGroup,
  LayerConfigForColoring,
} from '../types/layerColoring'

/**
 * Group layers by their shared linkage.geoProperty
 *
 * Layers with the same geoProperty are semantically related - for example,
 * origin clusters and OD arcs might both use "cluster_id" as their geoProperty.
 *
 * Layers without a geoProperty get their own standalone group.
 *
 * @param visibleLayers - Array of currently visible layer configs
 * @returns Map of geoProperty to LayerGroup
 */
export function computeLayerGroups(
  visibleLayers: LayerConfigForColoring[]
): Map<string, LayerGroup> {
  const groups = new Map<string, LayerGroup>()

  for (const layer of visibleLayers) {
    // Normalize geoProperty to lowercase for case-insensitive matching
    // Layers without linkage get their own standalone group
    const geoProperty = layer.linkage?.geoProperty?.toLowerCase() || `__standalone_${layer.name}`

    if (!groups.has(geoProperty)) {
      groups.set(geoProperty, {
        geoProperty,
        layers: [],
        hasArc: false,
        geometryCount: 0,
      })
    }

    const group = groups.get(geoProperty)!
    group.layers.push(layer)

    if (layer.type === 'arc') {
      group.hasArc = true
    } else {
      group.geometryCount++
    }
  }

  return groups
}

/**
 * Compute the coloring role for a single layer
 *
 * Algorithm priority:
 * 1. Explicit colorByRole override (if not 'auto')
 * 2. Strategy-based rules:
 *    - 'all': Every layer gets 'primary'
 *    - 'explicit': Only layers with colorByRole: 'primary' get it
 *    - 'auto': Smart detection based on layer relationships
 *
 * Auto strategy rules:
 * - Arc + geometry layers together: arc is primary, geometries are neutral
 * - Single geometry alone: primary
 * - Multiple geometries without arc: all primary
 * - Arc alone: primary
 *
 * @param layer - The layer to compute role for
 * @param group - The LayerGroup this layer belongs to
 * @param strategy - Dashboard-level strategy ('auto', 'explicit', 'all')
 * @returns Computed role with reason
 */
export function computeLayerRole(
  layer: LayerConfigForColoring,
  group: LayerGroup,
  strategy: LayerStrategy = 'auto'
): LayerColoringRole {
  const result: LayerColoringRole = {
    layerName: layer.name,
    role: 'primary',
    reason: '',
  }

  // Priority 1: Check for explicit override (colorByRole other than 'auto')
  if (layer.colorByRole && layer.colorByRole !== 'auto') {
    result.role = layer.colorByRole === 'secondary' ? 'secondary' : layer.colorByRole
    result.reason = `Explicit colorByRole: ${layer.colorByRole}`
    return result
  }

  // Priority 2: Strategy-based rules
  if (strategy === 'all') {
    result.role = 'primary'
    result.reason = 'Strategy: all layers get primary'
    return result
  }

  if (strategy === 'explicit') {
    result.role = 'neutral'
    result.reason = 'Strategy: explicit - no colorByRole set'
    return result
  }

  // Strategy 'auto': Smart detection based on layer relationships
  const isArc = layer.type === 'arc'

  // Rule: If arc + geometries visible together, arc is primary, geometries neutral
  if (group.hasArc && group.geometryCount > 0) {
    if (isArc) {
      result.role = 'primary'
      result.reason = 'Auto: arc layer is primary when geometry layers present'
    } else {
      result.role = 'neutral'
      result.reason = 'Auto: geometry layer is neutral when arc layer present'
    }
    return result
  }

  // Rule: Arc alone gets primary
  if (isArc) {
    result.role = 'primary'
    result.reason = 'Auto: arc layer alone is primary'
    return result
  }

  // Rule: Single geometry layer gets primary
  if (group.geometryCount === 1) {
    result.role = 'primary'
    result.reason = 'Auto: single geometry layer is primary'
    return result
  }

  // Rule: Multiple geometries without arc - all get primary
  result.role = 'primary'
  result.reason = 'Auto: multiple geometry layers without arc all get primary'
  return result
}

/**
 * Main entry point: Compute coloring roles for all visible layers
 *
 * This function should be called once per render cycle (in updateLayers),
 * not per-feature. The returned Map can be used to look up roles efficiently.
 *
 * @param visibleLayers - Array of currently visible layer configs
 * @param strategy - Dashboard-level strategy ('auto', 'explicit', 'all')
 * @returns Map of layer name to LayerColoringRole
 *
 * @example
 * const roles = computeAllLayerRoles(visibleLayers, 'auto')
 * const role = roles.get('origin_clusters')
 * if (role?.role === 'neutral') {
 *   // Use neutral styling
 * }
 */
export function computeAllLayerRoles(
  visibleLayers: LayerConfigForColoring[],
  strategy: LayerStrategy = 'auto'
): Map<string, LayerColoringRole> {
  const roles = new Map<string, LayerColoringRole>()

  // Handle empty array
  if (!visibleLayers || visibleLayers.length === 0) {
    return roles
  }

  if (DEBUG_LAYER_COLORING) {
    console.log('[LayerColoring] Computing roles for', visibleLayers.length, 'layers')
    console.log('[LayerColoring] Strategy:', strategy)
  }

  // Step 1: Group layers by geoProperty
  const groups = computeLayerGroups(visibleLayers)

  if (DEBUG_LAYER_COLORING) {
    groups.forEach((group, key) => {
      console.log(
        `[LayerColoring] Group "${key}": ${group.layers.length} layers, hasArc=${group.hasArc}, geometryCount=${group.geometryCount}`
      )
    })
  }

  // Step 2: Compute role for each layer based on its group
  for (const layer of visibleLayers) {
    const geoProperty = layer.linkage?.geoProperty?.toLowerCase() || `__standalone_${layer.name}`
    const group = groups.get(geoProperty)!

    const role = computeLayerRole(layer, group, strategy)
    roles.set(layer.name, role)

    if (DEBUG_LAYER_COLORING) {
      console.log(`[LayerColoring] Layer "${layer.name}": role=${role.role}, reason=${role.reason}`)
    }
  }

  return roles
}

/**
 * LayerColoringManager class - Alternative OOP interface
 *
 * Provides a stateful wrapper around the functional API for cases
 * where you want to cache computed roles or add additional methods.
 */
export class LayerColoringManager {
  private cachedRoles: Map<string, LayerColoringRole> = new Map()
  private strategy: LayerStrategy = 'auto'

  constructor(strategy: LayerStrategy = 'auto') {
    this.strategy = strategy
  }

  /**
   * Set the strategy for role computation
   */
  setStrategy(strategy: LayerStrategy): void {
    this.strategy = strategy
  }

  /**
   * Get the current strategy
   */
  getStrategy(): LayerStrategy {
    return this.strategy
  }

  /**
   * Compute and cache roles for visible layers
   */
  computeRoles(visibleLayers: LayerConfigForColoring[]): Map<string, LayerColoringRole> {
    this.cachedRoles = computeAllLayerRoles(visibleLayers, this.strategy)
    return this.cachedRoles
  }

  /**
   * Get cached role for a specific layer
   */
  getRole(layerName: string): LayerColoringRole | undefined {
    return this.cachedRoles.get(layerName)
  }

  /**
   * Check if a layer should receive colorBy coloring
   */
  shouldApplyColorBy(layerName: string): boolean {
    const role = this.cachedRoles.get(layerName)
    return role?.role === 'primary' || role?.role === 'secondary'
  }

  /**
   * Clear cached roles
   */
  clearCache(): void {
    this.cachedRoles.clear()
  }
}

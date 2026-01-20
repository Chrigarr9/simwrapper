import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeLayerGroups,
  computeLayerRole,
  computeAllLayerRoles,
  LayerColoringManager,
} from '../LayerColoringManager'
import type { LayerConfigForColoring, LayerGroup } from '../../types/layerColoring'

/**
 * Test helper to create a minimal layer config
 */
function createLayer(
  name: string,
  type: string,
  geoProperty?: string,
  colorByRole?: 'primary' | 'secondary' | 'neutral' | 'auto'
): LayerConfigForColoring {
  const layer: LayerConfigForColoring = { name, type }
  if (geoProperty) {
    layer.linkage = { geoProperty }
  }
  if (colorByRole) {
    layer.colorByRole = colorByRole
  }
  return layer
}

describe('LayerColoringManager', () => {
  describe('computeLayerGroups', () => {
    it('groups layers with same geoProperty together', () => {
      const layers = [
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      const groups = computeLayerGroups(layers)

      expect(groups.size).toBe(1)
      expect(groups.has('cluster_id')).toBe(true)
      expect(groups.get('cluster_id')!.layers.length).toBe(2)
    })

    it('performs case-insensitive geoProperty matching', () => {
      const layers = [
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'Cluster_Id'),
        createLayer('points', 'scatterplot', 'CLUSTER_ID'),
      ]

      const groups = computeLayerGroups(layers)

      expect(groups.size).toBe(1)
      expect(groups.has('cluster_id')).toBe(true)
      expect(groups.get('cluster_id')!.layers.length).toBe(3)
    })

    it('creates standalone groups for layers without linkage', () => {
      const layers = [
        createLayer('decorative', 'polygon'),
        createLayer('background', 'polygon'),
      ]

      const groups = computeLayerGroups(layers)

      expect(groups.size).toBe(2)
      expect(groups.has('__standalone_decorative')).toBe(true)
      expect(groups.has('__standalone_background')).toBe(true)
    })

    it('correctly computes hasArc for groups', () => {
      const layersWithArc = [
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      const layersWithoutArc = [
        createLayer('clusters', 'polygon', 'zone_id'),
        createLayer('points', 'scatterplot', 'zone_id'),
      ]

      const groupsWithArc = computeLayerGroups(layersWithArc)
      const groupsWithoutArc = computeLayerGroups(layersWithoutArc)

      expect(groupsWithArc.get('cluster_id')!.hasArc).toBe(true)
      expect(groupsWithoutArc.get('zone_id')!.hasArc).toBe(false)
    })

    it('correctly computes geometryCount for groups', () => {
      const layers = [
        createLayer('origin', 'polygon', 'cluster_id'),
        createLayer('destination', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      const groups = computeLayerGroups(layers)

      expect(groups.get('cluster_id')!.geometryCount).toBe(2)
    })

    it('handles empty layer array', () => {
      const groups = computeLayerGroups([])
      expect(groups.size).toBe(0)
    })

    it('separates layers with different geoProperties', () => {
      const layers = [
        createLayer('zones', 'polygon', 'zone_id'),
        createLayer('clusters', 'polygon', 'cluster_id'),
      ]

      const groups = computeLayerGroups(layers)

      expect(groups.size).toBe(2)
      expect(groups.has('zone_id')).toBe(true)
      expect(groups.has('cluster_id')).toBe(true)
    })
  })

  describe('computeLayerRole - auto strategy', () => {
    it('makes arc primary when arc + polygon present in same group', () => {
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const polygonLayer = createLayer('clusters', 'polygon', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer, polygonLayer],
        hasArc: true,
        geometryCount: 1,
      }

      const arcRole = computeLayerRole(arcLayer, group, 'auto')
      expect(arcRole.role).toBe('primary')
      expect(arcRole.reason).toContain('arc layer is primary')
    })

    it('makes polygon neutral when arc + polygon present in same group', () => {
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const polygonLayer = createLayer('clusters', 'polygon', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer, polygonLayer],
        hasArc: true,
        geometryCount: 1,
      }

      const polygonRole = computeLayerRole(polygonLayer, group, 'auto')
      expect(polygonRole.role).toBe('neutral')
      expect(polygonRole.reason).toContain('geometry layer is neutral')
    })

    it('makes both polygons neutral when arc + 2 polygons present', () => {
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const polygon1 = createLayer('origin', 'polygon', 'cluster_id')
      const polygon2 = createLayer('destination', 'polygon', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer, polygon1, polygon2],
        hasArc: true,
        geometryCount: 2,
      }

      const role1 = computeLayerRole(polygon1, group, 'auto')
      const role2 = computeLayerRole(polygon2, group, 'auto')
      const arcRole = computeLayerRole(arcLayer, group, 'auto')

      expect(role1.role).toBe('neutral')
      expect(role2.role).toBe('neutral')
      expect(arcRole.role).toBe('primary')
    })

    it('makes single polygon primary when alone', () => {
      const polygonLayer = createLayer('clusters', 'polygon', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [polygonLayer],
        hasArc: false,
        geometryCount: 1,
      }

      const role = computeLayerRole(polygonLayer, group, 'auto')
      expect(role.role).toBe('primary')
      expect(role.reason).toContain('single geometry layer is primary')
    })

    it('makes multiple polygons without arc all primary', () => {
      const polygon1 = createLayer('zones1', 'polygon', 'zone_id')
      const polygon2 = createLayer('zones2', 'polygon', 'zone_id')
      const group: LayerGroup = {
        geoProperty: 'zone_id',
        layers: [polygon1, polygon2],
        hasArc: false,
        geometryCount: 2,
      }

      const role1 = computeLayerRole(polygon1, group, 'auto')
      const role2 = computeLayerRole(polygon2, group, 'auto')

      expect(role1.role).toBe('primary')
      expect(role2.role).toBe('primary')
      expect(role1.reason).toContain('multiple geometry layers')
    })

    it('makes arc alone primary', () => {
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer],
        hasArc: true,
        geometryCount: 0,
      }

      const role = computeLayerRole(arcLayer, group, 'auto')
      expect(role.role).toBe('primary')
      expect(role.reason).toContain('arc layer alone is primary')
    })
  })

  describe('computeLayerRole - explicit strategy', () => {
    it('makes layer with colorByRole:primary primary', () => {
      const layer = createLayer('clusters', 'polygon', 'cluster_id', 'primary')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [layer],
        hasArc: false,
        geometryCount: 1,
      }

      const role = computeLayerRole(layer, group, 'explicit')
      expect(role.role).toBe('primary')
      expect(role.reason).toContain('Explicit colorByRole')
    })

    it('makes layer with colorByRole:neutral neutral', () => {
      const layer = createLayer('clusters', 'polygon', 'cluster_id', 'neutral')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [layer],
        hasArc: false,
        geometryCount: 1,
      }

      const role = computeLayerRole(layer, group, 'explicit')
      expect(role.role).toBe('neutral')
    })

    it('makes layer without colorByRole neutral', () => {
      const layer = createLayer('clusters', 'polygon', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [layer],
        hasArc: false,
        geometryCount: 1,
      }

      const role = computeLayerRole(layer, group, 'explicit')
      expect(role.role).toBe('neutral')
      expect(role.reason).toContain('explicit')
    })
  })

  describe('computeLayerRole - all strategy', () => {
    it('makes all layers primary regardless of relationships', () => {
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const polygonLayer = createLayer('clusters', 'polygon', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer, polygonLayer],
        hasArc: true,
        geometryCount: 1,
      }

      const arcRole = computeLayerRole(arcLayer, group, 'all')
      const polygonRole = computeLayerRole(polygonLayer, group, 'all')

      expect(arcRole.role).toBe('primary')
      expect(polygonRole.role).toBe('primary')
      expect(arcRole.reason).toContain('Strategy: all')
    })
  })

  describe('computeLayerRole - override tests', () => {
    it('explicit colorByRole overrides auto-detection', () => {
      // This polygon would normally be neutral with arc present
      const polygonLayer = createLayer('clusters', 'polygon', 'cluster_id', 'primary')
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer, polygonLayer],
        hasArc: true,
        geometryCount: 1,
      }

      const role = computeLayerRole(polygonLayer, group, 'auto')
      expect(role.role).toBe('primary')
      expect(role.reason).toContain('Explicit colorByRole')
    })

    it('colorByRole:auto defers to auto-detection', () => {
      // This polygon with colorByRole:'auto' should still be neutral with arc present
      const polygonLayer = createLayer('clusters', 'polygon', 'cluster_id', 'auto')
      const arcLayer = createLayer('arcs', 'arc', 'cluster_id')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [arcLayer, polygonLayer],
        hasArc: true,
        geometryCount: 1,
      }

      const role = computeLayerRole(polygonLayer, group, 'auto')
      expect(role.role).toBe('neutral')
      expect(role.reason).toContain('geometry layer is neutral')
    })

    it('colorByRole:secondary is honored', () => {
      const layer = createLayer('clusters', 'polygon', 'cluster_id', 'secondary')
      const group: LayerGroup = {
        geoProperty: 'cluster_id',
        layers: [layer],
        hasArc: false,
        geometryCount: 1,
      }

      const role = computeLayerRole(layer, group, 'auto')
      expect(role.role).toBe('secondary')
    })
  })

  describe('computeAllLayerRoles', () => {
    it('returns Map of roles keyed by layer name', () => {
      const layers = [
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      const roles = computeAllLayerRoles(layers, 'auto')

      expect(roles.size).toBe(2)
      expect(roles.has('clusters')).toBe(true)
      expect(roles.has('arcs')).toBe(true)
      expect(roles.get('arcs')!.role).toBe('primary')
      expect(roles.get('clusters')!.role).toBe('neutral')
    })

    it('handles empty array', () => {
      const roles = computeAllLayerRoles([])
      expect(roles.size).toBe(0)
    })

    it('handles undefined/null gracefully', () => {
      const roles = computeAllLayerRoles(null as any)
      expect(roles.size).toBe(0)
    })

    it('defaults to auto strategy', () => {
      const layers = [
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      // Call without strategy argument
      const roles = computeAllLayerRoles(layers)

      // Should use auto strategy: arc primary, polygon neutral
      expect(roles.get('arcs')!.role).toBe('primary')
      expect(roles.get('clusters')!.role).toBe('neutral')
    })

    it('correctly groups and assigns roles across multiple groups', () => {
      const layers = [
        createLayer('zones', 'polygon', 'zone_id'),
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      const roles = computeAllLayerRoles(layers, 'auto')

      // zone_id group: single polygon -> primary
      expect(roles.get('zones')!.role).toBe('primary')

      // cluster_id group: arc + polygon -> arc primary, polygon neutral
      expect(roles.get('clusters')!.role).toBe('neutral')
      expect(roles.get('arcs')!.role).toBe('primary')
    })
  })

  describe('LayerColoringManager class', () => {
    let manager: LayerColoringManager

    beforeEach(() => {
      manager = new LayerColoringManager()
    })

    it('creates instance with default auto strategy', () => {
      expect(manager.getStrategy()).toBe('auto')
    })

    it('allows setting strategy', () => {
      manager.setStrategy('all')
      expect(manager.getStrategy()).toBe('all')
    })

    it('computes and caches roles', () => {
      const layers = [
        createLayer('clusters', 'polygon', 'cluster_id'),
        createLayer('arcs', 'arc', 'cluster_id'),
      ]

      const roles = manager.computeRoles(layers)

      expect(roles.size).toBe(2)
      expect(manager.getRole('arcs')!.role).toBe('primary')
      expect(manager.getRole('clusters')!.role).toBe('neutral')
    })

    it('shouldApplyColorBy returns true for primary and secondary', () => {
      const layers = [
        createLayer('primary', 'polygon', 'id1', 'primary'),
        createLayer('secondary', 'polygon', 'id2', 'secondary'),
        createLayer('neutral', 'polygon', 'id3', 'neutral'),
      ]

      manager.computeRoles(layers)

      expect(manager.shouldApplyColorBy('primary')).toBe(true)
      expect(manager.shouldApplyColorBy('secondary')).toBe(true)
      expect(manager.shouldApplyColorBy('neutral')).toBe(false)
    })

    it('shouldApplyColorBy returns false for unknown layer', () => {
      manager.computeRoles([])
      expect(manager.shouldApplyColorBy('unknown')).toBe(false)
    })

    it('clearCache removes cached roles', () => {
      const layers = [createLayer('test', 'polygon', 'id')]
      manager.computeRoles(layers)

      expect(manager.getRole('test')).toBeDefined()

      manager.clearCache()

      expect(manager.getRole('test')).toBeUndefined()
    })

    it('respects strategy set in constructor', () => {
      const explicitManager = new LayerColoringManager('explicit')
      expect(explicitManager.getStrategy()).toBe('explicit')

      const layers = [createLayer('test', 'polygon', 'id')]
      explicitManager.computeRoles(layers)

      // explicit strategy: no colorByRole -> neutral
      expect(explicitManager.getRole('test')!.role).toBe('neutral')
    })
  })
})

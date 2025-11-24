import { describe, test, expect, beforeEach, vi } from 'vitest'
import { LinkageManager } from '../LinkageManager'

describe('LinkageManager', () => {
  let lm: LinkageManager

  beforeEach(() => {
    lm = new LinkageManager()
  })

  test('notifies observers on hover change', () => {
    const observer = {
      onHoveredIdsChange: vi.fn(),
      onSelectedIdsChange: vi.fn(),
    }
    lm.addObserver(observer)

    lm.setHoveredIds(new Set([1, 2, 3]))
    expect(observer.onHoveredIdsChange).toHaveBeenCalledWith(new Set([1, 2, 3]))
  })

  test('notifies observers on selection change', () => {
    const observer = {
      onHoveredIdsChange: vi.fn(),
      onSelectedIdsChange: vi.fn(),
    }
    lm.addObserver(observer)

    lm.setSelectedIds(new Set([1, 2]))
    expect(observer.onSelectedIdsChange).toHaveBeenCalledWith(new Set([1, 2]))
  })

  test('toggles selection - deselects all when all selected', () => {
    lm.setSelectedIds(new Set([1, 2]))

    // Toggle with overlapping: should deselect all
    lm.toggleSelectedIds(new Set([1, 2]))
    expect(lm.getSelectedIds().size).toBe(0)
  })

  test('toggles selection - selects all when none selected', () => {
    // Toggle with new IDs: should select all
    lm.toggleSelectedIds(new Set([3, 4]))
    expect(lm.getSelectedIds().size).toBe(2)
    expect(lm.getSelectedIds().has(3)).toBe(true)
    expect(lm.getSelectedIds().has(4)).toBe(true)
  })

  test('toggles selection - selects all when partially selected', () => {
    lm.setSelectedIds(new Set([1]))

    // Toggle with [1, 2]: not all selected, so select all
    lm.toggleSelectedIds(new Set([1, 2]))
    expect(lm.getSelectedIds().size).toBe(2)
    expect(lm.getSelectedIds().has(1)).toBe(true)
    expect(lm.getSelectedIds().has(2)).toBe(true)
  })

  test('clears all selections', () => {
    lm.setSelectedIds(new Set([1, 2, 3]))
    lm.clearSelection()
    expect(lm.getSelectedIds().size).toBe(0)
  })

  test('removes observer', () => {
    const observer = {
      onHoveredIdsChange: vi.fn(),
      onSelectedIdsChange: vi.fn(),
    }
    lm.addObserver(observer)
    lm.removeObserver(observer)

    lm.setHoveredIds(new Set([1]))
    expect(observer.onHoveredIdsChange).not.toHaveBeenCalled()
  })

  test('creates new Set instances to prevent external mutations', () => {
    const ids = new Set([1, 2])
    lm.setSelectedIds(ids)

    ids.add(3)  // Mutate original

    // LinkageManager should not be affected
    expect(lm.getSelectedIds().size).toBe(2)
  })
})

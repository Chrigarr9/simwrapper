export interface LinkageConfig {
  tableColumn: string
  geoProperty: string
  onHover?: 'highlight' | 'none'
  onSelect?: 'filter' | 'highlight' | 'none'
}

export interface LinkageObserver {
  onHoveredIdsChange: (ids: Set<any>) => void
  onSelectedIdsChange: (ids: Set<any>) => void
  // Optional handler for attribute pair selection (from correlation matrix)
  onAttributePairSelected?: (attrX: string, attrY: string) => void
}

export class LinkageManager {
  private hoveredIds: Set<any> = new Set()
  private selectedIds: Set<any> = new Set()
  private observers: Set<LinkageObserver> = new Set()
  private selectedAttributePair: { x: string; y: string } | null = null

  addObserver(observer: LinkageObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: LinkageObserver): void {
    this.observers.delete(observer)
  }

  setHoveredIds(ids: Set<any>): void {
    this.hoveredIds = new Set(ids)
    this.notifyHover()
  }

  setSelectedIds(ids: Set<any>): void {
    this.selectedIds = new Set(ids)
    this.notifySelection()
  }

  toggleSelectedIds(ids: Set<any>): void {
    const allSelected = Array.from(ids).every(id => this.selectedIds.has(id))

    if (allSelected) {
      ids.forEach(id => this.selectedIds.delete(id))
    } else {
      ids.forEach(id => this.selectedIds.add(id))
    }

    this.notifySelection()
  }

  clearSelection(): void {
    this.selectedIds.clear()
    this.notifySelection()
  }

  getHoveredIds(): ReadonlySet<any> {
    return this.hoveredIds
  }

  getSelectedIds(): ReadonlySet<any> {
    return this.selectedIds
  }

  private notifyHover(): void {
    this.observers.forEach(obs => obs.onHoveredIdsChange(this.hoveredIds))
  }

  private notifySelection(): void {
    this.observers.forEach(obs => obs.onSelectedIdsChange(this.selectedIds))
  }

  setSelectedAttributePair(attrX: string, attrY: string): void {
    console.log('[LinkageManager] setSelectedAttributePair:', attrX, attrY)
    this.selectedAttributePair = { x: attrX, y: attrY }
    this.notifyAttributePairSelection()
  }

  getSelectedAttributePair(): { x: string; y: string } | null {
    return this.selectedAttributePair
  }

  clearAttributePairSelection(): void {
    this.selectedAttributePair = null
  }

  private notifyAttributePairSelection(): void {
    if (!this.selectedAttributePair) return

    console.log('[LinkageManager] notifyAttributePairSelection to', this.observers.size, 'observers')
    this.observers.forEach(obs => {
      console.log('[LinkageManager] Observer has onAttributePairSelected:', !!obs.onAttributePairSelected)
      if (obs.onAttributePairSelected) {
        obs.onAttributePairSelected(
          this.selectedAttributePair!.x,
          this.selectedAttributePair!.y
        )
      }
    })
  }
}

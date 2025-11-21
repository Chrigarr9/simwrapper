# Interactive Dashboard - Parallel Development Strategy

## Overview

**Approach**: Create `InteractiveDashboard.vue` **alongside** existing `DashBoard.vue` without modifying anything.

### Key Principles

1. ✅ **Zero modifications** to existing files
2. ✅ **Pure additive** development (only create new files)
3. ✅ **No shared folders** (reference existing code directly)
4. ✅ **Copy patterns** from DashBoard.vue (don't refactor it)
5. ✅ **Detection logic** determines which component to load

---

## File Structure

### Existing Files (DO NOT TOUCH)
```
src/layout-manager/
├── DashBoard.vue              # ✋ LEAVE UNTOUCHED
└── ...

src/plugins/commuter-requests/  # ✋ LEAVE UNTOUCHED (reference for patterns)
```

### New Files (ADD THESE)
```
src/managers/
├── FilterManager.ts           # ✅ NEW
├── LinkageManager.ts          # ✅ NEW
└── DataTableManager.ts        # ✅ NEW

src/layout-manager/
└── InteractiveDashboard.vue   # ✅ NEW (parallel to DashBoard.vue)

src/components/interactive/
├── LinkableCardWrapper.vue    # ✅ NEW
├── HistogramCard.vue          # ✅ NEW
└── PieChartCard.vue           # ✅ NEW
```

---

## How InteractiveDashboard Works

### 1. Component Detection

When loading a dashboard YAML:

```typescript
// Wherever dashboards are currently loaded (find this location)
function loadDashboardComponent(config: any) {
  if (config.table) {
    // Load InteractiveDashboard.vue
    return () => import('@/layout-manager/InteractiveDashboard.vue')
  } else {
    // Load existing DashBoard.vue (unchanged)
    return () => import('@/layout-manager/DashBoard.vue')
  }
}
```

### 2. InteractiveDashboard Implementation

`InteractiveDashboard.vue` will:
- **Copy** the layout rendering logic from `DashBoard.vue`
- **Add** coordination layer (FilterManager, LinkageManager)
- **Wrap** cards with linkage when needed
- **Reuse** existing card components directly

```vue
<template>
  <div class="interactive-dashboard">
    <!-- Copy row/card structure from DashBoard.vue -->
    <div v-for="row in rows" :key="row.id" class="dashboard-row">
      <div v-for="card in row.cards"
           :key="card.id"
           :style="getCardStyle(card)"
           class="dashboard-card">

        <!-- Add coordination wrapper (NEW) -->
        <LinkableCardWrapper
          v-if="card.linkage"
          :card="card"
          :filter-manager="filterManager"
          :linkage-manager="linkageManager"
          :data-table-manager="dataTableManager"
        >
          <component :is="getCardComponent(card.type)" v-bind="card" />
        </LinkableCardWrapper>

        <!-- Standard rendering (EXISTING) -->
        <component v-else :is="getCardComponent(card.type)" v-bind="card" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Import existing utilities directly (no refactoring needed)
import { getCardComponent } from '@/wherever-it-currently-is'

// Import new managers (additive)
import { FilterManager } from '@/managers/FilterManager'
import { LinkageManager } from '@/managers/LinkageManager'
import { DataTableManager } from '@/managers/DataTableManager'

// Copy layout logic from DashBoard.vue
function getCardStyle(card: any) {
  const height = card.height ? card.height * 60 : 300
  const flex = card.width || 1
  return { flex, minHeight: `${height}px` }
}

// Add coordination layer (NEW)
const filterManager = new FilterManager()
const linkageManager = new LinkageManager()
const dataTableManager = new DataTableManager(props.config.table)
</script>

<style scoped>
/* Copy styles from DashBoard.vue */
</style>
```

---

## Benefits of This Approach

### 1. Zero Risk
- `DashBoard.vue` never touched
- Existing dashboards guaranteed to work
- No possibility of regression

### 2. Simple Development
- Just add new files
- Copy/paste patterns from existing code
- No complex refactoring needed

### 3. Easy Rollback
```typescript
// Just flip a flag
const USE_INTERACTIVE = false  // Instant rollback

if (USE_INTERACTIVE && config.table) {
  return InteractiveDashboard
} else {
  return DashBoard
}
```

### 4. Side-by-Side Comparison
```bash
# Run both versions with same data
http://localhost:8080/dashboard-legacy.yaml        # Uses DashBoard.vue
http://localhost:8080/dashboard-interactive.yaml   # Uses InteractiveDashboard.vue
```

### 5. Gradual Migration
```yaml
# Users opt-in by adding 'table' section
title: "My Dashboard"
table:               # ← Adding this switches to InteractiveDashboard
  dataset: data.csv
  idColumn: id
layout:
  # ... everything else stays the same
```

---

## Development Timeline

### Phase 1: Core Managers (Week 1)
- Create FilterManager.ts
- Create LinkageManager.ts
- Create DataTableManager.ts
- Unit tests

**Impact on existing code**: ZERO

### Phase 2: InteractiveDashboard Component (Week 2)
- Create InteractiveDashboard.vue (copy from DashBoard.vue)
- Create LinkableCardWrapper.vue
- Add detection logic
- Integration tests

**Impact on existing code**: ZERO (just add detection switch)

### Phase 3: Interactive Card Types (Week 3)
- Create HistogramCard.vue
- Create PieChartCard.vue
- Register new card types
- Component tests

**Impact on existing code**: ZERO (additive registration)

### Phase 4: Validation (Week 4)
- Re-implement commuter-requests as YAML
- Side-by-side comparison
- Performance benchmarks
- Bug fixes

**Impact on existing code**: ZERO

### Phase 5: Production Ready (Week 5+)
- Documentation
- User testing
- Gradual rollout
- Monitor adoption

**Impact on existing code**: ZERO (optional feature)

---

## Migration Path

### For Dashboard Developers

**Before (regular dashboard)**:
```yaml
title: "Traffic Dashboard"
layout:
  row1:
    - type: map
      file: traffic.geojson
```
→ Uses `DashBoard.vue`

**After (add interactivity)**:
```yaml
title: "Traffic Dashboard"
table:                    # ← Add this
  dataset: traffic.csv
  idColumn: id

layout:
  row1:
    - type: map
      layers:
        - file: traffic.geojson
          linkage:        # ← Add this
            tableColumn: id
            geoProperty: id
```
→ Uses `InteractiveDashboard.vue`

### Deprecation Timeline (Future)

```
Month 0: InteractiveDashboard released (opt-in)
Month 3: Announce success metrics
Month 6: Encourage migration
Month 12: Announce DashBoard.vue deprecation
Month 18: Remove DashBoard.vue (if adoption is high)
```

**No forced migration** - users upgrade when ready

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Breaking existing dashboards | **0%** | Nothing modified ✅ |
| InteractiveDashboard has bugs | Medium | Isolated to opt-in users |
| Low adoption | Low | Clear benefits, easy migration |
| Performance issues | Low | Benchmark before release |
| Code duplication | High | Acceptable trade-off for safety |

---

## Success Criteria

### Phase 1 Success (Week 4)
- ✅ InteractiveDashboard feature complete
- ✅ Commuter-requests recreated with feature parity
- ✅ Zero regressions in existing dashboards
- ✅ Performance within 10% of current

### Phase 2 Success (Month 3)
- ✅ 5+ dashboards migrated to interactive
- ✅ No critical bugs reported
- ✅ User feedback positive
- ✅ Performance stable

### Phase 3 Success (Month 6)
- ✅ 20+ dashboards migrated
- ✅ Feature requests for enhancements
- ✅ Community creating interactive dashboards
- ✅ Consider deprecating DashBoard.vue

---

## Technical Details

### Where to Add Detection Logic

**Find**: Where dashboards are currently loaded from YAML
```bash
grep -r "DashBoard" src/ --include="*.vue" --include="*.ts"
grep -r "dashboard.*yaml" src/ --include="*.vue" --include="*.ts"
```

**Add**: Simple switch logic
```typescript
// In dashboard loading file
import DashBoard from '@/layout-manager/DashBoard.vue'
import InteractiveDashboard from '@/layout-manager/InteractiveDashboard.vue'

export function getDashboardComponent(config: any) {
  if (config.table) {
    console.log('[InteractiveDashboard] Loading with coordination layer')
    return InteractiveDashboard
  } else {
    console.log('[DashBoard] Loading standard dashboard')
    return DashBoard
  }
}
```

### Card Type Registration

**Find**: Where card types are registered
```bash
grep -r "cardTypes\|registerCard\|'map'\|'vega'" src/
```

**Add**: New types additively
```typescript
// In card registry
import HistogramCard from '@/components/interactive/HistogramCard.vue'
import PieChartCard from '@/components/interactive/PieChartCard.vue'

// Add new types (doesn't affect existing)
cardTypes.set('histogram', HistogramCard)
cardTypes.set('pie-chart', PieChartCard)
```

---

## Comparison: Modification vs Parallel

| Aspect | Modify DashBoard.vue | Parallel Development |
|--------|---------------------|---------------------|
| Risk to existing | High ⚠️ | Zero ✅ |
| Development speed | Faster | Slightly slower |
| Code duplication | None | Some (temporary) |
| Rollback | Hard (git revert) | Easy (flip switch) ✅ |
| User confidence | Low | High ✅ |
| Testing complexity | High | Low ✅ |
| Migration path | Forced | Gradual ✅ |
| Long-term maintenance | Cleaner | Need deprecation |

**Verdict**: Parallel development is safer and better for production software ✅

---

## Next Steps

1. ✅ Update implementation tasks for parallel approach
2. ✅ Create InteractiveDashboard.vue (copy from DashBoard.vue)
3. ✅ Build coordination layer (managers)
4. ✅ Test in isolation
5. ✅ Side-by-side validation
6. ✅ Gradual rollout

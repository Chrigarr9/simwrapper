# Quick Task 004 Summary: Scatter Plot Highlight/Selection Visibility

## Completed: 2026-01-29

## Changes Made

### ScatterCard.vue - Enhanced Visual Distinction

**Before:**
- Highlighted/selected points only changed color
- Border width: 0.5 → 2 (barely noticeable)
- Same size as other points
- Same opacity (0.8 for all)

**After:**
| State | Size | Border | Border Color | Opacity |
|-------|------|--------|--------------|---------|
| Normal | 1x | 0.5px | text color | 0.7 |
| Hovered | 1.5x | 2.5px | white | 1.0 |
| Selected | 1.5x | 3px | white | 1.0 |

**Key improvements:**
1. **Size increase** - Most impactful change; highlighted/selected points are 50% larger
2. **White border** - Maximum contrast against any background or point color
3. **Thicker border** - 3px for selected, 2.5px for hovered (vs 0.5px normal)
4. **Opacity contrast** - Full opacity for active points, reduced for others

**Files modified:**
- `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue` (+55/-20 lines)

**Commit:** c0a5027e

## Verification

- Both category-based and single-trace rendering paths updated
- Works with colorColumn categories and without
- Respects hoveredIds and selectedIds from cross-card linkage
- Respects local selectedPoints for click interactions

# Phase 3: Correlation Analysis - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Visualize pairwise Pearson correlations between cluster attributes as a heatmap card. Users can identify relationships between 70+ attributes (travel behavior, demographics, mode choice, service metrics). The matrix recalculates on filtered data and can link to a ScatterCard for detailed exploration.

</domain>

<decisions>
## Implementation Decisions

### Attribute Selection
- No runtime UI selector — attributes are configured in YAML only
- Flat alphabetical list in documentation/config examples
- YAML config specifies list of attributes to include in matrix
- If no attributes configured: show empty matrix with placeholder message prompting user to configure
- No limit on number of attributes selected

### Interaction Behavior
- **Hover:** Both tooltip (correlation value + attribute names) AND row/column highlight
- **Click:** Broadcasts selection event with the two attributes
- **Scatter linkage:** A ScatterCard can be configured to listen for matrix click events and update its X/Y axes to the selected attributes
- **Cell labels:** Conditional — show correlation values in cells when matrix is small enough to be readable; hide when too many attributes
- **Color scale:** Classic diverging blue-white-red (blue=negative, white=zero, red=positive)

### Filtered Data Handling
- Matrix always recalculates on filtered data (shows correlations for subset only)
- **Sample size:** Display n prominently in header/corner
- **Significance:** Visual indicator for statistically significant correlations (p<0.05) — e.g., asterisk or border

### Claude's Discretion
- Performance approach for large datasets (async calculation, loading states, Web Worker)
- Exact threshold for "small enough" to show values in cells
- Specific visual treatment for significance indicator
- p-value threshold (suggested p<0.05 but can adjust)

</decisions>

<specifics>
## Specific Ideas

- ScatterCard should always be visible, just changes its axis configuration when correlation cell is clicked
- Event-based linkage pattern: matrix broadcasts, scatter subscribes — clean separation
- Existing LinkageManager patterns can be extended for this new event type

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-correlation-analysis*
*Context gathered: 2026-01-21*

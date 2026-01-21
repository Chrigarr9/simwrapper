<template lang="pug">
//- DashboardCard - a simple card container
//- Has a size, displays content, can go fullscreen
.dashboard-card(:style="cardStyle" :class="cardClasses")
  //- Header with title and buttons
  .card-header(v-if="showHeader")
    .header-labels(:style="{paddingLeft: card.type === 'text' ? '4px' : ''}")
      h3 {{ card.title }}
      p(v-if="card.description") {{ card.description }}

    .header-buttons
      button.btn-icon(v-if="card.info" @click="toggleInfo" :title="showInfo ? 'Hide Info' : 'Show Info'")
        i.fa.fa-info-circle

      button.btn-icon(@click="handleFullscreenClick" :title="isFullscreen ? 'Restore' : 'Enlarge'")
        i.fa(:class="isFullscreen ? 'fa-compress' : 'fa-expand'")

  //- Info panel
  .info-panel(v-show="showInfo")
    p {{ card.info }}

  //- Content
  .card-content(ref="contentWrapper" :id="card.id" :class="{'is-loaded': card.isLoaded}")
    slot

  //- Errors
  .card-errors(v-if="card.errors && card.errors.length")
    span.close-btn(@click="clearErrors") ×
    p(v-for="err, i in card.errors" :key="i") {{ err }}
</template>

<script lang="ts">
/**
 * DashboardCard - Unified card wrapper component for Interactive Dashboard
 *
 * This component provides:
 * - Card frame with consistent styling
 * - Header with title and description
 * - Info and enlarge buttons in header
 * - Collapsible info panel (locally managed state)
 * - Content slot for visualization components
 * - Error display overlay
 *
 * State Management:
 * - Info toggle (showInfo) is managed locally - no emit to parent
 * - Fullscreen toggle emits event to parent dashboard
 *
 * Usage:
 * ```vue
 * <DashboardCard
 *   :card="cardConfig"
 *   :is-fullscreen="fullScreenCardId === cardConfig.id"
 *   :is-panel-narrow="isPanelNarrow"
 *   :is-full-screen-dashboard="isFullScreenDashboard"
 *   @toggle-fullscreen="handleToggleFullscreen"
 *   @clear-errors="handleClearErrors"
 * >
 *   <YourVisualizationComponent />
 * </DashboardCard>
 * ```
 */
import { defineComponent, ref, computed, PropType, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { CardConfig } from '../types/dashboardCard'

export default defineComponent({
  name: 'DashboardCard',

  props: {
    /** Card configuration object from YAML/setupRows */
    card: {
      type: Object as PropType<CardConfig>,
      required: true,
    },
    /** Whether this card is currently in fullscreen mode */
    isFullscreen: {
      type: Boolean,
      default: false,
    },
    /** Whether the dashboard panel is narrow (responsive) */
    isPanelNarrow: {
      type: Boolean,
      default: false,
    },
    /** Whether the dashboard itself is in fullscreen layout mode */
    isFullScreenDashboard: {
      type: Boolean,
      default: false,
    },
    /** Total number of cards in the row (used for margin adjustment) */
    totalCardsInRow: {
      type: Number,
      default: 1,
    },
    /** Total number of rows in the dashboard (used for margin adjustment) */
    totalRows: {
      type: Number,
      default: 1,
    },
    /** Whether another card (not this one) is fullscreen */
    anotherCardFullscreen: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['toggle-fullscreen', 'clear-errors', 'card-resize'],

  setup(props, { emit }) {
    // Local state for info panel toggle
    // This is managed locally by DashboardCard, NOT by the parent
    const showInfo = ref(false)

    // Ref for content wrapper element (used by ResizeObserver)
    const contentWrapper = ref<HTMLElement | null>(null)

    // ResizeObserver instance (cleaned up on unmount)
    let resizeObserver: ResizeObserver | null = null

    /**
     * Toggle info panel visibility
     */
    function toggleInfo() {
      showInfo.value = !showInfo.value
    }

    /**
     * Handle fullscreen button click
     * Emits event to parent - DashboardCard doesn't manage fullscreen state
     */
    function handleFullscreenClick() {
      emit('toggle-fullscreen', props.card.id)
    }

    /**
     * Clear error messages
     */
    function clearErrors() {
      emit('clear-errors', props.card.id)
    }

    /**
     * Emit resize event with current dimensions
     * Called by ResizeObserver and fullscreen transitions
     */
    function emitResize() {
      if (!contentWrapper.value) return
      const { clientWidth, clientHeight } = contentWrapper.value
      emit('card-resize', props.card.id, { width: clientWidth, height: clientHeight })
    }

    /**
     * Handle keyboard events - Escape to exit fullscreen
     * Only responds when this card is fullscreen
     */
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && props.isFullscreen) {
        emit('toggle-fullscreen', props.card.id)
      }
    }

    // Watch for fullscreen changes to dispatch resize events
    // This ensures Plotly charts and other visualizations resize correctly
    watch(
      () => props.isFullscreen,
      (isNowFullscreen, wasFullscreen) => {
        if (wasFullscreen && !isNowFullscreen) {
          // Exiting fullscreen - trigger global resize for all charts
          nextTick(() => {
            window.dispatchEvent(new Event('resize'))
            emitResize() // Also emit specific card resize
          })
        } else if (isNowFullscreen) {
          // Entering fullscreen - also need resize
          nextTick(() => emitResize())
        }
      }
    )

    // Setup ResizeObserver and keyboard listener on mount
    onMounted(() => {
      // Add keyboard listener for Escape key
      window.addEventListener('keydown', handleKeydown)

      // Setup ResizeObserver for container size changes
      if (contentWrapper.value) {
        resizeObserver = new ResizeObserver(() => {
          // Debounce slightly using nextTick to avoid excessive updates
          nextTick(() => emitResize())
        })
        resizeObserver.observe(contentWrapper.value)
      }
    })

    // Cleanup on unmount
    onUnmounted(() => {
      // Remove keyboard listener
      window.removeEventListener('keydown', handleKeydown)

      // Disconnect ResizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
    })

    /**
     * Whether to show the card header
     */
    const showHeader = computed(() => {
      return !!(props.card.title || props.card.description)
    })

    /**
     * CSS classes for the card
     */
    const cardClasses = computed(() => {
      return {
        'is-fullscreen': props.isFullscreen,
        'is-panel-narrow': props.isPanelNarrow,
      }
    })

    /**
     * Card style - size and appearance
     */
    const cardStyle = computed(() => {
      const card = props.card

      // Figure out height. If card has registered a resizer with changeDimensions(),
      // then it needs a default height (300)
      // Markdown does not want a default height
      const defaultHeight = card.type === 'text' ? undefined : 300
      const height = card.height ? card.height * 60 : defaultHeight
      const flex = card.width || 1

      let style: Record<string, string | number | undefined> = { flex: flex }

      // Apply background color if specified
      if (card.backgroundColor || card.background) {
        style.backgroundColor = card.backgroundColor || card.background
      }

      // Apply height constraints (unless in fullscreen dashboard mode)
      if (height && !props.isFullScreenDashboard) {
        style.minHeight = `${height}px`
        style.maxHeight = `${height}px`
        style.height = `${height}px`
      }

      // If there is only a single card on this panel, shrink its margin
      if (props.totalRows === 1 && props.totalCardsInRow === 1) {
        style.margin = '0.25rem 0.25rem'
      }

      // NOTE: Fullscreen styling is handled via CSS .is-fullscreen class,
      // which uses position:fixed to overlay the viewport

      return style
    })

    return {
      showInfo,
      contentWrapper,
      toggleInfo,
      handleFullscreenClick,
      clearErrors,
      showHeader,
      cardClasses,
      cardStyle,
    }
  },
})
</script>

<style scoped lang="scss">
@import '@/styles.scss';

/*
 * DashboardCard - Simple card container
 *
 * A card has a size (flex + height), displays content, and can go fullscreen.
 * Uses CSS variables from StyleManager for theme-aware colors.
 *
 * Normal state: sized by flex layout in parent row
 * Fullscreen state: position:fixed overlay covering viewport
 */

.dashboard-card {
  // Layout and sizing - controlled by cardStyle computed
  display: flex;
  flex-direction: column;
  margin: 0 $cardSpacing $cardSpacing 0;

  // Appearance
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
  padding: 2px 3px 3px 3px;
  border-radius: 4px;
  overflow: hidden;

  // For positioning child elements
  position: relative;

  // Fullscreen state: overlay covering entire viewport
  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    padding: 1rem;
    margin: 0;
    border-radius: 0;
    background-color: var(--bgBold);
    // Override any inline height constraints when fullscreen
    min-height: 100vh !important;
    max-height: 100vh !important;
    height: 100vh !important;
  }

  // Responsive - narrow panels
  &.is-panel-narrow {
    margin: 0rem 0.5rem 1rem 0;
  }
}

// Header - contains title, description, and action buttons
.card-header {
  display: flex;
  flex-direction: row;
  line-height: 1.2rem;
  padding: 3px 3px 2px 3px;
  flex-shrink: 0;

  h3 {
    font-size: 1.1rem;
    line-height: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--dashboard-interaction-selected, var(--link));
  }

  p {
    margin-top: -0.5rem;
    margin-bottom: 0.5rem;
    color: var(--dashboard-text-secondary, var(--textFaint));
  }
}

.header-labels {
  flex: 1;
}

.header-buttons {
  display: flex;
  flex-direction: row;
  margin-left: auto;
  flex-shrink: 0;
  min-width: fit-content;

  .btn-icon {
    background-color: transparent;
    border: none;
    color: var(--dashboard-interaction-selected, var(--link));
    opacity: 0.5;
    padding: 4px 8px;
    cursor: pointer;

    &:hover {
      background-color: var(--dashboard-bg-tertiary, #ffffff20);
      opacity: 1;
    }
  }
}

// Info panel - collapsible additional information
.info-panel {
  padding: 0.5rem;
  background-color: var(--dashboard-bg-tertiary, var(--bgPanel2));
  border-radius: 3px;
  margin: 0 3px 3px 3px;
  font-size: 0.9rem;
  color: var(--dashboard-text-secondary, var(--textFaint));
  flex-shrink: 0;

  p {
    margin: 0;
    line-height: 1.4;
  }
}

// Content area - fills remaining space, holds the slot content
.card-content {
  flex: 1;
  position: relative;
  min-height: 0; // Important for flex children to shrink properly
  overflow: hidden;

  // Loading state - animated logo background
  background: url('../../../assets/simwrapper-logo/SW_logo_icon_anim.gif');
  background-size: 8rem;
  background-repeat: no-repeat;
  background-position: center center;

  &.is-loaded {
    background: none;
  }
}

// Error display - positioned at bottom of card
.card-errors {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--bgError);
  color: #800;
  border: 1px solid var(--bgCream4);
  border-radius: 3px;
  padding: 0.5rem;
  z-index: 100;
  font-size: 0.9rem;
  font-weight: bold;
  max-height: 50%;
  overflow-y: auto;

  p {
    line-height: 1.2rem;
    margin: 0;
  }

  .close-btn {
    float: right;
    font-weight: bold;
    padding: 0 5px;
    cursor: pointer;

    &:hover {
      color: red;
      background-color: #88888833;
    }
  }
}
</style>

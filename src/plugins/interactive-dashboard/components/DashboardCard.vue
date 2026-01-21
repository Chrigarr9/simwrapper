<template lang="pug">
//- Card frame stays in place as a PLACEHOLDER - never changes size
//- This prevents layout shifts that cause other cards to resize
.dash-card-frame(
  :style="placeholderStyle"
  :class="frameClasses"
)
  //- Teleport wraps ALL card content - moves to body when fullscreen
  //- When disabled (not fullscreen), content renders here in the frame
  Teleport(to="body" :disabled="!isFullscreen")
    //- Wrapper that becomes fullscreen overlay when teleported
    .card-content-container(:class="{'fullscreen-overlay': isFullscreen}" @click.self="handleFullscreenClick")
      //- Card header with title/description and buttons
      .dash-card-headers(v-if="showHeader" :class="{'fullscreen': isFullscreen}")
        .header-labels(:style="{paddingLeft: card.type === 'text' ? '4px' : ''}")
          h3 {{ card.title }}
          p(v-if="card.description") {{ card.description }}

        .header-buttons
          //- Info button (only if card has info)
          button.button.is-small.is-white(
            v-if="card.info"
            @click="toggleInfo"
            :title="showInfo ? 'Hide Info' : 'Show Info'"
          )
            i.fa.fa-info-circle

          //- Enlarge/restore button
          button.button.is-small.is-white(
            @click="handleFullscreenClick"
            :title="isFullscreen ? 'Restore' : 'Enlarge'"
          )
            i.fa(:class="isFullscreen ? 'fa-compress' : 'fa-expand'")

      //- Info panel (collapsible) - state managed LOCALLY
      .info(v-show="showInfo")
        p
        p {{ card.info }}

      //- Content slot
      .card-content-wrapper(ref="contentWrapper" :id="card.id" :class="{'is-loaded': card.isLoaded}")
        slot

      //- Error display
      .error-text(v-if="card.errors && card.errors.length")
        span.clear-error(@click="clearErrors") &times;
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
     * CSS classes for the card frame
     */
    const frameClasses = computed(() => {
      return {
        wiide: true, // Always apply wiide class for consistency
        'is-panel-narrow': props.isPanelNarrow,
        'is-fullscreen': props.isFullscreen,
      }
    })

    /**
     * Placeholder style - maintains the card's normal dimensions
     * The frame ALWAYS stays in place with its normal size, even when fullscreen.
     * This prevents layout shifts that would cause other cards to resize.
     *
     * When fullscreen, the content is teleported to body via <Teleport>,
     * but this placeholder keeps the card's space reserved in the layout.
     */
    const placeholderStyle = computed(() => {
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

      // NOTE: No fullscreen styling here - the placeholder ALWAYS maintains
      // its normal size. Fullscreen is handled by teleporting content to body
      // with the .fullscreen-overlay CSS class.

      return style
    })

    return {
      showInfo,
      contentWrapper,
      toggleInfo,
      handleFullscreenClick,
      clearErrors,
      showHeader,
      frameClasses,
      placeholderStyle,
    }
  },
})
</script>

<style scoped lang="scss">
@import '@/styles.scss';

/*
 * DashboardCard component styles
 * Uses CSS variables from StyleManager for theme-aware colors:
 * - --dashboard-bg-primary, --dashboard-bg-secondary, --dashboard-bg-tertiary
 * - --dashboard-text-primary, --dashboard-text-secondary
 * - --dashboard-border-default, --dashboard-border-subtle
 * - --dashboard-interaction-hover, --dashboard-interaction-selected
 *
 * Fallback pattern: var(--dashboard-X, var(--app-X, #fallback))
 */

/*
 * Card content container - wraps all card content
 * When not fullscreen: renders inside .dash-card-frame
 * When fullscreen: teleported to body with .fullscreen-overlay class
 */
.card-content-container {
  display: contents; // When inside frame, don't add extra wrapper

  &.fullscreen-overlay {
    // When teleported to body, become fullscreen overlay
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    padding: 1rem;
    background-color: var(--bgBold);

    // Click outside content to close (handled by @click.self)
    cursor: pointer;

    // Content area should not trigger close
    > * {
      cursor: default;
    }

    .card-content-wrapper {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
  }
}

.dash-card-frame {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-rows: auto auto 1fr;
  margin: 0 $cardSpacing $cardSpacing 0;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
  padding: 2px 3px 3px 3px;
  border-radius: 4px;
  overflow: hidden;

  .dash-card-headers {
    display: flex;
    flex-direction: row;
    line-height: 1.2rem;
    padding: 3px 3px 2px 3px;
    overflow: visible;  // Prevent header buttons from being clipped

    p {
      margin-bottom: 0.1rem;
      color: var(--dashboard-text-secondary, var(--textFaint));
    }
  }

  .dash-card-headers.fullscreen {
    padding-top: 0;
  }

  .header-labels {
    flex: 1;
  }

  .header-buttons {
    display: flex;
    flex-direction: row;
    margin-left: auto;
    flex-shrink: 0;  // Prevent buttons from being squeezed out
    min-width: fit-content;  // Ensure buttons always have enough space

    button {
      background-color: #00000000;
      color: var(--dashboard-interaction-selected, var(--link));
      opacity: 0.5;
    }

    button:hover {
      background-color: var(--dashboard-bg-tertiary, #ffffff20);
      opacity: 1;
    }
  }

  h3 {
    grid-row: 1 / 2;
    font-size: 1.1rem;
    line-height: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--dashboard-interaction-selected, var(--link));
  }

  // If there is a description, fix the margins
  p {
    grid-row: 2 / 3;
    margin-top: -0.5rem;
    margin-bottom: 0.5rem;
  }
}

// Content wrapper - provides positioning context for content
.card-content-wrapper {
  grid-row: 3 / 4;
  position: relative;
  background: url('../../../assets/simwrapper-logo/SW_logo_icon_anim.gif');
  background-size: 8rem;
  background-repeat: no-repeat;
  background-position: center center;
}

.card-content-wrapper.is-loaded {
  background: none;
}

// Info panel styles
.info {
  padding: 0.5rem;
  background-color: var(--dashboard-bg-tertiary, var(--bgPanel2));
  border-radius: 3px;
  margin: 0 3px 3px 3px;
  font-size: 0.9rem;
  color: var(--dashboard-text-secondary, var(--textFaint));

  p {
    margin: 0;
    line-height: 1.4;
  }

  p:first-child {
    margin-bottom: 0;
  }
}

// Error display overlay
.error-text {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--bgError);
  color: #800;
  border: 1px solid var(--bgCream4);
  border-radius: 3px;
  margin-bottom: 0px;
  padding: 0.5rem 0.5rem;
  z-index: 25000;
  font-size: 0.9rem;
  font-weight: bold;
  max-height: 50%;
  overflow-y: auto;

  p {
    line-height: 1.2rem;
    margin: 0 0;
  }
}

.clear-error {
  float: right;
  font-weight: bold;
  margin-right: 2px;
  padding: 0px 5px;
}

.clear-error:hover {
  cursor: pointer;
  color: red;
  background-color: #88888833;
}

// Responsive styles for narrow panels
.dash-card-frame.is-panel-narrow {
  margin: 0rem 0.5rem 1rem 0;
}
</style>

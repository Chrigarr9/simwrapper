<template lang="pug">
.dash-card-frame(
  :style="cardStyle"
  :class="frameClasses"
)
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
        i.fa.fa-expand

  //- Info panel (collapsible) - state managed LOCALLY
  .info(v-show="showInfo")
    p
    p {{ card.info }}

  //- Content slot
  .card-content-wrapper(:id="card.id" :class="{'is-loaded': card.isLoaded}")
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
import { defineComponent, ref, computed, PropType } from 'vue'
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
     * Card style computed from card config and state
     * Ported from InteractiveDashboard.getCardStyle()
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

      // Handle fullscreen state
      if (props.anotherCardFullscreen) {
        // Another card is fullscreen - hide this one
        style.display = 'none'
      } else if (props.isFullscreen) {
        // This card is fullscreen - use position:fixed to cover entire viewport
        style = {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          zIndex: '10000',
          margin: '0',
          padding: '1rem',
          backgroundColor: 'var(--bgBold)',
        }
      }

      return style
    })

    return {
      showInfo,
      toggleInfo,
      handleFullscreenClick,
      clearErrors,
      showHeader,
      frameClasses,
      cardStyle,
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

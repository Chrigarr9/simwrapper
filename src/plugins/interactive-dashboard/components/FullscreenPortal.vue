<template lang="pug">
.fullscreen-portal-wrapper
  //- Original slot location (content rendered here normally)
  .portal-origin(ref="origin" v-show="!active")
    slot
  //- When active, content is moved to portal container on document.body
</template>

<script lang="ts">
import Vue from 'vue'

/**
 * FullscreenPortal - Teleports slot content to document.body when active.
 *
 * This component solves the CSS containment problem where `position: fixed`
 * doesn't work inside elements with `contain: layout`. By physically moving
 * the DOM content to document.body, we bypass all parent CSS containment.
 *
 * Usage:
 * ```pug
 * fullscreen-portal(:active="isFullscreen" @close="isFullscreen = false")
 *   .my-card
 *     //- Card content including header with close button
 * ```
 *
 * Props:
 * - active: Boolean - When true, teleports content to document.body
 *
 * Events:
 * - close: Emitted when Escape key pressed (parent should handle closing)
 */
export default Vue.extend({
  name: 'FullscreenPortal',
  props: {
    active: { type: Boolean, default: false }
  },
  data() {
    return {
      portalContainer: null as HTMLElement | null
    }
  },
  watch: {
    active: {
      handler(isActive: boolean) {
        if (isActive) {
          this.activatePortal()
        } else {
          this.deactivatePortal()
        }
      },
      immediate: false
    }
  },
  methods: {
    createPortalContainer(): HTMLElement {
      const container = document.createElement('div')
      container.className = 'fullscreen-portal-container'
      // Apply fullscreen styles directly (z-index higher than DataTableCard's 9999)
      Object.assign(container.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '10000',
        backgroundColor: 'var(--dashboard-bg-primary, var(--bgBold, #1a1a2e))',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem'
      })
      return container
    },
    activatePortal() {
      // Create portal container if it doesn't exist
      if (!this.portalContainer) {
        this.portalContainer = this.createPortalContainer()
      }

      // Move slot content to portal container
      const origin = this.$refs.origin as HTMLElement
      if (origin && origin.firstChild) {
        // Append portal container to body
        document.body.appendChild(this.portalContainer)

        // Move content from origin to portal
        while (origin.firstChild) {
          this.portalContainer.appendChild(origin.firstChild)
        }

        // Add Escape key listener
        document.addEventListener('keydown', this.handleKeydown)

        // Trigger resize event after DOM settles
        this.$nextTick(() => {
          window.dispatchEvent(new Event('resize'))
        })
      }
    },
    deactivatePortal() {
      if (!this.portalContainer) return

      // Move content back to origin
      const origin = this.$refs.origin as HTMLElement
      if (origin && this.portalContainer) {
        while (this.portalContainer.firstChild) {
          origin.appendChild(this.portalContainer.firstChild)
        }

        // Remove portal container from body
        if (this.portalContainer.parentNode) {
          this.portalContainer.parentNode.removeChild(this.portalContainer)
        }
      }

      // Remove Escape key listener
      document.removeEventListener('keydown', this.handleKeydown)

      // Trigger resize event
      this.$nextTick(() => {
        window.dispatchEvent(new Event('resize'))
      })
    },
    handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        this.$emit('close')
      }
    }
  },
  beforeDestroy() {
    // Cleanup: deactivate and remove listeners
    this.deactivatePortal()
    if (this.portalContainer && this.portalContainer.parentNode) {
      this.portalContainer.parentNode.removeChild(this.portalContainer)
    }
  }
})
</script>

<style scoped lang="scss">
.fullscreen-portal-wrapper {
  display: contents; // Wrapper doesn't affect layout
}

.portal-origin {
  display: contents; // Origin doesn't affect layout when visible
}
</style>

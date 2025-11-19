<template lang="pug">
.scroll-toggle
  label(:class="{ active: localValue }")
    input(type="checkbox" v-model="localValue" @change="onChange")
    span.mode-label {{ localValue ? 'Auto-scroll On' : 'Auto-scroll Off' }}
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ScrollToggle',
  props: {
    modelValue: { type: Boolean, default: true },
  },

  data() {
    return {
      localValue: this.modelValue,
    }
  },

  watch: {
    modelValue(newVal) {
      this.localValue = newVal
    },
  },

  methods: {
    onChange() {
      console.log('ScrollToggle.onChange:', this.localValue)
      this.$emit('update:modelValue', this.localValue)
    },
  },
})
</script>

<style scoped lang="scss">
.scroll-toggle {
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background-color: var(--bgCream);
    border: 2px solid var(--borderStrong);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    &:hover {
      background-color: var(--bgHover);
      border-color: var(--link);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    &:focus-within {
      outline: none;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    // Active state - when auto-scroll is ON
    &.active {
      background-color: #10b981;
      border-color: #059669;
      color: white;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);

      &:hover {
        background-color: #059669;
        border-color: #047857;
        box-shadow: 0 3px 6px rgba(16, 185, 129, 0.4);
        transform: translateY(-1px);
      }

      .mode-label {
        font-weight: 600;
      }
    }

    .mode-label {
      font-weight: 600;
      transition: font-weight 0.15s;
    }

    input[type='checkbox'] {
      width: 1rem;
      height: 1rem;
      cursor: pointer;
    }
  }
}
</style>

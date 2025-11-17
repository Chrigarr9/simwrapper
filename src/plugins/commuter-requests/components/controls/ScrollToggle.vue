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
    border: 1px solid var(--borderStrong);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

    &:hover {
      background-color: var(--bgHover);
      border-color: var(--link);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
      }

      .mode-label {
        font-weight: 600;
      }
    }

    .mode-label {
      font-weight: 500;
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

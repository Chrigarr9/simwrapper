<template lang="pug">
.comparison-toggle
  label(:class="{ active: !localValue }")
    input(type="checkbox" v-model="localValue" @change="onChange")
    span.mode-label {{ localValue ? 'Focus' : 'Comparison' }}
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ComparisonToggle',
  props: {
    modelValue: { type: Boolean, default: false },
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
      console.log('ComparisonToggle.onChange:', this.localValue)
      this.$emit('update:modelValue', this.localValue)
    },
  },
})
</script>

<style scoped lang="scss">
.comparison-toggle {
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
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    // Active state - when comparison mode is ON
    &.active {
      background-color: #3b82f6;
      border-color: #2563eb;
      color: white;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);

      &:hover {
        background-color: #2563eb;
        border-color: #1d4ed8;
        box-shadow: 0 3px 6px rgba(59, 130, 246, 0.4);
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

<template lang="pug">
button.reset-button(@click="onClick" :disabled="!hasActiveFilters")
  span 🔄
  span Reset Filters
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'FilterResetButton',
  props: {
    hasActiveFilters: { type: Boolean, default: false },
  },

  methods: {
    onClick() {
      this.$emit('reset')
    },
  },
})
</script>

<style scoped lang="scss">
.reset-button {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border: 2px solid var(--borderStrong);
  border-radius: 6px;
  background-color: var(--bgCream);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover:not(:disabled) {
    background-color: var(--bgHover);
    border-color: var(--link);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    background-color: var(--bgCream2);
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  &:focus {
    outline: none;
    border-color: var(--link);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background-color: var(--bgPanel);
  }

  span:first-child {
    font-size: 0.95rem;
  }
}
</style>

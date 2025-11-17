<template lang="pug">
.comparison-toggle
  label(:class="{ active: localValue }")
    input(type="checkbox" v-model="localValue" @change="onChange")
    span Show Comparison
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

    input[type='checkbox'] {
      width: 1rem;
      height: 1rem;
      cursor: pointer;
    }
  }
}
</style>

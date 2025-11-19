<template lang="pug">
.color-by-selector
  label Color by:
  select(v-model="localValue" @change="onChange")
    option(
      v-for="attr in options"
      :key="attr.attribute"
      :value="attr.attribute"
    ) {{ attr.label }}
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { ColorByAttribute } from '../../CommuterRequestsConfig'

export default defineComponent({
  name: 'ColorBySelector',
  props: {
    modelValue: {
      type: String,
      default: 'main_mode',
    },
    options: {
      type: Array as PropType<ColorByAttribute[]>,
      required: true,
    },
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
      console.log('ColorBySelector.onChange:', this.localValue)
      this.$emit('update:modelValue', this.localValue)
    },
  },
})
</script>

<style scoped lang="scss">
.color-by-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  label {
    font-weight: 500;
    font-size: 0.85rem;
    color: var(--text);
  }

  select {
    padding: 0.4rem 0.75rem;
    border: 2px solid var(--borderStrong);
    border-radius: 6px;
    background-color: var(--bgCream);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;

    &:hover {
      background-color: var(--bgHover);
      border-color: var(--link);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    &:focus {
      outline: none;
      border-color: var(--link);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
  }
}
</style>

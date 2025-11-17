<template lang="pug">
.cluster-type-selector
  label Cluster Type:
  select(v-model="localValue" @change="onChange")
    option(value="origin") Origin
    option(value="destination") Destination
    option(value="spatial") Origin-Destination (Spatial)
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ClusterTypeSelector',
  props: {
    modelValue: {
      type: String as () => 'origin' | 'destination' | 'spatial',
      default: 'origin',
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
      this.$emit('update:modelValue', this.localValue)
    },
  },
})
</script>

<style scoped lang="scss">
.cluster-type-selector {
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
    border: 1px solid var(--borderStrong);
    border-radius: 4px;
    background-color: var(--bgCream);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

    &:hover {
      background-color: var(--bgHover);
      border-color: var(--link);
    }

    &:focus {
      outline: none;
      border-color: var(--link);
      box-shadow: 0 0 0 2px var(--bgHover);
    }
  }
}
</style>

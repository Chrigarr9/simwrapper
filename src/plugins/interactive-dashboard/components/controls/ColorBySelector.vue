<template lang="pug">
.control-item
  label.control-label Color by
  select.control-select(
    :value="modelValue"
    @change="onChange"
  )
    option(value="") None
    option(
      v-for="opt in options"
      :key="opt.attribute"
      :value="opt.attribute"
    ) {{ opt.label }}
</template>

<script setup lang="ts">
interface Props {
  modelValue: string  // current colorByAttribute ('' = None)
  options: Array<{ attribute: string; label: string }>
}

const props = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped lang="scss">
.control-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.control-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--dashboard-text-primary, var(--text, #374151));
  opacity: 0.8;
}

.control-select {
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  border: 1px solid var(--dashboard-border-default, var(--borderColor, #d1d5db));
  border-radius: 4px;
  background: var(--dashboard-bg-primary, var(--bgCream, white));
  color: var(--dashboard-text-primary, var(--text, #374151));
  cursor: pointer;
  min-width: 100px;
}

.control-select:hover {
  border-color: var(--dashboard-interaction-selected, var(--link, #3b82f6));
}

.control-select:focus {
  outline: none;
  border-color: var(--dashboard-interaction-selected, var(--link, #3b82f6));
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
</style>

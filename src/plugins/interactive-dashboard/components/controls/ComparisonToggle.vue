<template lang="pug">
.comparison-toggle
  label(:class="{ disabled: disabled }")
    input(
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    )
    span.mode-label Comparison
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits(['update:model-value'])

const onChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  console.log('[ComparisonToggle] onChange - checked:', target.checked, 'disabled:', props.disabled)
  emit('update:model-value', target.checked)
}
</script>

<style scoped lang="scss">
.comparison-toggle {
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.65rem;
    background-color: var(--dashboard-bg-tertiary, var(--bgPanel2));
    border: 1px solid var(--dashboard-border-default, var(--borderColor));
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--dashboard-text-primary, var(--text));
    transition: all 0.15s ease;
    user-select: none;

    &:hover:not(.disabled) {
      background-color: var(--dashboard-bg-secondary, var(--bgHover));
      border-color: var(--dashboard-interaction-selected, #3b82f6);
    }

    &:active:not(.disabled) {
      transform: translateY(1px);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .mode-label {
      font-weight: 600;
    }

    input[type='checkbox'] {
      width: 1rem;
      height: 1rem;
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
      }
    }
  }
}
</style>

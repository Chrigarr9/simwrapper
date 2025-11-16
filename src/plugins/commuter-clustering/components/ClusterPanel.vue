<template lang="pug">
.cluster-panel

  //- Cluster type selector
  .panel-section
    h3 Cluster Visibility
    .cluster-type-selector
      label.radio-label(:class="{ active: clusterType === null }")
        input(
          type="radio"
          value="none"
          :checked="clusterType === null"
          @change="handleTypeChange(null)"
        )
        span None
      label.radio-label(:class="{ active: clusterType === 'origin' }")
        input(
          type="radio"
          value="origin"
          :checked="clusterType === 'origin'"
          @change="handleTypeChange('origin')"
        )
        span Origin
      label.radio-label(:class="{ active: clusterType === 'destination' }")
        input(
          type="radio"
          value="destination"
          :checked="clusterType === 'destination'"
          @change="handleTypeChange('destination')"
        )
        span Destination
      label.radio-label(:class="{ active: clusterType === 'spatial' }")
        input(
          type="radio"
          value="spatial"
          :checked="clusterType === 'spatial'"
          @change="handleTypeChange('spatial')"
        )
        span O-D Pairs

  //- Cluster list (only show when a cluster type is selected)
  .panel-section(v-if="clusterType !== null")
    h3 Clusters ({{ clusters.length }})
    .cluster-list
      //- "All" option
      .cluster-item(
        :class="{ selected: selectedCluster === null }"
        @click="handleClusterSelect(null)"
      )
        .cluster-label All Clusters
        .cluster-count {{ totalRequests }}

      //- Individual clusters
      .cluster-item(
        v-for="clusterId in clusters"
        :key="clusterId"
        :class="{ selected: selectedCluster === clusterId }"
        @click="handleClusterSelect(clusterId)"
      )
        .cluster-label Cluster {{ clusterId }}
        .cluster-count {{ requestCounts.get(clusterId) || 0 }}

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { ClusterType } from '../CommuterClusteringConfig'

export default defineComponent({
  name: 'ClusterPanel',
  props: {
    clusterType: { type: String as PropType<ClusterType | null>, default: null },
    clusters: { type: Array as PropType<Array<number | string>>, required: true },
    selectedCluster: { type: [Number, String] as PropType<number | string | null>, default: null },
    requestCounts: { type: Map as PropType<Map<number | string, number>>, required: true },
  },
  emits: ['type-changed', 'cluster-selected'],
  computed: {
    totalRequests(): number {
      let total = 0
      this.requestCounts.forEach(count => {
        total += count
      })
      return total
    },
  },
  methods: {
    handleTypeChange(type: ClusterType | null) {
      this.$emit('type-changed', type)
    },
    handleClusterSelect(clusterId: number | null) {
      this.$emit('cluster-selected', clusterId)
    },
  },
})
</script>

<style scoped lang="scss">
.cluster-panel {
  background-color: var(--bgCream);
  border-radius: 4px;
  padding: 1rem;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }
}

.cluster-type-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .radio-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
    border: 2px solid transparent;

    &:hover {
      background-color: var(--bgHover);
    }

    &.active {
      background-color: var(--linkHover);
      border-color: var(--link);
      color: white;
      font-weight: 600;

      span {
        color: white;
      }
    }

    input {
      margin-right: 0.5rem;
    }

    span {
      font-size: 0.9rem;
    }
  }
}

.cluster-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 400px;
  overflow-y: auto;
}

.cluster-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: var(--bgPanel);

  &:hover {
    background-color: var(--bgHover);
  }

  &.selected {
    background-color: var(--linkHover);
    color: white;

    .cluster-label,
    .cluster-count {
      color: white;
    }
  }

  .cluster-label {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .cluster-count {
    font-size: 0.85rem;
    color: var(--textFaded);
    font-weight: 600;
  }
}
</style>

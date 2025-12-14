<template lang="pug">
.sub-dashboard-wrapper(:class="{ 'is-collapsed': isCollapsed }")
  //- Collapsible Header
  .sub-dashboard-header(@click="toggleCollapse")
    span.collapse-icon {{ isCollapsed ? '▶' : '▼' }}
    h3.section-title {{ config.title || 'Sub-Dashboard' }}
    span.filter-badge(v-if="parentFilterValue")
      | {{ parentFilterColumn }}: {{ parentFilterValue }}
    span.data-count(v-if="filteredDataCount >= 0")
      | ({{ filteredDataCount }} rows)

  //- Embedded InteractiveDashboard Content
  .sub-dashboard-content(v-if="!isCollapsed && embeddedYaml")
    //- Use Vue 2 async component with local registration
    //- Key ensures fresh instance for each parent selection
    embedded-dashboard(
      :key="`embed-${config.title}-${parentFilterValue}`"
      :root="root"
      :xsubfolder="subfolder"
      :all-config-files="allConfigFiles"
      :datamanager="datamanager"
      :split="split"
      :embedded="true"
      :embedded-yaml="embeddedYaml"
      :parent-filter-column="parentFilterColumn"
      :parent-filter-value="parentFilterValue"
      :preloaded-data="preloadedData"
    )
</template>

<script lang="ts">
import Vue from 'vue'

/**
 * SubDashboard is a simple wrapper that renders an InteractiveDashboard
 * in embedded mode with parent filtering applied.
 * 
 * This allows sub-dashboards to have the EXACT same functionality as
 * standalone dashboards, just filtered by a parent selection.
 */
export default Vue.extend({
  name: 'SubDashboard',
  
  // Vue 2 async component registration - this is the proper way to handle circular imports
  components: {
    'embedded-dashboard': () => import('../../InteractiveDashboard.vue') as any
  },
  
  props: {
    // Sub-dashboard configuration (converted to embeddedYaml)
    config: {
      type: Object,
      required: true
    },
    // Parent filter settings
    parentFilterColumn: {
      type: String,
      required: true
    },
    parentFilterValue: {
      type: String,
      default: null
    },
    // Pre-loaded data from parent (keyed by dataset filename)
    allData: {
      type: Array,
      default: () => []
    },
    // File system props passed through to InteractiveDashboard
    fileSystemConfig: {
      type: Object,
      default: null
    },
    subfolder: {
      type: String,
      default: ''
    },
    // Props needed by InteractiveDashboard
    root: {
      type: String,
      default: ''
    },
    allConfigFiles: {
      type: Object,
      default: () => ({})
    },
    datamanager: {
      type: Object,
      default: null
    },
    split: {
      type: Object,
      default: () => ({ x: 1, y: 1 })
    },
    // Initial state
    initialCollapsed: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      isCollapsed: this.initialCollapsed
    }
  },

  computed: {
    // Convert config to YAML format expected by InteractiveDashboard
    embeddedYaml(): any {
      if (!this.config) return null
      
      // Build a proper InteractiveDashboard YAML structure from sub-dashboard config
      return {
        header: {
          title: this.config.title,
          tab: this.config.title
        },
        table: this.config.table,
        layout: this.config.layout,
        map: this.config.map,
        // Don't include subDashboards in embedded dashboards to prevent recursion
      }
    },

    // Build preloaded data object keyed by dataset name
    preloadedData(): Record<string, any[]> {
      if (!this.config?.table?.dataset || !this.allData) return {}
      
      return {
        [this.config.table.dataset]: this.allData
      }
    },

    // Count of filtered data for display
    filteredDataCount(): number {
      if (!this.allData || !this.parentFilterColumn || !this.parentFilterValue) {
        return this.allData?.length || 0
      }
      
      return this.allData.filter((row: any) => 
        String(row[this.parentFilterColumn]) === String(this.parentFilterValue)
      ).length
    }
  },

  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
    }
  }
})
</script>

<style scoped lang="scss">
.sub-dashboard-wrapper {
  background: #1a1a2e;
  border: 2px solid #3a3a5e;
  border-radius: 8px;
  margin-top: 1.5rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  // Ensure proper containment
  position: relative;
  contain: layout;
}

.sub-dashboard-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #2a2a4e 0%, #1a1a3e 100%);
  cursor: pointer;
  user-select: none;
  border-bottom: 2px solid #3a3a5e;

  &:hover {
    background: linear-gradient(135deg, #3a3a5e 0%, #2a2a4e 100%);
  }
}

.collapse-icon {
  font-size: 0.8rem;
  color: #8888aa;
  width: 1rem;
  text-align: center;
}

.section-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #e0e0e0;
}

.filter-badge {
  background: #007bff;
  color: white;
  padding: 0.2rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.data-count {
  color: #8888aa;
  font-size: 0.85rem;
  margin-left: auto;
}

.sub-dashboard-content {
  padding: 0;
  min-height: 200px;
  // Ensure proper containment for nested dashboard
  position: relative;
  overflow: auto;
  
  // The embedded InteractiveDashboard will handle its own layout
  // Hide the header in embedded dashboards (we have our own)
  :deep(.dash-header) {
    display: none !important;
  }
  
  :deep(.dashboard-header) {
    display: none !important;
  }
  
  // Override any fixed or absolute positioning from embedded dashboard
  :deep(.dashboard) {
    position: relative !important;
  }
  
  :deep(.dashboard-content) {
    position: relative !important;
  }
}
</style>

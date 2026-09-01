<script setup lang="ts">
import { type Scope } from "@caido/sdk-frontend";

defineProps<{
  scope: Scope | undefined;
}>();
</script>

<template>
  <div
    class="rounded border px-3 py-2 text-sm"
    :class="scope ? 'border-surface-700 text-surface-300' : 'border-orange-700 text-orange-300'"
  >
    <template v-if="scope">
      Watching traffic in Caido's active Scope: <span class="font-mono font-semibold">{{ scope.name }}</span>
      <span class="text-surface-400"> ({{ scope.allowlist.join(", ") || "no allowlist patterns" }})</span>
    </template>
    <template v-else>
      No Scope is currently selected in Caido - nothing will be captured. Select or create a Scope
      to start watching traffic.
    </template>
  </div>
</template>

<script setup lang="ts">
import { type Scope } from "@caido/sdk-frontend";

defineProps<{
  scopes: Scope[];
}>();
</script>

<template>
  <div
    class="rounded border px-3 py-2 text-sm"
    :class="scopes.length > 0 ? 'border-surface-700 text-surface-300' : 'border-orange-700 text-orange-300'"
  >
    <template v-if="scopes.length > 0">
      Watching traffic matching
      <span class="font-mono font-semibold">{{ scopes.length }}</span>
      saved Caido {{ scopes.length === 1 ? "Scope" : "Scopes" }}:
      <span v-for="(scope, i) in scopes" :key="scope.id" class="font-mono">
        {{ scope.name }}<span v-if="i < scopes.length - 1">, </span>
      </span>
    </template>
    <template v-else>
      No Scope is defined in Caido - nothing will be captured. Create a Scope covering your target
      to start watching traffic.
    </template>
  </div>
</template>

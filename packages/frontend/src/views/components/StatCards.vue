<script setup lang="ts">
defineProps<{
  totalCaptures: number;
  totalEndpoints: number;
  aiRelatedEndpoints: number;
  skillsSeen: number;
}>();
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="rounded border border-surface-700 px-4 py-3 text-center">
      <div class="text-2xl font-semibold">{{ totalCaptures }}</div>
      <div class="mt-1 text-xs opacity-70">Total Captures</div>
    </div>
    <div class="rounded border border-surface-700 px-4 py-3 text-center">
      <div class="text-2xl font-semibold">{{ totalEndpoints }}</div>
      <div class="mt-1 text-xs opacity-70">Endpoints Discovered</div>
    </div>
    <div class="rounded border border-surface-700 px-4 py-3 text-center">
      <div class="text-2xl font-semibold">{{ aiRelatedEndpoints }}</div>
      <div class="mt-1 text-xs opacity-70">AI-Related Endpoints</div>
    </div>
    <div class="rounded border border-surface-700 px-4 py-3 text-center">
      <div class="text-2xl font-semibold">{{ skillsSeen }}</div>
      <div class="mt-1 text-xs opacity-70">Skills/Tools Seen</div>
    </div>
  </div>
</template>

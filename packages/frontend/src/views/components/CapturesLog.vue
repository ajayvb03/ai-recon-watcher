<script setup lang="ts">
import { type CaptureRow } from "backend";
import InputText from "primevue/inputtext";
import { computed, ref } from "vue";

const props = defineProps<{
  rows: CaptureRow[];
}>();

const search = ref("");

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter(
    (row) =>
      row.host.toLowerCase().includes(q) ||
      row.path.toLowerCase().includes(q) ||
      row.method.toLowerCase().includes(q) ||
      String(row.status_code).includes(q),
  );
});

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const statusClass = (code: number) => {
  if (code >= 500) return "bg-red-500/20 text-red-400";
  if (code >= 400) return "bg-yellow-500/20 text-yellow-400";
  return "bg-green-500/20 text-green-400";
};

const prettyJson = (data: string) => {
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return data;
  }
};
</script>

<template>
  <div>
    <h3 class="mb-2 text-sm opacity-85">Recent Captures (raw JSON store)</h3>
    <p v-if="rows.length === 0" class="text-sm opacity-60">Nothing captured yet.</p>
    <template v-else>
      <InputText
        v-model="search"
        placeholder="Filter by host, path, method, or status..."
        class="mb-2 w-full"
      />
      <p v-if="filtered.length === 0" class="text-sm opacity-60">No captures match your filter.</p>
      <div v-else class="flex flex-col gap-1">
        <details
          v-for="row in filtered"
          :key="row.id"
          class="rounded border border-surface-700 px-2 py-1"
        >
          <summary class="flex cursor-pointer items-center gap-3 text-sm">
            <span class="font-mono font-semibold">{{ row.method }}</span>
            <span>{{ row.path }}</span>
            <span class="text-xs opacity-60">{{ row.host }}</span>
            <span class="rounded px-1.5 py-0.5 text-xs" :class="statusClass(row.status_code)">{{
              row.status_code
            }}</span>
            <span class="text-xs opacity-60">{{ row.roundtrip_ms }}ms</span>
            <span class="text-xs opacity-60">{{ formatDate(row.created_at) }}</span>
          </summary>
          <pre class="mt-2 max-h-[300px] overflow-auto rounded bg-surface-800 p-2 text-xs">{{
            prettyJson(row.data)
          }}</pre>
        </details>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { type EndpointRow } from "backend";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";
import { computed, ref } from "vue";

const props = defineProps<{
  rows: EndpointRow[];
}>();

const search = ref("");

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter(
    (r) =>
      r.host.toLowerCase().includes(q) ||
      r.path.toLowerCase().includes(q) ||
      r.method.toLowerCase().includes(q),
  );
});

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};
</script>

<template>
  <div>
    <h3 class="mb-2 text-sm opacity-85">Discovered Endpoints (attack surface)</h3>
    <p v-if="rows.length === 0" class="text-sm opacity-60">
      No traffic observed yet - browse the target through Caido to populate this.
    </p>
    <template v-else>
      <InputText
        v-model="search"
        placeholder="Filter by host, path, or method..."
        class="mb-2 w-full"
      />
      <DataTable :value="filtered" size="small" scrollable scroll-height="320px">
        <template #empty>No endpoints match your filter.</template>
        <Column field="method" header="Method">
          <template #body="{ data }"><span class="font-mono font-semibold">{{ data.method }}</span></template>
        </Column>
        <Column field="path" header="Path" />
        <Column field="host" header="Host" />
        <Column field="hit_count" header="Hits" />
        <Column field="ai_related" header="AI-related">
          <template #body="{ data }">
            <Tag v-if="data.ai_related" severity="info" value="AI" />
          </template>
        </Column>
        <Column field="first_seen" header="First seen">
          <template #body="{ data }">{{ formatDate(data.first_seen) }}</template>
        </Column>
        <Column field="last_seen" header="Last seen">
          <template #body="{ data }">{{ formatDate(data.last_seen) }}</template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

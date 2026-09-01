<script setup lang="ts">
import { type SkillRow } from "backend";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import { computed, ref } from "vue";

const props = defineProps<{
  rows: SkillRow[];
}>();

const search = ref("");

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter(
    (r) => r.skill_name.toLowerCase().includes(q) || r.host.toLowerCase().includes(q),
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
    <h3 class="mb-2 text-sm opacity-85">Skills / Tools Map (agent capability surface)</h3>
    <p v-if="rows.length === 0" class="text-sm opacity-60">
      No tool/function/skill invocations detected yet - populated when the model's responses
      contain OpenAI/Anthropic-style function calls, MCP tools/call messages, or a custom
      tool/skill/action field.
    </p>
    <template v-else>
      <InputText
        v-model="search"
        placeholder="Filter by skill name or host..."
        class="mb-2 w-full"
      />
      <DataTable :value="filtered" size="small" scrollable scroll-height="320px">
        <template #empty>No skills match your filter.</template>
        <Column field="skill_name" header="Skill / Tool">
          <template #body="{ data }"><span class="font-mono font-semibold">{{ data.skill_name }}</span></template>
        </Column>
        <Column field="host" header="Host" />
        <Column field="call_count" header="Calls" />
        <Column field="last_source" header="Seen in" />
        <Column field="first_seen" header="First seen">
          <template #body="{ data }">{{ formatDate(data.first_seen) }}</template>
        </Column>
        <Column field="last_seen" header="Last seen">
          <template #body="{ data }">{{ formatDate(data.last_seen) }}</template>
        </Column>
        <Column field="last_args" header="Last arguments">
          <template #body="{ data }"><span class="text-xs opacity-60">{{ data.last_args }}</span></template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

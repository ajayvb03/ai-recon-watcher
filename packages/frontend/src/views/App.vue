<script setup lang="ts">
import { type CaptureRow, type EndpointRow, type SkillRow } from "backend";
import { type Scope } from "@caido/sdk-frontend";
import Button from "primevue/button";
import { onMounted, ref } from "vue";

import { useSDK } from "@/plugins/sdk";
import { buildMarkdownReport, downloadText } from "@/report";

import CapturesLog from "./components/CapturesLog.vue";
import EndpointsTable from "./components/EndpointsTable.vue";
import ScopeBanner from "./components/ScopeBanner.vue";
import SkillsTable from "./components/SkillsTable.vue";
import StatCards from "./components/StatCards.vue";

const sdk = useSDK();

const loading = ref(true);
const loadError = ref<string | undefined>(undefined);

const totalCaptures = ref(0);
const totalEndpoints = ref(0);
const aiRelatedEndpoints = ref(0);
const endpoints = ref<EndpointRow[]>([]);
const captures = ref<CaptureRow[]>([]);
const skills = ref<SkillRow[]>([]);
const scopes = ref<Scope[]>([]);

const load = async () => {
  loading.value = true;
  loadError.value = undefined;
  try {
    scopes.value = sdk.scopes.getScopes();
    const [summary, endpointRows, captureRows, skillRows] = await Promise.all([
      sdk.backend.getSummary(),
      sdk.backend.getEndpoints(),
      sdk.backend.getRecentCaptures(50),
      sdk.backend.getSkills(),
    ]);
    totalCaptures.value = summary.totalCaptures;
    totalEndpoints.value = summary.totalEndpoints;
    aiRelatedEndpoints.value = summary.aiRelatedEndpoints;
    endpoints.value = endpointRows;
    captures.value = captureRows;
    skills.value = skillRows;
  } catch (err) {
    loadError.value = String(err);
    sdk.log.error(`[ai-recon-watcher] failed to load dashboard data: ${String(err)}`);
  } finally {
    loading.value = false;
  }
};

const onExport = () => {
  const report = buildMarkdownReport({
    totalCaptures: totalCaptures.value,
    totalEndpoints: totalEndpoints.value,
    aiRelatedEndpoints: aiRelatedEndpoints.value,
    scopeName: scopes.value.map((s) => s.name).join(", ") || undefined,
    endpoints: endpoints.value,
    captures: captures.value,
    skills: skills.value,
  });
  downloadText(
    `ai-recon-watcher-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`,
    report,
  );
};

const onClear = async () => {
  if (!window.confirm("Clear all captured requests/responses and discovered endpoints? This cannot be undone.")) {
    return;
  }
  try {
    await sdk.backend.clearCapturedData();
    await load();
  } catch (err) {
    sdk.log.error(`[ai-recon-watcher] failed to clear data: ${String(err)}`);
  }
};

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">AI Recon Watcher</h2>
      <div class="flex gap-2">
        <Button label="Refresh" size="small" outlined @click="load" />
        <Button label="Export Report" size="small" outlined @click="onExport" />
        <Button label="Clear Data" size="small" severity="danger" outlined @click="onClear" />
      </div>
    </div>

    <p v-if="loadError" class="text-sm text-red-400">Failed to load data: {{ loadError }}</p>
    <p v-else-if="loading" class="text-sm opacity-60">Loading...</p>

    <template v-else>
      <ScopeBanner :scopes="scopes" />

      <StatCards
        :total-captures="totalCaptures"
        :total-endpoints="totalEndpoints"
        :ai-related-endpoints="aiRelatedEndpoints"
        :skills-seen="skills.length"
      />

      <p class="text-sm opacity-60">
        Deeper signals (secrets, CORS, missing headers, framework fingerprints, robots.txt
        anomalies, JS crypto/config disclosure) are reported as Findings - check the Findings
        panel.
      </p>

      <EndpointsTable :rows="endpoints" />
      <SkillsTable :rows="skills" />
      <CapturesLog :rows="captures" />
    </template>
  </div>
</template>

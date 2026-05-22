<script lang="ts">
import type { TinroRouteMeta } from 'tinro';
import { SettingsNavItem } from '@podman-desktop/ui-svelte';
import {
  faCubes,
  faDatabase,
  faGear,
  faHouse,
  faLayerGroup,
  faNetworkWired,
  faPuzzlePiece,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { faRedhat } from '@fortawesome/free-brands-svg-icons';
import { getContext, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import type { KubernetesObject } from '@kubernetes/client-node';
import { Navigator } from '/@/navigation/navigator';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import { States } from '/@/state/states';
import { Remote } from '/@/remote/remote';
import { API_CUSTOM_RESOURCES } from '@kubernetes-dashboard/channels';
import type { ContextResourceItems, CustomResourcesApi, DiscoveredResource } from '@kubernetes-dashboard/channels';
import kubernetesIcon from '/@/kubernetes-icon.png';

interface Props {
  meta: TinroRouteMeta;
}

const { meta }: Props = $props();

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const navigator = dependencyAccessor.get<Navigator>(Navigator);

const states = getContext<States>(States);
const updateResource = states.stateUpdateResourceInfoUI;
const currentContext = states.stateCurrentContextInfoUI;

let unsubscribers: Unsubscriber[] = [];

interface CrdVersionSpec {
  name?: string;
  served?: boolean;
  storage?: boolean;
}

interface CrdSpec {
  group?: string;
  scope?: string;
  names?: { kind?: string; plural?: string };
  versions?: CrdVersionSpec[];
}

interface CrdGroupEntry {
  kind: string;
  plural: string;
  version: string;
  scope: string;
}

interface CrdGroup {
  group: string;
  crds: CrdGroupEntry[];
}

function getCrdItems(resources: ContextResourceItems[]): readonly KubernetesObject[] {
  return resources.filter(r => !r.contextName && r.resourceName === 'customresourcedefinitions').flatMap(r => r.items);
}

function getServedVersion(versions: CrdVersionSpec[] | undefined): string {
  if (!versions?.length) return 'v1';
  const served = versions.find(v => v.served);
  return served?.name ?? versions[0]?.name ?? 'v1';
}

const crdGroups = $derived.by((): CrdGroup[] => {
  const items = getCrdItems(updateResource?.data?.resources ?? []);
  const groupMap: Record<string, CrdGroupEntry[]> = {};

  for (const item of items) {
    const spec = (item as unknown as { spec?: CrdSpec }).spec;
    const group = spec?.group ?? '';
    const kind = spec?.names?.kind ?? '';
    const plural = spec?.names?.plural ?? '';
    const version = getServedVersion(spec?.versions);
    const scope = spec?.scope ?? 'Namespaced';

    if (!group || !plural) continue;

    if (!groupMap[group]) {
      groupMap[group] = [];
    }
    groupMap[group].push({ kind, plural, version, scope });
  }

  return Object.entries(groupMap)
    .filter(([group]) => !group.endsWith('.openshift.io'))
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([group, crds]) => ({
      group,
      crds: crds.toSorted((a, b) => a.kind.localeCompare(b.kind)),
    }));
});

function customResourceUrl(group: string, version: string, plural: string): string {
  return `/customresources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}`;
}

const remote = getContext<Remote>(Remote);
const customResourcesApi = remote.getProxy<CustomResourcesApi>(API_CUSTOM_RESOURCES);

interface OpenShiftGroup {
  group: string;
  resources: DiscoveredResource[];
}

let openshiftGroups = $state<OpenShiftGroup[]>([]);

async function discoverOpenShiftResources(): Promise<void> {
  try {
    const resources = await customResourcesApi.discoverApiResources('.openshift.io');
    const groupMap: Record<string, DiscoveredResource[]> = {};
    for (const r of resources) {
      if (!groupMap[r.group]) groupMap[r.group] = [];
      groupMap[r.group].push(r);
    }
    openshiftGroups = Object.entries(groupMap)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([group, res]) => ({
        group,
        resources: res.toSorted((a, b) => a.kind.localeCompare(b.kind)),
      }));
  } catch {
    openshiftGroups = [];
  }
}

onMount(() => {
  unsubscribers.push(
    updateResource.subscribe({
      contextName: undefined,
      resourceName: 'customresourcedefinitions',
    }),
  );
  unsubscribers.push(currentContext.subscribe());
});

onDestroy(() => {
  unsubscribers.forEach(u => u());
});

const url = $derived(meta.url);

function isUnderSection(sectionUrls: string[]): boolean {
  return sectionUrls.some(u => url === u || url.startsWith(u + '/'));
}

const workloadUrls = [
  navigator.kubernetesResourcesURL('Deployment'),
  navigator.kubernetesResourcesURL('Pod'),
  navigator.kubernetesResourcesURL('Job'),
  navigator.kubernetesResourcesURL('CronJob'),
];

const configUrls = [
  navigator.kubernetesResourcesURL('ConfigMap'),
  navigator.kubernetesResourcesURL('CustomResourceDefinition'),
];

const networkUrls = [
  navigator.kubernetesResourcesURL('Service'),
  navigator.kubernetesResourcesURL('Ingress'),
  '/portForward',
];

const storageUrls = [navigator.kubernetesResourcesURL('PersistentVolumeClaim')];

const STORAGE_KEY = 'nav-sections-expanded';

function loadExpanded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function initExpanded(key: string, sectionUrls: string[]): boolean {
  const saved = loadExpanded();
  if (key in saved) return saved[key];
  return isUnderSection(sectionUrls);
}

function saveExpanded(key: string, value: boolean): void {
  const current = loadExpanded();
  current[key] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

let workloadsExpanded = $state(initExpanded('compute', workloadUrls));
let configExpanded = $state(initExpanded('config', configUrls));
let networkExpanded = $state(initExpanded('network', networkUrls));
let storageExpanded = $state(initExpanded('storage', storageUrls));
let customResourcesExpanded = $state(initExpandedByKey('customResources'));
let openshiftExpanded = $state(initExpandedByKey('openshift'));

function initExpandedByKey(key: string): boolean {
  const saved = loadExpanded();
  if (key in saved) return saved[key];
  return false;
}

let crdGroupExpandState = $state<Record<string, boolean>>(loadCrdGroupState());

function loadCrdGroupState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('nav-crd-groups-expanded') ?? '{}');
  } catch {
    return {};
  }
}

function saveCrdGroupState(): void {
  localStorage.setItem('nav-crd-groups-expanded', JSON.stringify(crdGroupExpandState));
}

function toggleCrdGroup(group: string): void {
  crdGroupExpandState[group] = !crdGroupExpandState[group];
  crdGroupExpandState = { ...crdGroupExpandState };
  saveCrdGroupState();
}

$effect(() => {
  if (isUnderSection(workloadUrls)) workloadsExpanded = true;
  if (isUnderSection(configUrls)) configExpanded = true;
  if (isUnderSection(networkUrls)) networkExpanded = true;
  if (isUnderSection(storageUrls)) storageExpanded = true;
  if (url.startsWith('/customresources/')) customResourcesExpanded = true;
});

$effect(() => {
  saveExpanded('compute', workloadsExpanded);
});
$effect(() => {
  saveExpanded('config', configExpanded);
});
$effect(() => {
  saveExpanded('network', networkExpanded);
});
$effect(() => {
  saveExpanded('storage', storageExpanded);
});
$effect(() => {
  saveExpanded('customResources', customResourcesExpanded);
});
$effect(() => {
  saveExpanded('openshift', openshiftExpanded);
});
$effect(() => {
  if (currentContext?.data?.contextName) {
    discoverOpenShiftResources().catch(console.warn);
  } else {
    openshiftGroups = [];
  }
});
</script>

<nav
  class="z-1 w-leftsidebar min-w-leftsidebar shadow-xs flex-col justify-between flex transition-all duration-500 ease-in-out bg-(--pd-secondary-nav-bg) border-(--pd-global-nav-bg-border) border-r-[1px]"
  aria-label="PreferencesNavigation">
  <div class="flex items-center">
    <a href="/" title="Navigate to dashboard" class="pt-4 px-3 mb-5 flex items-center gap-3">
      <img src={kubernetesIcon} alt="Kubernetes Dashboard" class="w-7 h-7" />
      <p
        class="text-xl font-semibold text-[color:var(--pd-secondary-nav-header-text)] border-l-[4px] border-transparent">
        Kubernetes
      </p>
    </a>
  </div>
  <div
    class="h-full overflow-hidden hover:overflow-y-auto [&_svg]:w-[1.25em] [&_div.pl-\[34px\]]:!pl-[36px]"
    style="margin-bottom:auto">
    <SettingsNavItem title="Dashboard" icon={faHouse} selected={url === '/'} href="/" />

    <SettingsNavItem
      title="Nodes"
      icon={faServer}
      selected={url === navigator.kubernetesResourcesURL('Node')}
      href={navigator.kubernetesResourcesURL('Node')} />

    <!-- Compute section -->
    <SettingsNavItem
      title="Compute"
      icon={faCubes}
      section={true}
      bind:expanded={workloadsExpanded}
      selected={false}
      href="#" />
    {#if workloadsExpanded}
      <SettingsNavItem
        title="Deployments"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('Deployment')}
        href={navigator.kubernetesResourcesURL('Deployment')} />
      <SettingsNavItem
        title="Pods"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('Pod')}
        href={navigator.kubernetesResourcesURL('Pod')} />
      <SettingsNavItem
        title="Jobs"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('Job')}
        href={navigator.kubernetesResourcesURL('Job')} />
      <SettingsNavItem
        title="CronJobs"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('CronJob')}
        href={navigator.kubernetesResourcesURL('CronJob')} />
    {/if}

    <!-- Config section -->
    <SettingsNavItem
      title="Config"
      icon={faGear}
      section={true}
      bind:expanded={configExpanded}
      selected={false}
      href="#" />
    {#if configExpanded}
      <SettingsNavItem
        title="ConfigMaps &amp; Secrets"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('ConfigMap')}
        href={navigator.kubernetesResourcesURL('ConfigMap')} />
      <SettingsNavItem
        title="Custom Resource Definitions"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('CustomResourceDefinition')}
        href={navigator.kubernetesResourcesURL('CustomResourceDefinition')} />
    {/if}

    <!-- Network section -->
    <SettingsNavItem
      title="Network"
      icon={faNetworkWired}
      section={true}
      bind:expanded={networkExpanded}
      selected={false}
      href="#" />
    {#if networkExpanded}
      <SettingsNavItem
        title="Services"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('Service')}
        href={navigator.kubernetesResourcesURL('Service')} />
      <SettingsNavItem
        title="Ingresses &amp; Routes"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('Ingress')}
        href={navigator.kubernetesResourcesURL('Ingress')} />
      <SettingsNavItem title="Port Forwarding" child={true} selected={url === '/portForward'} href="/portForward" />
    {/if}

    <!-- Storage section -->
    <SettingsNavItem
      title="Storage"
      icon={faDatabase}
      section={true}
      bind:expanded={storageExpanded}
      selected={false}
      href="#" />
    {#if storageExpanded}
      <SettingsNavItem
        title="Persistent Volume Claims"
        child={true}
        selected={url === navigator.kubernetesResourcesURL('PersistentVolumeClaim')}
        href={navigator.kubernetesResourcesURL('PersistentVolumeClaim')} />
    {/if}

    <SettingsNavItem
      title="Namespaces"
      icon={faLayerGroup}
      selected={url === navigator.kubernetesResourcesURL('Namespace')}
      href={navigator.kubernetesResourcesURL('Namespace')} />

    <!-- Custom Resources section (dynamic from CRD informer) -->
    {#if crdGroups.length > 0}
      <SettingsNavItem
        title="Custom Resources"
        icon={faPuzzlePiece}
        section={true}
        bind:expanded={customResourcesExpanded}
        selected={false}
        href="#" />
      {#if customResourcesExpanded}
        {#each crdGroups as crdGroup (crdGroup.group)}
          <SettingsNavItem
            title={crdGroup.group}
            child={true}
            section={true}
            expanded={crdGroupExpandState[crdGroup.group] ?? false}
            onClick={(): void => toggleCrdGroup(crdGroup.group)}
            selected={false}
            href="#" />
          {#if crdGroupExpandState[crdGroup.group]}
            <div class="pl-3">
              {#each crdGroup.crds as crd (crd.plural)}
                <SettingsNavItem
                  title={crd.kind}
                  child={true}
                  selected={url === customResourceUrl(crdGroup.group, crd.version, crd.plural)}
                  href={customResourceUrl(crdGroup.group, crd.version, crd.plural)} />
              {/each}
            </div>
          {/if}
        {/each}
      {/if}
    {/if}

    <!-- OpenShift section (discovered from API) -->
    {#if openshiftGroups.length > 0}
      <SettingsNavItem
        title="OpenShift"
        icon={faRedhat}
        section={true}
        bind:expanded={openshiftExpanded}
        selected={false}
        href="#" />
      {#if openshiftExpanded}
        {#each openshiftGroups as osGroup (osGroup.group)}
          <SettingsNavItem
            title={osGroup.group}
            child={true}
            section={true}
            expanded={crdGroupExpandState[osGroup.group] ?? false}
            onClick={(): void => toggleCrdGroup(osGroup.group)}
            selected={false}
            href="#" />
          {#if crdGroupExpandState[osGroup.group]}
            <div class="pl-3">
              {#each osGroup.resources as res (res.plural)}
                <SettingsNavItem
                  title={res.kind}
                  child={true}
                  selected={url === customResourceUrl(res.group, res.version, res.plural)}
                  href={customResourceUrl(res.group, res.version, res.plural)} />
              {/each}
            </div>
          {/if}
        {/each}
      {/if}
    {/if}
  </div>
</nav>

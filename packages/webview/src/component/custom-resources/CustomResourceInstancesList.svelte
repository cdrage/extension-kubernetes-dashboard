<!--
/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
-->
<script lang="ts">
import {
  TableColumn,
  TableDurationColumn,
  TableRow,
  TableSimpleColumn,
  NavPage,
  Table,
  FilteredEmptyScreen,
  EmptyScreen,
  Dropdown,
  Tooltip,
} from '@podman-desktop/ui-svelte';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import moment from 'moment';
import { getContext, onDestroy, onMount } from 'svelte';
import type { KubernetesObject } from '@kubernetes/client-node';
import type { Unsubscriber } from 'svelte/store';

import CustomResourceInstanceNameColumn from './columns/CustomResourceInstanceName.svelte';
import StatusColumn from '/@/component/objects/columns/Status.svelte';
import KubeIcon from '/@/component/icons/KubeIcon.svelte';
import CurrentContextConnectionBadge from '/@/component/connection/CurrentContextConnectionBadge.svelte';
import NamespaceDropdown from '/@/component/objects/NamespaceDropdown.svelte';
import KubeApplyYAMLButton from '/@/component/apply/KubeApplyYAMLButton.svelte';
import { Remote } from '/@/remote/remote';
import { API_CUSTOM_RESOURCES } from '@kubernetes-dashboard/channels';
import type { CustomResourcesApi, ContextResourceItems } from '@kubernetes-dashboard/channels';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import { CustomResourceInstanceHelper } from './custom-resource-instance-helper';
import type { CustomResourceInstanceUI, PrinterColumn } from './CustomResourceInstanceUI';
import { States } from '/@/state/states';
import { KubernetesObjectUIHelper } from '/@/component/objects/kubernetes-object-ui-helper';

interface Props {
  group: string;
  version: string;
  plural: string;
}

let { group, version, plural }: Props = $props();

const remote = getContext<Remote>(Remote);
const customResourcesApi = remote.getProxy<CustomResourcesApi>(API_CUSTOM_RESOURCES);

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const crHelper = dependencyAccessor.get<CustomResourceInstanceHelper>(CustomResourceInstanceHelper);
const objectHelper = dependencyAccessor.get<KubernetesObjectUIHelper>(KubernetesObjectUIHelper);

const states = getContext<States>(States);
const currentContext = states.stateCurrentContextInfoUI;
const updateResource = states.stateUpdateResourceInfoUI;

let crdUnsubscriber: Unsubscriber | undefined = undefined;

interface CrdVersionSpec {
  name?: string;
  served?: boolean;
  additionalPrinterColumns?: PrinterColumn[];
}

interface CrdSpec {
  group?: string;
  scope?: string;
  names?: { kind?: string; plural?: string };
  versions?: CrdVersionSpec[];
}

const SKIP_COLUMNS = new Set(['name', 'namespace', 'age', 'status']);

function findMatchingCrdSpec(): CrdSpec | undefined {
  const crdItems = (updateResource?.data?.resources ?? [])
    .filter((r: ContextResourceItems) => !r.contextName && r.resourceName === 'customresourcedefinitions')
    .flatMap((r: ContextResourceItems) => r.items);

  const matchingCrd = crdItems.find((item: KubernetesObject) => {
    const spec = (item as unknown as { spec?: CrdSpec }).spec;
    return spec?.group === group && spec?.names?.plural === plural;
  });

  return matchingCrd ? (matchingCrd as unknown as { spec?: CrdSpec }).spec : undefined;
}

const matchingSpec = $derived(findMatchingCrdSpec());
const resolvedKind = $derived(matchingSpec?.names?.kind ?? plural);
const isNamespaced = $derived(matchingSpec?.scope !== 'Cluster');

const printerColumns = $derived.by((): PrinterColumn[] => {
  if (!matchingSpec) return [];

  const matchingVersion =
    matchingSpec.versions?.find((v: CrdVersionSpec) => v.name === version) ??
    matchingSpec.versions?.find((v: CrdVersionSpec) => v.served);

  return (matchingVersion?.additionalPrinterColumns ?? []).filter(
    (col: PrinterColumn) => !SKIP_COLUMNS.has(col.name.toLowerCase()),
  );
});

let instances = $state<CustomResourceInstanceUI[]>([]);
let loading = $state(true);
let errorMessage = $state<string | undefined>(undefined);
let searchTerm = $state('');
let pollIntervalValue = $state('10000');
let timer: ReturnType<typeof setInterval> | undefined = undefined;

const pollOptions = [
  { label: '5s', value: '5000' },
  { label: '10s', value: '10000' },
  { label: '30s', value: '30000' },
  { label: 'Off', value: '0' },
];

const filteredInstances = $derived(
  instances.filter(obj => (searchTerm ? objectHelper.findMatchInLeaves(obj, searchTerm) : true)),
);

let statusColumn = new TableColumn<CustomResourceInstanceUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: StatusColumn,
  comparator: (a, b): number => a.status.localeCompare(b.status),
});

let nameColumn = new TableColumn<CustomResourceInstanceUI>('Name', {
  width: '2fr',
  renderer: CustomResourceInstanceNameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

let namespaceColumn = new TableColumn<CustomResourceInstanceUI, string>('Namespace', {
  renderMapping: (obj): string => obj.namespace,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.namespace.localeCompare(b.namespace),
});

let ageColumn = new TableColumn<CustomResourceInstanceUI, Date | undefined>('Age', {
  renderMapping: (obj): Date | undefined => obj.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

function buildExtraColumns(cols: PrinterColumn[]): TableColumn<CustomResourceInstanceUI, string>[] {
  return cols.map(
    col =>
      new TableColumn<CustomResourceInstanceUI, string>(col.name, {
        renderMapping: (obj): string => obj.extraFields[col.name] ?? '',
        renderer: TableSimpleColumn,
        comparator: (a, b): number => (a.extraFields[col.name] ?? '').localeCompare(b.extraFields[col.name] ?? ''),
      }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns = $derived.by((): TableColumn<any>[] => {
  const base = isNamespaced ? [statusColumn, nameColumn, namespaceColumn] : [statusColumn, nameColumn];
  return [...base, ...buildExtraColumns(printerColumns), ageColumn];
});

const row = new TableRow<CustomResourceInstanceUI>({ selectable: (_obj): boolean => true });

async function fetchInstances(): Promise<void> {
  try {
    const namespace = isNamespaced ? currentContext.data?.namespace : undefined;
    const result = await customResourcesApi.listInstances(group, version, plural, namespace);
    instances = result.map((o: KubernetesObject) =>
      crHelper.getCustomResourceInstanceUI(o, resolvedKind, group, version, plural, printerColumns),
    );
    errorMessage = undefined;
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : 'Failed to fetch instances';
  } finally {
    loading = false;
  }
}

function startPolling(): void {
  stopPolling();
  const interval = Number(pollIntervalValue);
  if (interval > 0) {
    timer = setInterval(() => void fetchInstances(), interval);
  }
}

function stopPolling(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

function onPollIntervalChange(value: string): void {
  pollIntervalValue = value;
  startPolling();
}

onMount(() => {
  crdUnsubscriber = updateResource.subscribe({
    contextName: undefined,
    resourceName: 'customresourcedefinitions',
  });
  fetchInstances()
    .then(() => startPolling())
    .catch(console.warn);
});

onDestroy(() => {
  stopPolling();
  crdUnsubscriber?.();
});

$effect(() => {
  currentContext.data?.namespace;
  if (!loading) {
    fetchInstances().catch(console.warn);
  }
});

let selectedItemsNumber = $state<number>(0);
</script>

<NavPage bind:searchTerm={searchTerm} title={resolvedKind}>
  {#snippet additionalActions()}
    <KubeApplyYAMLButton />
  {/snippet}

  {#snippet bottomAdditionalActions()}
    {#if isNamespaced}
      <NamespaceDropdown />
    {/if}
    <div class="flex items-center gap-2 ml-auto">
      <Tooltip tip="Custom resources use on-demand polling instead of informers to reduce cluster load." bottom>
        <div class="flex items-center gap-1 text-xs text-(--pd-content-text) cursor-help">
          <span>Refresh:</span>
          <Icon icon={faCircleQuestion} />
        </div>
      </Tooltip>
      <Dropdown class="w-16" value={pollIntervalValue} options={pollOptions} onChange={onPollIntervalChange} />
      <CurrentContextConnectionBadge />
    </div>
  {/snippet}

  {#snippet content()}
    <div class="flex min-w-full h-full">
      {#if errorMessage}
        <div class="flex items-center justify-center w-full text-(--pd-content-text)">
          <p>Error: {errorMessage}</p>
        </div>
      {:else}
        <Table
          kind={resolvedKind}
          data={filteredInstances}
          columns={columns}
          row={row}
          defaultSortColumn="Name"
          enableLayoutConfiguration={true}
          bind:selectedItemsNumber={selectedItemsNumber}></Table>

        {#if filteredInstances.length === 0 && !loading}
          {#if searchTerm}
            <FilteredEmptyScreen
              icon={KubeIcon}
              kind={plural}
              searchTerm={searchTerm}
              on:resetFilter={(): string => (searchTerm = '')} />
          {:else}
            <EmptyScreen icon={KubeIcon} title="No {resolvedKind}" message="No {resolvedKind} resources found" />
          {/if}
        {/if}
      {/if}
    </div>
  {/snippet}
</NavPage>

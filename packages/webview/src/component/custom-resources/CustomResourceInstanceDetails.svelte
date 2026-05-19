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
import type { KubernetesObject } from '@kubernetes/client-node';
import { getContext, onDestroy, onMount } from 'svelte';
import { router } from 'tinro';

import { DetailsPage, StatusIcon, Tab } from '@podman-desktop/ui-svelte';
import { Remote } from '/@/remote/remote';
import { API_CUSTOM_RESOURCES } from '@kubernetes-dashboard/channels';
import type { CustomResourcesApi } from '@kubernetes-dashboard/channels';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import { Navigator } from '/@/navigation/navigator';
import KubeIcon from '/@/component/icons/KubeIcon.svelte';
import StateChange from '/@/component/objects/StateChange.svelte';
import MonacoEditor from '/@/component/editor/MonacoEditor.svelte';
import Route from '/@/Route.svelte';
import CustomResourceInstanceDetailsSummary from './CustomResourceInstanceDetailsSummary.svelte';

interface Props {
  group: string;
  version: string;
  plural: string;
  name: string;
  namespace: string;
}

let { group, version, plural, name, namespace }: Props = $props();

const remote = getContext<Remote>(Remote);
const customResourcesApi = remote.getProxy<CustomResourcesApi>(API_CUSTOM_RESOURCES);

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const navigator = dependencyAccessor.get(Navigator);

let object = $state<KubernetesObject | undefined>(undefined);
let timer: ReturnType<typeof setInterval> | undefined = undefined;

const simplifiedObject = $derived(
  object ? { ...object, metadata: { ...object.metadata, managedFields: undefined } } : undefined,
);

const listUrl = $derived(`/customresources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}`);

async function fetchInstance(): Promise<void> {
  try {
    const ns = namespace && namespace !== '_' ? namespace : undefined;
    const result = await customResourcesApi.listInstances(group, version, plural, ns);
    object = result.find(
      (o: KubernetesObject) => o.metadata?.name === name && (!namespace || o.metadata?.namespace === namespace),
    );
    if (!object) {
      navigateToList();
    }
  } catch {
    navigateToList();
  }
}

function navigateToList(): void {
  router.goto(listUrl);
}

onMount(() => {
  fetchInstance().catch(console.warn);
  timer = setInterval(() => { fetchInstance().catch(console.warn); }, 10000);
});

onDestroy(() => {
  if (timer !== undefined) {
    clearInterval(timer);
  }
});
</script>

{#if object}
  <DetailsPage
    title={name}
    subtitle={namespace && namespace !== '_' ? namespace : undefined}
    breadcrumbLeftPart={plural}
    breadcrumbRightPart="Details"
    onbreadcrumbClick={navigateToList}
    onclose={navigateToList}>
    {#snippet iconSnippet()}
      <StatusIcon icon={KubeIcon} size={24} status="RUNNING" />
    {/snippet}
    {#snippet detailSnippet()}
      <div class="flex py-2 w-full justify-end text-sm text-(--pd-content-text)">
        <StateChange state="RUNNING" />
      </div>
    {/snippet}
    {#snippet tabsSnippet()}
      <Tab
        title="Summary"
        selected={navigator.isTabSelected($router.path, 'summary')}
        url={navigator.getTabUrl($router.path, 'summary')} />
      <Tab
        title="Inspect"
        selected={navigator.isTabSelected($router.path, 'inspect')}
        url={navigator.getTabUrl($router.path, 'inspect')} />
    {/snippet}
    {#snippet contentSnippet()}
      <Route path="/summary">
        {#if object}
          <CustomResourceInstanceDetailsSummary object={object} />
        {/if}
      </Route>
      <Route path="/inspect">
        {#if simplifiedObject}
          <MonacoEditor content={JSON.stringify(simplifiedObject, undefined, 2)} language="json" />
        {/if}
      </Route>
    {/snippet}
  </DetailsPage>
{/if}

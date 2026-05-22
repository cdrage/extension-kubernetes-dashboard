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

import { inject, injectable } from 'inversify';
import type { KubernetesListObject, KubernetesObject, KubeConfig } from '@kubernetes/client-node';
import { ApisApi, CustomObjectsApi } from '@kubernetes/client-node';
import type { CustomResourcesApi, DiscoveredResource } from '@kubernetes-dashboard/channels';

import { ContextsManager } from './contexts-manager.js';

interface ApiResource {
  name: string;
  kind: string;
  namespaced: boolean;
  verbs?: string[];
}

interface ApiResourceList {
  resources?: ApiResource[];
}

@injectable()
export class CustomResourcesApiImpl implements CustomResourcesApi {
  @inject(ContextsManager)
  private manager: ContextsManager;

  async listInstances(group: string, version: string, plural: string, namespace?: string): Promise<KubernetesObject[]> {
    const currentContext = this.manager.currentContext;
    if (!currentContext) {
      return [];
    }

    const apiClient = currentContext.getKubeConfig().makeApiClient(CustomObjectsApi);

    try {
      let result: KubernetesListObject<KubernetesObject>;
      if (namespace) {
        result = (await apiClient.listNamespacedCustomObject({
          group,
          version,
          namespace,
          plural,
        })) as KubernetesListObject<KubernetesObject>;
      } else {
        result = (await apiClient.listClusterCustomObject({
          group,
          version,
          plural,
        })) as KubernetesListObject<KubernetesObject>;
      }
      return result.items ?? [];
    } catch {
      return [];
    }
  }

  async discoverApiResources(groupSuffix: string): Promise<DiscoveredResource[]> {
    const currentContext = this.manager.currentContext;
    if (!currentContext) return [];

    const kc = currentContext.getKubeConfig();
    const apisApi = kc.makeApiClient(ApisApi);

    try {
      const groupList = await apisApi.getAPIVersions();
      const matchingGroups = groupList.groups.filter(g => g.name.endsWith(groupSuffix));

      const settled = await Promise.allSettled(
        matchingGroups
          .filter(g => g.preferredVersion?.version ?? g.versions?.[0]?.version)
          .map(g => this.fetchGroupResources(kc, g.name, (g.preferredVersion?.version ?? g.versions?.[0]?.version)!)),
      );

      return settled
        .filter((r): r is PromiseFulfilledResult<DiscoveredResource[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);
    } catch {
      return [];
    }
  }

  private async fetchGroupResources(kc: KubeConfig, group: string, version: string): Promise<DiscoveredResource[]> {
    const cluster = kc.getCurrentCluster();
    if (!cluster) return [];

    const url = `${cluster.server}/apis/${group}/${version}`;
    const fetchOpts = await kc.applyToFetchOptions({});

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (fetchOpts.headers) {
      const h = fetchOpts.headers as Record<string | symbol, unknown>;
      const sym = Object.getOwnPropertySymbols(h)[0];
      if (sym) {
        const map = h[sym] as Record<string, string[] | string>;
        for (const [k, v] of Object.entries(map)) {
          headers[k] = Array.isArray(v) ? v[0] : v;
        }
      }
    }

    const response = await fetch(url, { ...fetchOpts, headers } as RequestInit);
    if (!response.ok) return [];

    const data = (await response.json()) as ApiResourceList;
    return (data.resources ?? [])
      .filter(r => !r.name.includes('/') && r.verbs?.includes('list'))
      .map(r => ({
        group,
        version,
        kind: r.kind,
        plural: r.name,
        namespaced: r.namespaced,
      }));
  }
}

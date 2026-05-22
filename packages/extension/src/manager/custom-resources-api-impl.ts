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
import type { KubernetesListObject, KubernetesObject } from '@kubernetes/client-node';
import { CustomObjectsApi } from '@kubernetes/client-node';
import type { CustomResourcesApi } from '@kubernetes-dashboard/channels';

import { ContextsManager } from './contexts-manager.js';

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
}

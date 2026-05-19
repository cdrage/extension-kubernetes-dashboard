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

import type { KubernetesObject } from '@kubernetes/client-node';

import type { CustomResourceDefinitionUI } from './CustomResourceDefinitionUI';

interface CrdSpec {
  group?: string;
  scope?: string;
  names?: { kind?: string };
}

interface CrdStatus {
  storedVersions?: string[];
}

export class CrdHelper {
  getCustomResourceDefinitionUI(o: KubernetesObject): CustomResourceDefinitionUI {
    const spec = (o as unknown as { spec?: CrdSpec }).spec;
    const status = (o as unknown as { status?: CrdStatus }).status;

    return {
      kind: 'CustomResourceDefinition',
      uid: o.metadata?.uid ?? '',
      name: o.metadata?.name ?? '',
      status: 'RUNNING',
      created: o.metadata?.creationTimestamp,
      group: spec?.group ?? '',
      crdKind: spec?.names?.kind ?? '',
      scope: spec?.scope ?? '',
      storedVersions: (status?.storedVersions ?? []).join(', '),
    };
  }
}

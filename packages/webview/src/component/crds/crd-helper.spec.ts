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
import { beforeEach, expect, test, vi } from 'vitest';

import { CrdHelper } from './crd-helper';

let helper: CrdHelper;

beforeEach(() => {
  vi.clearAllMocks();
  helper = new CrdHelper();
});

test('expect basic UI conversion', async () => {
  const crd = {
    metadata: {
      uid: 'crd-uid-1',
      name: 'certificates.cert-manager.io',
      creationTimestamp: new Date('2026-01-20T06:00:00Z'),
    },
    spec: {
      group: 'cert-manager.io',
      scope: 'Namespaced',
      names: { kind: 'Certificate' },
    },
    status: {
      storedVersions: ['v1'],
    },
  } as unknown as KubernetesObject;

  const result = helper.getCustomResourceDefinitionUI(crd);

  expect(result.kind).toBe('CustomResourceDefinition');
  expect(result.uid).toBe('crd-uid-1');
  expect(result.name).toBe('certificates.cert-manager.io');
  expect(result.status).toBe('RUNNING');
  expect(result.created).toEqual(new Date('2026-01-20T06:00:00Z'));
});

test('expect group, crdKind and scope fields from spec', async () => {
  const crd = {
    metadata: { uid: 'crd-uid-2', name: 'widgets.example.com' },
    spec: {
      group: 'example.com',
      scope: 'Cluster',
      names: { kind: 'Widget' },
    },
    status: {
      storedVersions: [],
    },
  } as unknown as KubernetesObject;

  const result = helper.getCustomResourceDefinitionUI(crd);

  expect(result.group).toBe('example.com');
  expect(result.crdKind).toBe('Widget');
  expect(result.scope).toBe('Cluster');
});

test('expect storedVersions joined by comma', async () => {
  const crd = {
    metadata: { uid: 'crd-uid-3', name: 'multiver.example.io' },
    spec: {
      group: 'example.io',
      scope: 'Namespaced',
      names: { kind: 'MultiVer' },
    },
    status: {
      storedVersions: ['v1alpha1', 'v1beta1', 'v1'],
    },
  } as unknown as KubernetesObject;

  const result = helper.getCustomResourceDefinitionUI(crd);

  expect(result.storedVersions).toBe('v1alpha1, v1beta1, v1');
});

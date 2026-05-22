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

import { CustomResourceInstanceHelper } from './custom-resource-instance-helper';
import type { PrinterColumn } from './CustomResourceInstanceUI';

let helper: CustomResourceInstanceHelper;

beforeEach(() => {
  vi.clearAllMocks();
  helper = new CustomResourceInstanceHelper();
});

test('expect basic UI conversion with empty printerColumns', async () => {
  const obj: KubernetesObject = {
    metadata: {
      uid: 'cri-uid-1',
      name: 'my-resource',
      namespace: 'default',
      creationTimestamp: new Date('2026-07-01T12:00:00Z'),
    },
  };

  const result = helper.getCustomResourceInstanceUI(obj, 'Widget', 'example.com', 'v1', 'widgets', []);

  expect(result.kind).toBe('Widget');
  expect(result.uid).toBe('cri-uid-1');
  expect(result.name).toBe('my-resource');
  expect(result.namespace).toBe('default');
  expect(result.status).toBe('RUNNING');
  expect(result.group).toBe('example.com');
  expect(result.version).toBe('v1');
  expect(result.plural).toBe('widgets');
  expect(result.extraFields).toEqual({});
  expect(result.created).toEqual(new Date('2026-07-01T12:00:00Z'));
});

test('expect extraFields populated from printerColumns using jsonPath', async () => {
  const obj = {
    metadata: {
      uid: 'cri-uid-2',
      name: 'scaled-resource',
      namespace: 'prod',
    },
    spec: {
      replicas: 3,
    },
    status: {
      phase: 'Active',
    },
  } as unknown as KubernetesObject;

  const printerColumns: PrinterColumn[] = [
    { name: 'Replicas', type: 'integer', jsonPath: '.spec.replicas' },
    { name: 'Phase', type: 'string', jsonPath: '.status.phase' },
  ];

  const result = helper.getCustomResourceInstanceUI(
    obj,
    'ScaledApp',
    'apps.example.com',
    'v1',
    'scaledapps',
    printerColumns,
  );

  expect(result.extraFields['Replicas']).toBe('3');
  expect(result.extraFields['Phase']).toBe('Active');
});

test('expect missing jsonPath returns empty string', async () => {
  const obj: KubernetesObject = {
    metadata: {
      uid: 'cri-uid-3',
      name: 'sparse-resource',
      namespace: 'test',
    },
  };

  const printerColumns: PrinterColumn[] = [{ name: 'Missing', type: 'string', jsonPath: '.spec.nonexistent.field' }];

  const result = helper.getCustomResourceInstanceUI(obj, 'Gadget', 'gadgets.io', 'v1beta1', 'gadgets', printerColumns);

  expect(result.extraFields['Missing']).toBe('');
});

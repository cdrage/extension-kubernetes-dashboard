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

import type { CoreV1Event } from '@kubernetes/client-node';
import { beforeEach, expect, test, vi } from 'vitest';

import { EventStandaloneHelper } from './event-standalone-helper';

let helper: EventStandaloneHelper;

beforeEach(() => {
  vi.clearAllMocks();
  helper = new EventStandaloneHelper();
});

test('expect basic UI conversion', async () => {
  const event: CoreV1Event = {
    metadata: {
      uid: 'event-uid-1',
      name: 'my-event',
      namespace: 'default',
      creationTimestamp: new Date('2026-01-01T00:00:00Z'),
    },
    involvedObject: {
      kind: 'Pod',
      name: 'my-pod',
    },
    type: 'Normal',
    message: 'Started container',
    source: { component: 'kubelet' },
    count: 3,
    reason: 'Started',
    lastTimestamp: new Date('2026-01-01T01:00:00Z'),
  };

  const result = helper.getEventStandaloneUI(event);

  expect(result.kind).toBe('Event');
  expect(result.uid).toBe('event-uid-1');
  expect(result.name).toBe('my-event');
  expect(result.namespace).toBe('default');
  expect(result.message).toBe('Started container');
  expect(result.source).toBe('kubelet');
  expect(result.reason).toBe('Started');
  expect(result.selected).toBe(false);
});

test('expect status DEGRADED when type is Warning', async () => {
  const event: CoreV1Event = {
    metadata: { uid: 'uid-warn', name: 'warn-event' },
    involvedObject: {},
    type: 'Warning',
  };

  const result = helper.getEventStandaloneUI(event);

  expect(result.status).toBe('DEGRADED');
});

test('expect status RUNNING when type is not Warning', async () => {
  const event: CoreV1Event = {
    metadata: { uid: 'uid-normal', name: 'normal-event' },
    involvedObject: {},
    type: 'Normal',
  };

  const result = helper.getEventStandaloneUI(event);

  expect(result.status).toBe('RUNNING');
});

test('expect involvedObject formatted as Kind/Name', async () => {
  const event: CoreV1Event = {
    metadata: { uid: 'uid-obj', name: 'obj-event' },
    involvedObject: {
      kind: 'Deployment',
      name: 'my-deploy',
    },
    type: 'Normal',
    count: 5,
  };

  const result = helper.getEventStandaloneUI(event);

  expect(result.involvedObject).toBe('Deployment/my-deploy');
  expect(result.count).toBe(5);
});

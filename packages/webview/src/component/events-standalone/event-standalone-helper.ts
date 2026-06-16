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

import type { CoreV1Event, KubernetesObject } from '@kubernetes/client-node';

import type { EventStandaloneUI } from './EventStandaloneUI';

export class EventStandaloneHelper {
  getEventStandaloneUI(o: KubernetesObject): EventStandaloneUI {
    const obj = o as CoreV1Event;
    return {
      kind: 'Event',
      uid: obj.metadata?.uid ?? '',
      name: obj.metadata?.name ?? '',
      status: obj.type === 'Warning' ? 'DEGRADED' : 'RUNNING',
      namespace: obj.metadata?.namespace ?? '',
      created: obj.metadata?.creationTimestamp,
      selected: false,
      type: obj.type ?? '',
      message: obj.message ?? '',
      involvedObject: obj.involvedObject ? `${obj.involvedObject.kind}/${obj.involvedObject.name}` : '',
      source: obj.source?.component ?? '',
      count: obj.count ?? 0,
      reason: obj.reason ?? '',
      lastSeen: obj.lastTimestamp ? new Date(obj.lastTimestamp) : undefined,
    };
  }
}

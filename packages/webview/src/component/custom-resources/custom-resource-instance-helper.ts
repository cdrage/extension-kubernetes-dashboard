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

import type { CustomResourceInstanceUI, PrinterColumn } from './CustomResourceInstanceUI';

export class CustomResourceInstanceHelper {
  getCustomResourceInstanceUI(
    o: KubernetesObject,
    kind: string,
    group: string,
    version: string,
    plural: string,
    printerColumns: PrinterColumn[],
  ): CustomResourceInstanceUI {
    const extraFields: Record<string, string> = {};
    for (const col of printerColumns) {
      extraFields[col.name] = resolveJsonPath(o, col.jsonPath);
    }

    return {
      kind,
      uid: o.metadata?.uid ?? '',
      name: o.metadata?.name ?? '',
      namespace: o.metadata?.namespace ?? '',
      status: 'RUNNING',
      created: o.metadata?.creationTimestamp,
      extraFields,
      group,
      version,
      plural,
    };
  }
}

function getProperty(obj: unknown, key: string): unknown {
  if (obj === undefined || typeof obj !== 'object') return undefined;
  return (obj as Record<string, unknown>)[key];
}

function resolveArrayAccess(current: unknown, token: string): unknown {
  const indexMatch = /^\[(\d+)]$/.exec(token);
  if (indexMatch && Array.isArray(current)) {
    return current[parseInt(indexMatch[1])];
  }

  const filterMatch = /^\[\?@\.(\w+)=="([^"]*)"]$/.exec(token);
  if (filterMatch && Array.isArray(current)) {
    return current.find((item: Record<string, unknown>) => String(item[filterMatch[1]]) === filterMatch[2]);
  }

  if (token === '[*]' && Array.isArray(current)) {
    return current;
  }

  return undefined;
}

function formatValue(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function resolveJsonPath(obj: unknown, path: string): string {
  try {
    const cleaned = path.replace(/^\./, '');
    // Split on dots, but preserve bracket expressions by re-attaching them
    const segments = splitPath(cleaned);
    let current: unknown = obj;
    let spreadNext = false;

    for (const segment of segments) {
      if (current === undefined) return '';

      if (segment.startsWith('[')) {
        if (segment === '[*]') {
          spreadNext = true;
          continue;
        }
        current = resolveArrayAccess(current, segment);
      } else if (spreadNext && Array.isArray(current)) {
        current = current.map((item: unknown) => getProperty(item, segment)).filter(Boolean);
        return formatValue(current);
      } else {
        current = getProperty(current, segment);
      }
    }

    return formatValue(current);
  } catch {
    return '';
  }
}

function splitPath(path: string): string[] {
  const segments: string[] = [];
  let i = 0;

  while (i < path.length) {
    if (path[i] === '.') {
      i++;
    } else if (path[i] === '[') {
      const closeIdx = findMatchingBracket(path, i);
      if (closeIdx === -1) break;
      segments.push(path.substring(i, closeIdx + 1));
      i = closeIdx + 1;
    } else {
      let end = i;
      while (end < path.length && path[end] !== '.' && path[end] !== '[') {
        end++;
      }
      segments.push(path.substring(i, end));
      i = end;
    }
  }

  return segments;
}

function findMatchingBracket(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '[') depth++;
    if (str[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

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

import type { Disposable, ExtensionContext, WebviewPanel } from '@podman-desktop/api';
import { commands, extensions } from '@podman-desktop/api';

const EXTENSION_ID = 'kubernetes-dashboard';

// Maps kubectl resource names (singular, plural, short) to webview routes.
// The webview navigator uses plural lowercase for its URL paths.
const RESOURCE_ROUTES: Record<string, string> = {
  pod: 'pods',
  pods: 'pods',
  po: 'pods',

  deployment: 'deployments',
  deployments: 'deployments',
  deploy: 'deployments',

  service: 'services',
  services: 'services',
  svc: 'services',

  configmap: 'configmapsSecrets',
  configmaps: 'configmapsSecrets',
  cm: 'configmapsSecrets',

  secret: 'configmapsSecrets',
  secrets: 'configmapsSecrets',

  ingress: 'ingressesRoutes',
  ingresses: 'ingressesRoutes',
  ing: 'ingressesRoutes',

  route: 'ingressesRoutes',
  routes: 'ingressesRoutes',

  node: 'nodes',
  nodes: 'nodes',
  no: 'nodes',

  namespace: 'namespaces',
  namespaces: 'namespaces',
  ns: 'namespaces',

  persistentvolumeclaim: 'persistentvolumeclaims',
  persistentvolumeclaims: 'persistentvolumeclaims',
  pvc: 'persistentvolumeclaims',

  persistentvolume: 'persistentvolumes',
  persistentvolumes: 'persistentvolumes',
  pv: 'persistentvolumes',

  storageclass: 'storageclasses',
  storageclasses: 'storageclasses',
  sc: 'storageclasses',

  statefulset: 'statefulsets',
  statefulsets: 'statefulsets',
  sts: 'statefulsets',

  daemonset: 'daemonsets',
  daemonsets: 'daemonsets',
  ds: 'daemonsets',

  replicaset: 'replicasets',
  replicasets: 'replicasets',
  rs: 'replicasets',

  job: 'jobs',
  jobs: 'jobs',

  cronjob: 'cronjobs',
  cronjobs: 'cronjobs',
  cj: 'cronjobs',

  serviceaccount: 'serviceaccounts',
  serviceaccounts: 'serviceaccounts',
  sa: 'serviceaccounts',

  role: 'roles',
  roles: 'roles',

  rolebinding: 'rolebindings',
  rolebindings: 'rolebindings',

  clusterrole: 'clusterroles',
  clusterroles: 'clusterroles',

  clusterrolebinding: 'clusterrolebindings',
  clusterrolebindings: 'clusterrolebindings',

  endpoint: 'endpoints',
  endpoints: 'endpoints',
  ep: 'endpoints',

  endpointslice: 'endpointslices',
  endpointslices: 'endpointslices',

  networkpolicy: 'networkpolicies',
  networkpolicies: 'networkpolicies',
  netpol: 'networkpolicies',

  ingressclass: 'ingressclasses',
  ingressclasses: 'ingressclasses',

  event: 'events',
  events: 'events',
  ev: 'events',
};

// Minimal shape of the MCP CallToolResult passed to navigation handlers.
// Only the fields we read are declared; the full type lives in @modelcontextprotocol/sdk.
interface ToolResultContent {
  type: string;
  text?: string;
}
interface ToolResult {
  content?: ToolResultContent[];
}

// Parse kubectl args string to extract the resource kind.
// Handles patterns like "get pods", "describe pod nginx", "delete deployment foo".
// Returns undefined for file-based commands ("apply -f ...") where the kind
// lives inside the YAML, not in the CLI args.
function parseResourceKind(argsStr: string): string | undefined {
  const args = argsStr.split(/\s+/).filter(a => a.length > 0);

  // Skip flags and subcommand to find the resource kind
  let i = 0;

  // Skip the kubectl subcommand (get, describe, delete, create, apply, etc.)
  if (i < args.length && !args[i]!.startsWith('-')) {
    i++;
  }

  // "apply" always uses -f; "create -f" also has no inline kind.
  // Both fall through to output-based parsing in the navigation handler.
  if (args[0] === 'apply') {
    return undefined;
  }
  if (args[0] === 'create' && argsStr.includes('-f')) {
    return undefined;
  }

  // Find first non-flag argument after the subcommand
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('-')) {
      // Skip flag and its value if it's a key=value flag
      if (!arg.includes('=') && i + 1 < args.length && !args[i + 1]!.startsWith('-')) {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    // This should be the resource kind, possibly as "kind/name"
    const kindPart = arg.split('/')[0]!.toLowerCase();
    return kindPart;
  }

  return undefined;
}

// Extract the resource kind from kubectl text output.
//
// kubectl prints a stable "kind[.apigroup]/name verb" line for mutating commands:
//   pod/nginx created
//   deployment.apps/nginx-deploy configured
//   service/bar deleted
//   configmap/my-config unchanged
//
// This covers "apply -f" and "create -f" where the kind is inside the YAML
// file, not in the CLI args. The regex strips the optional API group suffix
// (for example ".apps") and returns the base kind in lowercase.
function parseResourceFromOutput(output: string): string | undefined {
  const match = /^(\w+)(?:\.\S+)?\/\S+\s+\w+/m.exec(output);
  if (!match?.[1]) {
    return undefined;
  }
  return match[1].toLowerCase();
}

function navigateDashboard(panel: WebviewPanel, route: string): void {
  panel.reveal();
  panel.webview.postMessage({ channel: 'navigate', path: `/${route}` });
}

let registered = false;
let extensionWatcher: Disposable | undefined;

// Attempt to register navigation handlers with the MCP extension.
// Returns true on success, false if the MCP extension is not available yet.
async function tryRegister(panel: WebviewPanel): Promise<boolean> {
  // Navigation handler receives both the original tool args and the execution
  // result. Two-stage lookup:
  //   1. Try to extract the resource kind from the CLI args ("get pods", "delete svc foo")
  //   2. If the kind is not in the args (for example "apply -f file.yaml"), fall back to
  //      parsing the kubectl output text ("deployment.apps/nginx configured")
  const navHandler = async (args: Record<string, unknown>, result: ToolResult): Promise<void> => {
    const argsStr = (args.args as string) ?? '';

    // Stage 1: kind from CLI args
    const kindFromArgs = parseResourceKind(argsStr);
    if (kindFromArgs) {
      const route = RESOURCE_ROUTES[kindFromArgs];
      if (route) {
        navigateDashboard(panel, route);
        return;
      }
    }

    // Stage 2: kind from kubectl output (covers apply/create -f)
    const outputText = result?.content?.[0];
    if (outputText?.type === 'text' && outputText.text) {
      const kindFromOutput = parseResourceFromOutput(outputText.text);
      if (kindFromOutput) {
        const route = RESOURCE_ROUTES[kindFromOutput];
        if (route) {
          navigateDashboard(panel, route);
          return;
        }
      }
    }

    // Final fallback: reveal the dashboard without navigating to a specific page
    panel.reveal();
  };

  try {
    await commands.executeCommand('mcp.registerTools', {
      extensionId: EXTENSION_ID,
      navigation: {
        kubectl: navHandler,
        kube_create_resources: async (): Promise<void> => {
          panel.reveal();
        },
      },
    });
    registered = true;
    console.log('Kubernetes Dashboard: registered MCP navigation');
    return true;
  } catch {
    return false;
  }
}

// Register MCP navigation handlers. If the MCP extension is not active yet,
// listen for extension changes and retry when it becomes available.
export async function registerMcpTools(panel: WebviewPanel, context: ExtensionContext): Promise<void> {
  if (await tryRegister(panel)) {
    return;
  }

  console.log('Kubernetes Dashboard: MCP server not available yet, waiting for it to activate');

  extensionWatcher = extensions.onDidChange(async () => {
    if (registered) {
      return;
    }
    if (await tryRegister(panel)) {
      extensionWatcher?.dispose();
      extensionWatcher = undefined;
    }
  });
  context.subscriptions.push(extensionWatcher);
}

export async function unregisterMcpTools(): Promise<void> {
  extensionWatcher?.dispose();
  extensionWatcher = undefined;
  registered = false;

  try {
    await commands.executeCommand('mcp.unregisterTools', EXTENSION_ID);
  } catch {
    // MCP server may already be stopped
  }
}

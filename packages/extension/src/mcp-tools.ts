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

// Maps kubectl resource names (singular, plural, short) to webview list routes.
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

// Resources that share a list route and need a sub-kind segment in detail URLs.
//
//   List:   /configmapsSecrets
//   Detail: /configmapsSecrets/configmap/my-cm/default/summary
const DETAIL_PREFIX: Record<string, string> = {
  configmap: 'configmap',
  configmaps: 'configmap',
  cm: 'configmap',
  secret: 'secret',
  secrets: 'secret',
  ingress: 'ingress',
  ingresses: 'ingress',
  ing: 'ingress',
  route: 'route',
  routes: 'route',
};

// Cluster-scoped resources have no namespace segment in detail URLs.
//
//   Namespaced:     /pods/nginx/default/summary
//   Cluster-scoped: /nodes/node-1/summary
const CLUSTER_SCOPED = new Set([
  'node',
  'nodes',
  'no',
  'namespace',
  'namespaces',
  'ns',
  'persistentvolume',
  'persistentvolumes',
  'pv',
  'storageclass',
  'storageclasses',
  'sc',
  'ingressclass',
  'ingressclasses',
  'clusterrole',
  'clusterroles',
  'clusterrolebinding',
  'clusterrolebindings',
]);

interface ToolResultContent {
  type: string;
  text?: string;
}
interface ToolResult {
  content?: ToolResultContent[];
}

interface ParsedKubectl {
  subcommand: string;
  kind: string;
  name?: string;
}

interface ParsedOutput {
  kind: string;
  name: string;
  verb: string;
}

// Extract -n / --namespace value from tokenized kubectl args.
function parseNamespace(tokens: string[]): string | undefined {
  for (let i = 0; i < tokens.length; i++) {
    if ((tokens[i] === '-n' || tokens[i] === '--namespace') && i + 1 < tokens.length) {
      return tokens[i + 1];
    }
    const eq = tokens[i]!.match(/^--namespace=(.+)/);
    if (eq?.[1]) {
      return eq[1];
    }
  }
  return undefined;
}

// Parse kubectl args to extract subcommand, resource kind, and resource name.
//
// Handles:
//   get pods                    -> { subcommand: "get", kind: "pods" }
//   get pod nginx               -> { subcommand: "get", kind: "pod", name: "nginx" }
//   describe pod/nginx          -> { subcommand: "describe", kind: "pod", name: "nginx" }
//   rollout status deploy/nginx -> { subcommand: "rollout", kind: "deploy", name: "nginx" }
//
// Returns undefined for file-based commands (apply, create -f) where the kind
// is inside the YAML file.
function parseKubectl(tokens: string[]): ParsedKubectl | undefined {
  if (tokens.length === 0) {
    return undefined;
  }

  const subcommand = tokens[0]!;

  if (subcommand === 'apply') {
    return undefined;
  }
  if (subcommand === 'create' && tokens.includes('-f')) {
    return undefined;
  }

  // Compound commands ("rollout status", "set image") have a sub-action to skip
  let startIdx = 1;
  if (subcommand === 'rollout' || subcommand === 'set' || subcommand === 'auth') {
    startIdx = 2;
  }

  let kind: string | undefined;
  let name: string | undefined;
  let i = startIdx;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.startsWith('-')) {
      if (!token.includes('=') && i + 1 < tokens.length && !tokens[i + 1]!.startsWith('-')) {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (!kind) {
      const parts = token.split('/');
      const candidate = parts[0]!.toLowerCase();
      if (!RESOURCE_ROUTES[candidate]) {
        i++;
        continue;
      }
      kind = candidate;
      if (parts.length > 1 && parts[1]) {
        name = parts[1];
      }
    } else if (!name) {
      name = token;
    } else {
      break;
    }

    i++;
  }

  if (!kind) {
    return undefined;
  }
  return { subcommand, kind, name };
}

// Extract kind, name, and verb from kubectl mutating-command output.
//
//   pod/nginx created           -> { kind: "pod", name: "nginx", verb: "created" }
//   deployment.apps/foo deleted -> { kind: "deployment", name: "foo", verb: "deleted" }
function parseOutputResource(output: string): ParsedOutput | undefined {
  const match = /^(\w+)(?:\.\S+)?\/(\S+)\s+(\w+)/m.exec(output);
  if (!match?.[1] || !match?.[2] || !match?.[3]) {
    return undefined;
  }
  return { kind: match[1].toLowerCase(), name: match[2], verb: match[3] };
}

// Parse kind, metadata.name, and metadata.namespace from a Kubernetes YAML manifest.
function parseYamlMeta(yaml: string): { kind?: string; name?: string; namespace?: string } {
  const kind = /^kind:\s*(\S+)/m.exec(yaml)?.[1]?.toLowerCase();

  // Match name/namespace as direct children of "metadata:" (at 2-space indent)
  // while skipping deeper-nested fields like labels or annotations.
  const name = /^metadata:\s*\n(?:[ \t]+.*\n)*?  name:\s*(\S+)/m.exec(yaml)?.[1];
  const namespace = /^metadata:\s*\n(?:[ \t]+.*\n)*?  namespace:\s*(\S+)/m.exec(yaml)?.[1];

  return { kind, name, namespace };
}

// Build a detail-page route for a specific resource.
//
//   ("pod", "nginx", "default")     -> "pods/nginx/default/summary"
//   ("node", "node-1", undefined)   -> "nodes/node-1/summary"
//   ("cm", "my-cm", "kube-system")  -> "configmapsSecrets/configmap/my-cm/kube-system/summary"
//
// Returns undefined when the route requires a namespace but none is provided.
function buildDetailRoute(kind: string, name: string, namespace?: string): string | undefined {
  const route = RESOURCE_ROUTES[kind];
  if (!route) {
    return undefined;
  }

  const prefix = DETAIL_PREFIX[kind];

  if (CLUSTER_SCOPED.has(kind)) {
    if (prefix) {
      return `${route}/${prefix}/${name}/summary`;
    }
    return `${route}/${name}/summary`;
  }

  if (!namespace) {
    return undefined;
  }

  if (prefix) {
    return `${route}/${prefix}/${name}/${namespace}/summary`;
  }
  return `${route}/${name}/${namespace}/summary`;
}

function navigateDashboard(panel: WebviewPanel, route: string): void {
  panel.reveal();
  panel.webview.postMessage({ id: 'Navigate', body: `/${route}` });
}

let registered = false;
let extensionWatcher: Disposable | undefined;

async function tryRegister(panel: WebviewPanel): Promise<boolean> {
  // kubectl navigation handler.
  //
  // Two-stage resolution:
  //   1. Parse the resource kind, name, and namespace from CLI args
  //   2. Fall back to parsing the kubectl output text (for apply -f / create -f)
  //
  // Single-resource operations navigate to the detail page when the name (and
  // namespace for namespaced resources) are available.  Delete and list operations
  // navigate to the list page.
  const navHandler = async (args: Record<string, unknown>, result: ToolResult): Promise<void> => {
    const argsStr = (args.args as string) ?? '';
    const tokens = argsStr.split(/\s+/).filter(a => a.length > 0);
    const namespace = parseNamespace(tokens);

    // Stage 1: parse from CLI args
    const parsed = parseKubectl(tokens);
    if (parsed) {
      if (parsed.name && parsed.subcommand !== 'delete') {
        const detail = buildDetailRoute(parsed.kind, parsed.name, namespace);
        if (detail) {
          navigateDashboard(panel, detail);
          return;
        }
      }

      const route = RESOURCE_ROUTES[parsed.kind];
      if (route) {
        navigateDashboard(panel, route);
        return;
      }
    }

    // Stage 2: parse from kubectl output (covers apply -f, create -f)
    const outputText = result?.content?.[0];
    if (outputText?.type === 'text' && outputText.text) {
      const output = parseOutputResource(outputText.text);
      if (output) {
        if (output.verb !== 'deleted') {
          const detail = buildDetailRoute(output.kind, output.name, namespace);
          if (detail) {
            navigateDashboard(panel, detail);
            return;
          }
        }

        const route = RESOURCE_ROUTES[output.kind];
        if (route) {
          navigateDashboard(panel, route);
          return;
        }
      }
    }

    panel.reveal();
  };

  // kube_create_resources navigation handler.
  //
  // Parses the YAML manifest for kind, metadata.name, and metadata.namespace
  // to navigate directly to the created resource.
  const kubeCreateNav = async (args: Record<string, unknown>): Promise<void> => {
    const yaml = (args.yaml as string) ?? '';
    const meta = parseYamlMeta(yaml);

    if (meta.kind && meta.name) {
      const detail = buildDetailRoute(meta.kind, meta.name, meta.namespace);
      if (detail) {
        navigateDashboard(panel, detail);
        return;
      }
    }

    if (meta.kind) {
      const route = RESOURCE_ROUTES[meta.kind];
      if (route) {
        navigateDashboard(panel, route);
        return;
      }
    }

    panel.reveal();
  };

  try {
    await commands.executeCommand('mcp.registerTools', {
      extensionId: EXTENSION_ID,
      prefix: 'ext_k8s',
      navigation: {
        kubectl: navHandler,
        kube_create_resources: kubeCreateNav,
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

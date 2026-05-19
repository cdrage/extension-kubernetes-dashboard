/**********************************************************************
 * Copyright (C) 2025 - 2026 Red Hat, Inc.
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

import type { Component } from 'svelte';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
  faBolt,
  faClock,
  faDatabase,
  faFilter,
  faGaugeHigh,
  faHardDrive,
  faIdBadge,
  faLink,
  faNetworkWired,
  faPlug,
  faRoute,
  faRuler,
  faScaleBalanced,
  faShield,
  faShieldHalved,
  faSortAmountUp,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';

import CronJobIcon from './CronJobIcon.svelte';
import DeploymentIcon from './DeploymentIcon.svelte';
import IngressRouteIcon from './IngressRouteIcon.svelte';
import JobIcon from './JobIcon.svelte';
import NodeIcon from './NodeIcon.svelte';
import PodIcon from './PodIcon.svelte';
import PvcIcon from './PVCIcon.svelte';
import ServiceIcon from './ServiceIcon.svelte';
import NamespaceIcon from './NamespaceIcon.svelte';
import ConfigMapIcon from './ConfigMapIcon.svelte';
import SecretIcon from './SecretIcon.svelte';
import ConfigMapSecretIcon from './ConfigMapSecretIcon.svelte';

export const icon: Record<string, Component | IconDefinition> = {
  // Existing SVG component icons
  ConfigMap: ConfigMapIcon,
  Secret: SecretIcon,
  ConfigMapSecret: ConfigMapSecretIcon,
  CronJob: CronJobIcon,
  Deployment: DeploymentIcon,
  Ingress: IngressRouteIcon,
  Route: IngressRouteIcon,
  Job: JobIcon,
  Node: NodeIcon,
  Pod: PodIcon,
  PersistentVolumeClaim: PvcIcon,
  Service: ServiceIcon,
  Namespace: NamespaceIcon,

  // Reuse existing icons for similar workload resources
  DaemonSet: DeploymentIcon,
  StatefulSet: DeploymentIcon,
  ReplicaSet: DeploymentIcon,

  // FontAwesome icons for remaining resources
  ClusterRole: faShieldHalved,
  ClusterRoleBinding: faLink,
  Role: faShield,
  RoleBinding: faLink,
  ServiceAccount: faIdBadge,
  EndpointSlice: faPlug,
  Endpoints: faPlug,
  Event: faBolt,
  Gateway: faNetworkWired,
  GatewayClass: faNetworkWired,
  HorizontalPodAutoscaler: faGaugeHigh,
  HTTPRoute: faRoute,
  IngressClass: faRoute,
  Lease: faClock,
  LimitRange: faRuler,
  MutatingWebhookConfiguration: faFilter,
  ValidatingWebhookConfiguration: faFilter,
  NetworkPolicy: faShieldHalved,
  PersistentVolume: faHardDrive,
  PodDisruptionBudget: faShieldHalved,
  PriorityClass: faSortAmountUp,
  ResourceQuota: faScaleBalanced,
  RuntimeClass: faTerminal,
  StorageClass: faDatabase,
};

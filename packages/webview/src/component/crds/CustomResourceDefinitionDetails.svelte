<script lang="ts">
import { getContext } from 'svelte';
import KubernetesObjectDetails from '/@/component/objects/KubernetesObjectDetails.svelte';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import { CrdHelper } from './crd-helper';
import type { CustomResourceDefinitionUI } from './CustomResourceDefinitionUI';
import type { KubernetesObject } from '@kubernetes/client-node';
import CustomResourceDefinitionDetailsSummary from './CustomResourceDefinitionDetailsSummary.svelte';

interface Props {
  name: string;
}
let { name }: Props = $props();

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const crdHelper = dependencyAccessor.get<CrdHelper>(CrdHelper);
</script>

<KubernetesObjectDetails
  typed={{} as KubernetesObject}
  typedUI={{} as CustomResourceDefinitionUI}
  kind="CustomResourceDefinition"
  resourceName="customresourcedefinitions"
  listName="Custom Resource Definitions"
  name={name}
  transformer={crdHelper.getCustomResourceDefinitionUI.bind(crdHelper)}
  SummaryComponent={CustomResourceDefinitionDetailsSummary} />

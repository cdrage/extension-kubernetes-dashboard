<script lang="ts">
import { getContext } from 'svelte';
import KubernetesObjectDetails from '/@/component/objects/KubernetesObjectDetails.svelte';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import { EventStandaloneHelper } from './event-standalone-helper';
import type { EventStandaloneUI } from './EventStandaloneUI';
import type { CoreV1Event } from '@kubernetes/client-node';
import EventStandaloneDetailsSummary from './EventStandaloneDetailsSummary.svelte';

interface Props {
  name: string;
  namespace: string;
}
let { name, namespace }: Props = $props();

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const eventStandaloneHelper = dependencyAccessor.get<EventStandaloneHelper>(EventStandaloneHelper);
</script>

<KubernetesObjectDetails
  typed={{} as CoreV1Event}
  typedUI={{} as EventStandaloneUI}
  kind="Event"
  resourceName="events"
  listName="Events"
  name={name}
  namespace={namespace}
  transformer={eventStandaloneHelper.getEventStandaloneUI.bind(eventStandaloneHelper)}
  SummaryComponent={EventStandaloneDetailsSummary} />

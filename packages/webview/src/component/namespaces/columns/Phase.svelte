<script lang="ts">
import { faCheckCircle, faTimesCircle, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

import type { Props } from './props';
import Label from '/@/component/label/Label.svelte';

let { object }: Props = $props();

function getPhaseAttributes(phase: string): { color: string; icon: IconDefinition } {
  switch (phase) {
    case 'Active':
      return { color: 'text-(--pd-status-running)', icon: faCheckCircle };
    case 'Terminating':
      return { color: 'text-(--pd-status-degraded)', icon: faTimesCircle };
    default:
      return { color: 'text-(--pd-status-running)', icon: faCheckCircle };
  }
}
</script>

<Label name={object.phase}>
  <Fa size="1x" icon={getPhaseAttributes(object.phase).icon} class={getPhaseAttributes(object.phase).color} />
</Label>

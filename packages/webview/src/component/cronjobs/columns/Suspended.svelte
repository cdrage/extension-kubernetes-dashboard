<script lang="ts">
import { faCheckCircle, faPause, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

import type { Props } from './props';
import Label from '/@/component/label/Label.svelte';

let { object }: Props = $props();

function getSuspendedAttributes(suspended: boolean): { name: string; color: string; icon: IconDefinition } {
  if (suspended) {
    return { name: 'Yes', color: 'text-(--pd-status-degraded)', icon: faPause };
  }
  return { name: 'No', color: 'text-(--pd-status-running)', icon: faCheckCircle };
}
</script>

<Label name={getSuspendedAttributes(object.suspended).name}>
  <Fa size="1x" icon={getSuspendedAttributes(object.suspended).icon} class={getSuspendedAttributes(object.suspended).color} />
</Label>

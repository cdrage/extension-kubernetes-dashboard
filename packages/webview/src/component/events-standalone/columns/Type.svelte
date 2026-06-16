<script lang="ts">
import {
  faCheckCircle,
  faExclamationTriangle,
  faQuestionCircle,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { Fa } from 'svelte-fa';

import type { Props } from './props';
import Label from '/@/component/label/Label.svelte';

let { object }: Props = $props();

// Determine both the icon and color based on the event type
function getTypeAttributes(type: string): { color: string; icon: IconDefinition } {
  switch (type) {
    case 'Warning':
      // faExclamationTriangle: Indicates a warning event that may need attention
      return { color: 'text-(--pd-status-degraded)', icon: faExclamationTriangle };
    case 'Normal':
      // faCheckCircle: Represents a normal, healthy event
      return { color: 'text-(--pd-status-running)', icon: faCheckCircle };
    default:
      // faQuestionCircle: Used for unknown or unspecified event types
      return { color: 'text-(--pd-status-unknown)', icon: faQuestionCircle };
  }
}
</script>

<Label name={object.type}>
  <Fa size="1x" icon={getTypeAttributes(object.type).icon} class={getTypeAttributes(object.type).color} />
</Label>

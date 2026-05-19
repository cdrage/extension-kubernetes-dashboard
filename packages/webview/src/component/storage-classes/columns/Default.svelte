<script lang="ts">
import { faStar } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

import type { Props } from './props';
import Label from '/@/component/label/Label.svelte';

let { object }: Props = $props();
</script>

{#if object.isDefault === 'Yes'}
  <Label name="Yes">
    <Fa size="1x" icon={faStar} class="text-(--pd-status-running)" />
  </Label>
{/if}

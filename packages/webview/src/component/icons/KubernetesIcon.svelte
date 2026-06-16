<script lang="ts">
import type { Component } from 'svelte';
import { icon } from './icon';
import KubeIcon from './KubeIcon.svelte';

interface Props {
  kind: string;
  size?: string;
}
let { kind, size = '1em' }: Props = $props();

const resolvedIcon: Component = $derived.by(() => {
  return icon[kind] || KubeIcon;
});
</script>

{@const SvelteIcon = resolvedIcon as Component<{ size?: string }>}
<SvelteIcon size={size} />

<!--
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
-->
<script lang="ts">
import { router } from 'tinro';

import type { CustomResourceInstanceUI } from '/@/component/custom-resources/CustomResourceInstanceUI';

let { object }: { object: CustomResourceInstanceUI } = $props();

function openDetails(): void {
  const base = `/customresources/${encodeURIComponent(object.group)}/${encodeURIComponent(object.version)}/${encodeURIComponent(object.plural)}`;
  const detail = object.namespace
    ? `${base}/${encodeURIComponent(object.name)}/${encodeURIComponent(object.namespace)}/summary`
    : `${base}/${encodeURIComponent(object.name)}/_/summary`;
  router.goto(detail);
}
</script>

<button class="hover:cursor-pointer flex flex-col max-w-full text-left" onclick={openDetails}>
  <div class="text-(--pd-table-body-text-highlight) overflow-hidden text-ellipsis">
    {object.name}
  </div>
  {#if object.namespace}
    <div class="text-(--pd-table-body-text) font-extra-light text-sm overflow-hidden text-ellipsis">
      {object.namespace}
    </div>
  {/if}
</button>

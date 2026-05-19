<script lang="ts">
import { TableColumn, TableDurationColumn, TableRow, TableSimpleColumn } from '@podman-desktop/ui-svelte';
import moment from 'moment';

import NameColumn from '/@/component/objects/columns/Name.svelte';
import StatusColumn from '/@/component/objects/columns/Status.svelte';
import KubernetesObjectsList from '/@/component/objects/KubernetesObjectsList.svelte';
import { getContext } from 'svelte';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import KubernetesEmptyScreen from '/@/component/objects/KubernetesEmptyScreen.svelte';
import { icon } from '/@/component/icons/icon';
import type { LimitRangeUI } from './LimitRangeUI';
import { LimitRangeHelper } from './limit-range-helper';

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const limitRangeHelper = dependencyAccessor.get<LimitRangeHelper>(LimitRangeHelper);

let statusColumn = new TableColumn<LimitRangeUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: StatusColumn,
  comparator: (a, b): number => a.status.localeCompare(b.status),
});

let nameColumn = new TableColumn<LimitRangeUI>('Name', {
  width: '1.3fr',
  renderer: NameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

let limitsColumn = new TableColumn<LimitRangeUI, string>('Limits', {
  width: '3fr',
  renderMapping: (obj): string => obj.limits,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.limits.localeCompare(b.limits),
});

let ageColumn = new TableColumn<LimitRangeUI, Date | undefined>('Age', {
  renderMapping: (obj): Date | undefined => obj.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

const columns = [statusColumn, nameColumn, limitsColumn, ageColumn];

const row = new TableRow<LimitRangeUI>({ selectable: (_obj): boolean => true });
</script>

<KubernetesObjectsList
  kinds={[
    {
      resource: 'limitranges',
      transformer: limitRangeHelper.getLimitRangeUI,
    },
  ]}
  singular="limit range"
  plural="limit ranges"
  isNamespaced={true}
  icon={icon['LimitRange']}
  columns={columns}
  row={row}>
  <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
  {#snippet emptySnippet()}
    <KubernetesEmptyScreen icon={icon['LimitRange']} resources={['limitranges']} />
  {/snippet}
</KubernetesObjectsList>

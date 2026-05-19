<script lang="ts">
import { TableColumn, TableDurationColumn, TableRow, TableSimpleColumn } from '@podman-desktop/ui-svelte';
import moment from 'moment';

import TypeColumn from './columns/Type.svelte';
import NameColumn from '/@/component/objects/columns/Name.svelte';
import StatusColumn from '/@/component/objects/columns/Status.svelte';
import KubernetesObjectsList from '/@/component/objects/KubernetesObjectsList.svelte';
import { getContext } from 'svelte';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import KubernetesEmptyScreen from '/@/component/objects/KubernetesEmptyScreen.svelte';
import { icon } from '/@/component/icons/icon';
import type { EventStandaloneUI } from './EventStandaloneUI';
import { EventStandaloneHelper } from './event-standalone-helper';

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const eventStandaloneHelper = dependencyAccessor.get<EventStandaloneHelper>(EventStandaloneHelper);

let statusColumn = new TableColumn<EventStandaloneUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: StatusColumn,
  comparator: (a, b): number => a.status.localeCompare(b.status),
});

let nameColumn = new TableColumn<EventStandaloneUI>('Name', {
  width: '1.3fr',
  renderer: NameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

let typeColumn = new TableColumn<EventStandaloneUI>('Type', {
  renderer: TypeColumn,
  comparator: (a, b): number => a.type.localeCompare(b.type),
});

let messageColumn = new TableColumn<EventStandaloneUI, string>('Message', {
  width: '3fr',
  renderMapping: (obj): string => obj.message,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.message.localeCompare(b.message),
});

let involvedObjectColumn = new TableColumn<EventStandaloneUI, string>('Involved Object', {
  width: '1.5fr',
  renderMapping: (obj): string => obj.involvedObject,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.involvedObject.localeCompare(b.involvedObject),
});

let sourceColumn = new TableColumn<EventStandaloneUI, string>('Source', {
  renderMapping: (obj): string => obj.source,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.source.localeCompare(b.source),
});

let countColumn = new TableColumn<EventStandaloneUI, string>('Count', {
  renderMapping: (obj): string => String(obj.count),
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.count - b.count,
});

let reasonColumn = new TableColumn<EventStandaloneUI, string>('Reason', {
  renderMapping: (obj): string => obj.reason,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.reason.localeCompare(b.reason),
});

let lastSeenColumn = new TableColumn<EventStandaloneUI, Date | undefined>('Last Seen', {
  renderMapping: (obj): Date | undefined => obj.lastSeen,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.lastSeen).diff(moment(a.lastSeen)),
});

let ageColumn = new TableColumn<EventStandaloneUI, Date | undefined>('Age', {
  renderMapping: (obj): Date | undefined => obj.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

const columns = [statusColumn, nameColumn, typeColumn, messageColumn, involvedObjectColumn, sourceColumn, countColumn, reasonColumn, lastSeenColumn, ageColumn];

const row = new TableRow<EventStandaloneUI>({ selectable: (_obj): boolean => true });
</script>

<KubernetesObjectsList
  kinds={[
    {
      resource: 'events',
      transformer: eventStandaloneHelper.getEventStandaloneUI,
    },
  ]}
  singular="event"
  plural="events"
  isNamespaced={true}
  icon={icon['Event']}
  columns={columns}
  row={row}>
  {#snippet emptySnippet()}
    <KubernetesEmptyScreen icon={icon['Event']} resources={['events']} />
  {/snippet}
</KubernetesObjectsList>

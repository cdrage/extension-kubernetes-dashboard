<script lang="ts">
import { TableColumn, TableDurationColumn, TableRow, TableSimpleColumn } from '@podman-desktop/ui-svelte';
import moment from 'moment';

import NameColumn from '/@/component/objects/columns/Name.svelte';
import StatusColumn from '/@/component/objects/columns/Status.svelte';
import KubernetesObjectsList from '/@/component/objects/KubernetesObjectsList.svelte';
import { getContext } from 'svelte';
import { DependencyAccessor } from '/@/inject/dependency-accessor';
import KubernetesEmptyScreen from '/@/component/objects/KubernetesEmptyScreen.svelte';
import KubeIcon from '/@/component/icons/KubeIcon.svelte';
import type { CustomResourceDefinitionUI } from './CustomResourceDefinitionUI';
import { CrdHelper } from './crd-helper';

const dependencyAccessor = getContext<DependencyAccessor>(DependencyAccessor);
const crdHelper = dependencyAccessor.get<CrdHelper>(CrdHelper);

let statusColumn = new TableColumn<CustomResourceDefinitionUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: StatusColumn,
  comparator: (a, b): number => a.status.localeCompare(b.status),
});

let nameColumn = new TableColumn<CustomResourceDefinitionUI>('Name', {
  width: '2fr',
  renderer: NameColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

let groupColumn = new TableColumn<CustomResourceDefinitionUI, string>('Group', {
  width: '1.5fr',
  renderMapping: (obj): string => obj.group,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.group.localeCompare(b.group),
});

let kindColumn = new TableColumn<CustomResourceDefinitionUI, string>('Kind', {
  renderMapping: (obj): string => obj.crdKind,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.crdKind.localeCompare(b.crdKind),
});

let scopeColumn = new TableColumn<CustomResourceDefinitionUI, string>('Scope', {
  renderMapping: (obj): string => obj.scope,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.scope.localeCompare(b.scope),
});

let storedVersionsColumn = new TableColumn<CustomResourceDefinitionUI, string>('Stored Versions', {
  renderMapping: (obj): string => obj.storedVersions,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.storedVersions.localeCompare(b.storedVersions),
});

let ageColumn = new TableColumn<CustomResourceDefinitionUI, Date | undefined>('Age', {
  renderMapping: (obj): Date | undefined => obj.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

const columns = [statusColumn, nameColumn, groupColumn, kindColumn, scopeColumn, storedVersionsColumn, ageColumn];

const row = new TableRow<CustomResourceDefinitionUI>({ selectable: (_obj): boolean => true });
</script>

<KubernetesObjectsList
  kinds={[
    {
      resource: 'customresourcedefinitions',
      transformer: crdHelper.getCustomResourceDefinitionUI,
    },
  ]}
  singular="custom resource definition"
  plural="custom resource definitions"
  isNamespaced={false}
  icon={KubeIcon}
  columns={columns}
  row={row}>
  {#snippet emptySnippet()}
    <KubernetesEmptyScreen icon={KubeIcon} resources={['customresourcedefinitions']} />
  {/snippet}
</KubernetesObjectsList>

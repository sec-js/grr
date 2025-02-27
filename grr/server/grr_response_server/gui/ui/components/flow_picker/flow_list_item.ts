import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

import {
  FLOW_LIST_ITEMS_BY_TYPE,
  FlowListItem,
  FlowType,
} from '../../lib/models/flow';
import {transformMapValues} from '../../lib/type_utils';
import {ConfigGlobalStore} from '../../store/config_global_store';

/**
 * Map of flow categories to flow list items.
 */
export type FlowsByCategory = ReadonlyMap<string, FlowListItem[]>;

/**
 * Flows, split by category, to be displayed by the flow picker.
 */
// Note: The Map instantiation is less readable without Object.entries(), but
// the reason to not use it is the possible property name obfuscation issues.
const FLOWS_BY_CATEGORY: FlowsByCategory = new Map([
  // TODO: Commented out flows do not have a proper flow form
  // yet. Hide them, to not show users an option that they cannot use.
  [
    'Collectors',
    [
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.ARTIFACT_COLLECTOR_FLOW]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.OS_QUERY_FLOW]!,
    ],
  ],
  ['Browser', [FLOW_LIST_ITEMS_BY_TYPE[FlowType.COLLECT_BROWSER_HISTORY]!]],
  ['Hardware', [FLOW_LIST_ITEMS_BY_TYPE[FlowType.GET_MBR]!]],
  [
    'Filesystem',
    [
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.COLLECT_FILES_BY_KNOWN_PATH]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.COLLECT_MULTIPLE_FILES]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.STAT_MULTIPLE_FILES]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.HASH_MULTIPLE_FILES]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.LIST_DIRECTORY]!,
      // TODO:
      // fli('ListVolumeShadowCopies', 'List volume shadow copies'),
      // fli('RecursiveListDirectory', 'List directory recursively',
      // 'Lists and stats all files in directory and its subdirectories'),
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.TIMELINE_FLOW]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.READ_LOW_LEVEL]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.COLLECT_LARGE_FILE_FLOW]!,
    ],
  ],
  [
    'Administrative',
    [
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.ONLINE_NOTIFICATION]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.EXECUTE_PYTHON_HACK]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.INTERROGATE]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.KILL]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.LAUNCH_BINARY]!,
      // TODO:
      // fli('OnlineNotification', 'Notify when online',
      //     'Send an email notification when the GRR agent comes online'),
      // fli('Uninstall', 'Uninstall GRR',
      //     'Permanently uninstall GRR from the host'),
      // fli('UpdateClient', 'Update GRR client',
      //     'Update GRR on the host to the latest version'),
    ],
  ],
  [
    'Processes',
    [
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.LIST_PROCESSES]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.LIST_NAMED_PIPES_FLOW]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.DUMP_PROCESS_MEMORY]!,
      FLOW_LIST_ITEMS_BY_TYPE[FlowType.YARA_PROCESS_SCAN]!,
    ],
  ],
  ['Network', [FLOW_LIST_ITEMS_BY_TYPE[FlowType.NETSTAT]!]],
  // TODO:
  // ['Registry', [
  //   fli('RegistryFinder', 'Find registry keys/values'),
  // ]],
]);

/**
 * List of commonly used flow names.
 */
const COMMON_FLOW_NAMES: readonly FlowType[] = [
  FlowType.ARTIFACT_COLLECTOR_FLOW,
  FlowType.COLLECT_BROWSER_HISTORY,
  FlowType.INTERROGATE,
  FlowType.OS_QUERY_FLOW,
  FlowType.TIMELINE_FLOW,
];

const COMMON_FILE_FLOWS: readonly FlowListItem[] = [
  FLOW_LIST_ITEMS_BY_TYPE[FlowType.COLLECT_FILES_BY_KNOWN_PATH]!,
  FLOW_LIST_ITEMS_BY_TYPE[FlowType.COLLECT_MULTIPLE_FILES]!,
];

/**
 * Singleton providing access to global configuration settings.
 */
@Injectable({
  providedIn: 'root',
})
export class FlowListItemService {
  constructor(private readonly configGlobalStore: ConfigGlobalStore) {
    this.allowedFlowDescriptorNames$ =
      this.configGlobalStore.flowDescriptors$.pipe(
        map((fds) => new Set(Array.from(fds.values()).map((fd) => fd.name))),
      );
    this.flowsByCategory$ = this.allowedFlowDescriptorNames$.pipe(
      map((allowedNames) =>
        transformMapValues(FLOWS_BY_CATEGORY, (entries) =>
          entries.map((fli) => ({...fli, enabled: allowedNames.has(fli.type)})),
        ),
      ),
    );
    this.commonFlowNames$ = this.allowedFlowDescriptorNames$.pipe(
      map((allowedNames) =>
        COMMON_FLOW_NAMES.filter((name) => allowedNames.has(name)),
      ),
    );
    this.commonFileFlows$ = this.allowedFlowDescriptorNames$.pipe(
      map((allowedNames) =>
        COMMON_FILE_FLOWS.filter((fli) => allowedNames.has(fli.type)),
      ),
    );
  }

  // TODO: Update the way "allowed flows" are computed,
  // once all FlowDescriptors, including restricted, are always returned from
  // ListFlowDescriptors API endpoint.
  readonly allowedFlowDescriptorNames$: Observable<ReadonlySet<string>>;

  readonly flowsByCategory$: Observable<FlowsByCategory>;

  readonly commonFlowNames$: Observable<readonly FlowType[]>;

  readonly commonFileFlows$: Observable<readonly FlowListItem[]>;
}

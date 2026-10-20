import { ref, watch } from "vue";
import type { ColumnOption } from "@/types/component";

/** 列标题随语言和业务配置更新，同时保留用户的列顺序及显隐选择。 */
export function useManagementColumns(source: () => ColumnOption[]) {
  const columns = ref<ColumnOption[]>([]);
  watch(
    source,
    (incoming) => {
      const key = (column: ColumnOption) => column.prop || column.type;
      const definitions = new Map(incoming.map((column) => [key(column), column]));
      const previousKeys = new Set(columns.value.map(key));
      const retained = columns.value.flatMap((previous) => {
        const definition = definitions.get(key(previous));
        return definition
          ? [
              {
                ...definition,
                visible: previous.visible ?? definition.visible,
                checked: previous.checked ?? definition.checked,
              },
            ]
          : [];
      });
      columns.value = [...retained, ...incoming.filter((column) => !previousKeys.has(key(column)))];
    },
    { immediate: true }
  );
  return columns;
}

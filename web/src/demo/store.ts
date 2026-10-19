import { ref } from "vue";
import { ElMessage } from "element-plus";
import { seed, migrateDrafts, type State } from "./model";
import { migrateProductMaterials } from "./product-materials";

const KEY = "wsn-erp-demo-v1";
function load(): State {
  const raw = localStorage.getItem(KEY);
  if (!raw) return seed();
  const parsed = JSON.parse(raw) as State;
  if (
    parsed.version !== 1 ||
    !Array.isArray(parsed.plans) ||
    !Array.isArray(parsed.materials) ||
    !parsed.stocks ||
    !Array.isArray(parsed.warehouses) ||
    !Array.isArray(parsed.requests) ||
    !Array.isArray(parsed.purchases) ||
    !Array.isArray(parsed.movements)
  ) {
    throw new Error("演示数据格式不兼容，请重置演示数据");
  }
  migrateDrafts(parsed);
  migrateProductMaterials(parsed);
  return parsed;
}
export const storageError = ref("");
export const state = ref<State>(seed());
try {
  state.value = load();
} catch (error) {
  storageError.value = error instanceof Error ? error.message : "无法读取浏览器数据，请重置";
}

// 先在副本中完成全部校验与修改，再持久化并发布，避免多行单据部分成功。
export function commit(action: (draft: State) => void, message = "操作成功") {
  try {
    if (storageError.value) throw new Error(storageError.value);
    const draft: State = JSON.parse(JSON.stringify(state.value));
    action(draft);
    localStorage.setItem(KEY, JSON.stringify(draft));
    state.value = draft;
    ElMessage.success(message);
    return true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "操作失败，请重试");
    return false;
  }
}
export function reset() {
  try {
    const fresh = seed();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    state.value = fresh;
    storageError.value = "";
    ElMessage.success("已恢复初始演示数据");
  } catch {
    ElMessage.error("浏览器不允许保存数据，请检查存储权限");
  }
}
export const material = (id: string) => state.value.materials.find((m) => m.id === id)!;
export const warehouseName = (id: string) =>
  state.value.warehouses.find((w) => w.id === id)?.name || id;

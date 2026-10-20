import { onActivated, type InjectionKey, type Ref } from "vue";

// 弹窗跟随所属缓存页显隐，离开页面时释放遮罩及滚动锁，但保留表单和详情。
export const pageActiveKey: InjectionKey<Ref<boolean>> = Symbol("page-active");

// 独立挂载和首次进入立即处理；缓存恢复时重新消费新的单据跳转指令。
export function usePageActivation(action: () => void) {
  action();
  let firstActivation = true;
  onActivated(() => {
    if (firstActivation) {
      firstActivation = false;
      return;
    }
    action();
  });
}

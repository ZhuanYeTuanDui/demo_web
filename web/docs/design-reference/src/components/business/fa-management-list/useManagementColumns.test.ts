import { describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useManagementColumns } from "./useManagementColumns";

describe("管理列表列配置", () => {
  it("切换语言后保留用户排序及隐藏状态，删除失效列并补充新列", async () => {
    const label = ref("名称");
    const extra = ref(false);
    let columns: ReturnType<typeof useManagementColumns>;
    const wrapper = mount(
      defineComponent({
        setup() {
          columns = useManagementColumns(() => [
            { prop: "name", label: label.value },
            { prop: extra.value ? "price" : "code", label: extra.value ? "价格" : "编码" },
          ]);
          return () => null;
        },
      })
    );
    columns!.value.reverse();
    columns!.value.find((column) => column.prop === "name")!.visible = false;
    label.value = "Name";
    await nextTick();
    expect(columns!.value.map((column) => column.prop)).toEqual(["code", "name"]);
    expect(columns!.value[1]).toMatchObject({ label: "Name", visible: false });
    extra.value = true;
    await nextTick();
    expect(columns!.value.map((column) => column.prop)).toEqual(["name", "price"]);
    expect(columns!.value[0]!.visible).toBe(false);
    wrapper.unmount();
  });
});

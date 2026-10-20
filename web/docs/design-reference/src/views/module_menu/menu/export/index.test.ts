import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ElementPlus from "element-plus";

const {
  listCatalogVersions,
  createCatalogExportRecord,
  listCatalogExportRecords,
  getCatalogExportRecord,
  downloadCatalogExportRecord,
  getDictionary,
  getVipLevelOptions,
  saveAs,
} = vi.hoisted(() => ({
  listCatalogVersions: vi.fn(),
  createCatalogExportRecord: vi.fn(),
  listCatalogExportRecords: vi.fn(),
  getCatalogExportRecord: vi.fn(),
  downloadCatalogExportRecord: vi.fn(),
  getDictionary: vi.fn(),
  getVipLevelOptions: vi.fn(),
  saveAs: vi.fn(),
}));
vi.mock("@/api/business/recipeEditor", () => ({
  listCatalogVersions,
  createCatalogExportRecord,
  listCatalogExportRecords,
  getCatalogExportRecord,
  downloadCatalogExportRecord,
  getDictionary,
}));
vi.mock("@/api/business/customer", () => ({ getVipLevelOptions }));
vi.mock("@/utils/download", () => ({ default: { saveAs } }));

import CatalogExportPage from "./index.vue";

const version = (id: number, name: string) => ({
  id,
  menu_id: id,
  code: `MENU-${id}`,
  name,
  author: "廖宗平",
  revision_no: id,
  format_version: "V7",
  revision_status: 1,
  category_name: "畜类",
  cuisine_name: "川",
  vip_level_name: "V2",
  step_count: 6,
  cover_url: "",
});

const exportRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  name: "十月菜谱",
  scope: "selected",
  status: "queued",
  stage: "queued",
  progress: 0,
  total_count: 2,
  processed_count: 0,
  exported_count: 0,
  skipped_count: 0,
  created_id: 1,
  created_name: "管理员",
  created_time: "2026-10-16T08:00:00Z",
  finished_time: null,
  expires_time: null,
  error_message: null,
  ...overrides,
});

let wrapper: VueWrapper | undefined;
beforeEach(() => {
  listCatalogExportRecords.mockResolvedValue({ items: [], total: 0 });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.clearAllMocks();
});

describe("菜谱版本导出页", () => {
  it("隐藏顶部说明，并可收起筛选后保留已填条件", async () => {
    listCatalogVersions.mockResolvedValue({ items: [], total: 0 });
    getDictionary.mockResolvedValue([]);
    getVipLevelOptions.mockResolvedValue([]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    expect(listCatalogVersions).toHaveBeenCalledWith(1, 8, expect.any(Object));
    expect(wrapper.text()).not.toContain("按具体版本选择菜谱");
    const input = wrapper.find('input[placeholder="输入菜谱名称"]');
    await input.setValue("鱼");
    const collapse = wrapper.findAll("button").find((item) => item.text().includes("收起筛选"));
    await collapse!.trigger("click");
    expect((wrapper.find("#catalog-export-filters").element as HTMLElement).style.display).toBe(
      "none"
    );
    const expand = wrapper.findAll("button").find((item) => item.text().includes("展开筛选"));
    await expand!.trigger("click");
    expect((wrapper.find("#catalog-export-filters").element as HTMLElement).style.display).toBe("");
    expect((input.element as HTMLInputElement).value).toBe("鱼");
  });

  it("切换分页保留已选版本，填写名称后创建导出记录", async () => {
    listCatalogVersions.mockImplementation(async (page: number) => ({
      items: page === 1 ? [version(11, "宫保鸡丁")] : [version(22, "鱼香肉丝")],
      total: 24,
    }));
    createCatalogExportRecord.mockResolvedValue(exportRecord());
    getDictionary.mockResolvedValue([{ id: 46, name: "畜类" }]);
    getVipLevelOptions.mockResolvedValue([
      { id: 2, name: "V2", level_value: 2, is_default: false },
    ]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    await wrapper.find(".version-card").trigger("click");
    expect(wrapper.text()).toContain("已选 1");

    const pager = wrapper.findComponent({ name: "ElPagination" });
    pager.vm.$emit("update:current-page", 2);
    pager.vm.$emit("current-change", 2);
    await flushPromises();
    expect(wrapper.find(".version-card__name").text()).toBe("鱼香肉丝");
    await wrapper.find(".version-card").trigger("click");
    expect(wrapper.text()).toContain("已选 2");

    const button = wrapper.findAll("button").find((item) => item.text().includes("导出所选版本"));
    await button!.trigger("click");
    expect(createCatalogExportRecord).not.toHaveBeenCalled();
    await wrapper.find('input[placeholder="请输入导出名称"]').setValue("十月菜谱");
    const start = wrapper.findAll("button").find((item) => item.text().includes("开始导出"));
    await start!.trigger("click");
    await flushPromises();
    expect(createCatalogExportRecord).toHaveBeenCalledWith({
      name: "十月菜谱",
      scope: "selected",
      revision_ids: [11, 22],
    });
    expect(wrapper.text()).toContain("等待开始");
    expect(saveAs).not.toHaveBeenCalled();
  });

  it("全选此页只补选当前页，翻页后保留此前选择", async () => {
    listCatalogVersions.mockImplementation(async (page: number) => ({
      items:
        page === 1 ? [version(11, "宫保鸡丁"), version(12, "麻婆豆腐")] : [version(22, "鱼香肉丝")],
      total: 9,
    }));
    getDictionary.mockResolvedValue([]);
    getVipLevelOptions.mockResolvedValue([]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    const selectPage = wrapper.findAll("button").find((item) => item.text().includes("全选此页"));
    await selectPage!.trigger("click");
    expect(wrapper.text()).toContain("已选 2");
    expect(selectPage!.attributes("disabled")).toBeDefined();

    const pager = wrapper.findComponent({ name: "ElPagination" });
    pager.vm.$emit("update:current-page", 2);
    pager.vm.$emit("current-change", 2);
    await flushPromises();
    await selectPage!.trigger("click");
    expect(wrapper.text()).toContain("已选 3");

    pager.vm.$emit("update:current-page", 1);
    pager.vm.$emit("current-change", 1);
    await flushPromises();
    expect(wrapper.findAll(".version-card.is-selected")).toHaveLength(2);
  });

  it("提交筛选后可全选跨页结果，输入但未查询时不可操作", async () => {
    listCatalogVersions.mockImplementation(
      async (_page: number, size: number, filters: { name?: string }) =>
        filters.name === "鱼"
          ? {
              items:
                size === 100
                  ? [version(11, "鱼香肉丝"), version(12, "酸菜鱼"), version(13, "清蒸鱼")]
                  : [version(11, "鱼香肉丝")],
              total: 3,
            }
          : { items: [version(99, "宫保鸡丁")], total: 1 }
    );
    getDictionary.mockResolvedValue([]);
    getVipLevelOptions.mockResolvedValue([]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    const selectFiltered = wrapper
      .findAll("button")
      .find((item) => item.text().includes("全选筛选结果"));
    expect(selectFiltered!.attributes("disabled")).toBeDefined();
    await wrapper.find('input[placeholder="输入菜谱名称"]').setValue("鱼");
    expect(selectFiltered!.attributes("disabled")).toBeDefined();
    const search = wrapper.findAll("button").find((item) => item.text() === "查询");
    await search!.trigger("click");
    await flushPromises();

    expect(selectFiltered!.attributes("disabled")).toBeUndefined();
    await selectFiltered!.trigger("click");
    await flushPromises();
    expect(listCatalogVersions).toHaveBeenLastCalledWith(
      1,
      100,
      expect.objectContaining({ name: "鱼" })
    );
    expect(wrapper.text()).toContain("已选 3");
  });

  it("筛选结果超过100个时分批查询并全选", async () => {
    listCatalogVersions.mockImplementation(async (page: number, size: number) => ({
      items:
        size === 100
          ? page === 1
            ? Array.from({ length: 100 }, (_, index) => version(index + 1, `菜谱${index + 1}`))
            : [version(101, "菜谱101")]
          : [version(1, "菜谱1")],
      total: 101,
    }));
    getDictionary.mockResolvedValue([]);
    getVipLevelOptions.mockResolvedValue([]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    await wrapper.find('input[placeholder="输入菜谱名称"]').setValue("鱼");
    const search = wrapper.findAll("button").find((item) => item.text() === "查询");
    await search!.trigger("click");
    await flushPromises();
    const selectFiltered = wrapper
      .findAll("button")
      .find((item) => item.text().includes("全选筛选结果"));
    await selectFiltered!.trigger("click");
    await flushPromises();

    expect(listCatalogVersions).toHaveBeenCalledWith(
      1,
      100,
      expect.objectContaining({ name: "鱼" })
    );
    expect(listCatalogVersions).toHaveBeenCalledWith(
      2,
      100,
      expect.objectContaining({ name: "鱼" })
    );
    expect(wrapper.text()).toContain("已选 101");
  });

  it("导出所有不依赖当前筛选和勾选，完成后可以重复下载", async () => {
    listCatalogVersions.mockResolvedValue({ items: [version(11, "鱼香肉丝")], total: 1 });
    createCatalogExportRecord.mockResolvedValue(exportRecord({ scope: "all", total_count: 448 }));
    downloadCatalogExportRecord.mockResolvedValue(new Blob(["encrypted-db"]));
    getDictionary.mockResolvedValue([]);
    getVipLevelOptions.mockResolvedValue([]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    const exportAll = wrapper.findAll("button").find((item) => item.text() === "导出所有");
    await exportAll!.trigger("click");
    await wrapper.find('input[placeholder="请输入导出名称"]').setValue("全量目录");
    const start = wrapper.findAll("button").find((item) => item.text().includes("开始导出"));
    await start!.trigger("click");
    await flushPromises();

    expect(createCatalogExportRecord).toHaveBeenCalledWith({
      name: "全量目录",
      scope: "all",
      revision_ids: undefined,
    });
    expect(downloadCatalogExportRecord).not.toHaveBeenCalled();

    const ready = exportRecord({
      name: "全量目录",
      scope: "all",
      status: "ready",
      stage: "ready",
      progress: 100,
      total_count: 448,
      processed_count: 448,
      exported_count: 440,
      skipped_count: 8,
      expires_time: "2026-10-23T08:00:00Z",
    });
    listCatalogExportRecords.mockResolvedValue({ items: [ready], total: 1 });
    getCatalogExportRecord.mockResolvedValue(ready);
    await wrapper
      .findAll("button")
      .find((item) => item.text().includes("刷新记录"))!
      .trigger("click");
    await flushPromises();
    const downloadButton = wrapper.findAll("button").find((item) => item.text() === "下载文件");
    await downloadButton!.trigger("click");
    await flushPromises();
    expect(downloadCatalogExportRecord).toHaveBeenCalledWith(5);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "全量目录.db");
  });

  it("把分类、菜系和可访问VIP等级交给服务端筛选", async () => {
    listCatalogVersions.mockResolvedValue({ items: [], total: 0 });
    getDictionary.mockResolvedValue([{ id: 46, name: "畜类" }]);
    getVipLevelOptions.mockResolvedValue([
      { id: 2, name: "V2", level_value: 2, is_default: false },
    ]);
    wrapper = mount(CatalogExportPage, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    const selects = wrapper.findAllComponents({ name: "ElSelect" });
    for (const [index, value] of [
      [0, 46],
      [1, 45],
      [2, 2],
    ] as const) {
      selects[index]!.vm.$emit("update:modelValue", value);
      selects[index]!.vm.$emit("change", value);
      await flushPromises();
    }
    expect(listCatalogVersions).toHaveBeenLastCalledWith(
      1,
      8,
      expect.objectContaining({
        category_id: 46,
        cuisine_id: 45,
        accessible_vip_level_id: 2,
      })
    );
  });
});

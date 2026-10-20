import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ElUpload, type UploadRawFile } from "element-plus";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/utils/http", () => ({ request }));

import FaFileUpload from "./index.vue";
import { createUploadFormData, uploadFile } from "./upload";

const image = () => new File(["image content"], "logo.PNG", { type: "image/png" });
const successResult = {
  file_id: 12,
  storage_key: "menu/unique.png",
  file_name: "unique.png",
  file_url: "https://example.test/unique.png",
  origin_name: "logo.PNG",
};

describe("统一文件上传", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: { data: successResult } });
  });

  it("同一图片每次生成不同路径，保留目录、扩展名和原始名称", () => {
    const file = image();
    const options = { directory: "menu/", data: { source_id: 9, empty: undefined } };
    const first = createUploadFormData(file, options);
    const second = createUploadFormData(file, options);
    expect(first.get("remote_path")).toMatch(/^menu\/[a-f0-9]{32}\.png$/);
    expect(second.get("remote_path")).not.toEqual(first.get("remote_path"));
    expect((first.get("file") as File).name).toBe("logo.PNG");
    expect(first.get("source_id")).toBe("9");
    expect(first.has("empty")).toBe(false);
  });

  it("根目录图片也生成唯一对象键", () => {
    expect(createUploadFormData(image()).get("remote_path")).toMatch(/^[a-f0-9]{32}\.png$/);
  });

  it("资源和通用接口通过 multipart 文件名实现图片重命名", () => {
    const options = { endpoint: "/monitor/resource/upload", data: { target_path: "images" } };
    const first = createUploadFormData(image(), options);
    const second = createUploadFormData(image(), options);
    const name = (first.get("file") as File).name;
    expect(name).toMatch(/^[a-f0-9]{32}\.png$/);
    expect((second.get("file") as File).name).not.toBe(name);
    expect(first.get("target_path")).toBe("images");
    expect(first.has("remote_path")).toBe(false);
  });

  it("非图片文件保留名称，上传到当前目录", () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    const data = createUploadFormData(file, { directory: "docs" });
    expect((data.get("file") as File).name).toBe("notes.txt");
    expect(data.get("remote_path")).toBe("docs/");
  });

  it("资源上传结果统一为文件信息，并保留原始展示名称", async () => {
    request.mockResolvedValue({
      data: { data: { filename: "random.png", file_url: "https://example.test/random.png" } },
    });
    const result = await uploadFile(image(), { endpoint: "/monitor/resource/upload" });
    expect(result).toMatchObject({
      file_name: "random.png",
      origin_name: "logo.PNG",
      file_url: "https://example.test/random.png",
    });
  });

  it("组件成功只发出一次结果，正确结束上传状态", async () => {
    const wrapper = mount(FaFileUpload, { props: { directory: "menu" } });
    const file = image();
    await wrapper.vm.upload(file);
    expect(request).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("uploaded")).toHaveLength(1);
    expect(wrapper.emitted("pendingChange")).toEqual([[1], [0]]);
    wrapper.unmount();
  });

  it("选择并提交文件时，原生成功回调只执行一次", async () => {
    const onSuccess = vi.fn();
    const wrapper = mount(FaFileUpload, { attrs: { autoUpload: false, onSuccess } });
    const file = image() as UploadRawFile;
    file.uid = 123;
    wrapper.vm.handleStart(file);
    wrapper.vm.submit();
    await flushPromises();
    expect(request).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("uploaded")).toHaveLength(1);
    wrapper.unmount();
  });

  it("上传失败不发成功事件，错误原样抛出且恢复上传状态", async () => {
    const error = new Error("上传失败");
    request.mockRejectedValue(error);
    const wrapper = mount(FaFileUpload);
    await expect(wrapper.vm.upload(image())).rejects.toBe(error);
    expect(wrapper.emitted("uploaded")).toBeUndefined();
    expect(wrapper.emitted("pendingChange")).toEqual([[1], [0]]);
    wrapper.unmount();
  });

  it("禁用组件无法发起手动上传", async () => {
    const wrapper = mount(FaFileUpload, { props: { disabled: true } });
    await expect(wrapper.vm.upload(image())).rejects.toThrow("当前不可上传");
    expect(request).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("透传文件列表、预览回调和插槽", () => {
    const preview = vi.fn();
    const files = [{ name: "old.png", url: "https://example.test/old.png" }];
    const wrapper = mount(FaFileUpload, {
      attrs: { fileList: files, onPreview: preview, listType: "picture-card" },
      slots: { default: "上传图片" },
    });
    const upload = wrapper.findComponent(ElUpload);
    expect(upload.props("fileList")).toEqual(files);
    expect(upload.props("onPreview")).toBe(preview);
    expect(wrapper.text()).toContain("上传图片");
    wrapper.unmount();
  });

  it("响应缺少URL或存储文件ID时明确报错", async () => {
    request.mockResolvedValueOnce({ data: { data: {} } });
    await expect(uploadFile(image())).rejects.toThrow("文件访问地址");
    request.mockResolvedValueOnce({
      data: { data: { file_url: "https://example.test/file.png" } },
    });
    await expect(uploadFile(image())).rejects.toThrow("文件ID");
  });
});

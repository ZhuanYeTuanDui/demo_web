import { request } from "@/utils/http";

export interface FileUploadOptions {
  endpoint?: string;
  directory?: string;
  name?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
}

export type FileUploadResult = UploadFilePath & { url?: string; alt?: string; href?: string };

/** 每次上传使用新的对象名；getRandomValues 在局域网 HTTP 中也可用。 */
function uniqueImageName(file: File): string {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
  return `${token}${extension}`;
}

/** 统一构造上传请求；只改图片的存储名，非图片文件保持原名。 */
export function createUploadFormData(file: File, options: FileUploadOptions = {}): FormData {
  const endpoint = options.endpoint ?? "/storage/file/upload";
  const storageUpload = /\/storage\/file\/upload(?:\?|$)/.test(endpoint);
  const image = file.type.startsWith("image/");
  const formData = new FormData();
  formData.append(
    options.name ?? "file",
    file,
    image && !storageUpload ? uniqueImageName(file) : file.name
  );
  for (const [key, value] of Object.entries(options.data ?? {})) {
    if (value !== null && value !== undefined) formData.append(key, String(value));
  }
  if (storageUpload) {
    const directory = options.directory ?? "";
    if (image) {
      // 存储接口支持完整对象键，因此无需更改 multipart 的原始文件名。
      formData.set(
        "remote_path",
        `${directory.replace(/\/+$/, "")}${directory ? "/" : ""}${uniqueImageName(file)}`
      );
    } else if (directory) {
      formData.set("remote_path", `${directory.replace(/\/+$/, "")}/`);
    }
  }
  return formData;
}

/** 组件、裁剪结果及富文本编辑器共用的上传能力。 */
export async function uploadFile(
  file: File,
  options: FileUploadOptions = {}
): Promise<FileUploadResult> {
  const response = await request<ApiResponse<Partial<FileUploadResult> & { filename?: string }>>({
    url: options.endpoint ?? "/storage/file/upload",
    method: "post",
    data: createUploadFormData(file, options),
    headers: { "Content-Type": "multipart/form-data" },
  });
  const result = response.data.data;
  const url = result?.preview_url || result?.file_url || result?.url;
  if (!result || !url) throw new Error("上传接口未返回文件访问地址");
  if (
    /\/storage\/file\/upload(?:\?|$)/.test(options.endpoint ?? "/storage/file/upload") &&
    !result.file_id
  ) {
    throw new Error("上传接口未返回文件ID");
  }
  return {
    ...result,
    file_path: result.file_path ?? result.storage_key ?? url,
    file_name: result.file_name ?? result.filename ?? file.name,
    origin_name: file.name,
    file_url: url,
    preview_url: result.preview_url || url,
  };
}

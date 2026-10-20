import { describe, expect, it } from "vitest";
import { buildFeedingCommandId, parseFeedingCommandId } from "@/config/recipeCommand";
import {
  allowedCommandTypes,
  servingSpeedOptions,
  stepCommandPresets,
} from "@/config/recipeStepPreset";
import {
  commandArgumentError,
  commandArgumentSpec,
  hasRecipeAdminAccess,
  makeRecipe,
  makeStep,
  publishErrors,
  type Definition,
} from "./recipeEditor";

const definitions: Definition[] = [
  {
    id: 1,
    command_id: 301099,
    name: "电磁炉99档",
    command_type: "HEAT",
    duration_ms: 0,
    enabled: true,
  },
  {
    id: 2,
    command_id: 500041,
    name: "料盒1超低速投料+接料",
    command_type: "MATERIAL_BOX",
    duration_ms: 0,
    enabled: true,
    box_no: 1,
  },
  {
    id: 3,
    command_id: 901110,
    name: "机械臂拨菜",
    command_type: "ROBOT",
    duration_ms: 0,
    enabled: true,
  },
  { id: 4, command_id: 200030, name: "出菜", command_type: "POT", duration_ms: 0, enabled: true },
];

describe("菜谱维护权限", () => {
  it("从登录用户信息识别管理员和超级管理员", () => {
    expect(hasRecipeAdminAccess({ is_superuser: true, roles: [] })).toBe(true);
    expect(hasRecipeAdminAccess({ roles: [{ code: "ADMIN", status: 0 }] })).toBe(true);
    expect(hasRecipeAdminAccess({ roles: [{ code: "SUPER_ADMIN", status: 0 }] })).toBe(true);
    expect(hasRecipeAdminAccess({ roles: [{ code: "ADMIN", status: 1 }] })).toBe(false);
    expect(hasRecipeAdminAccess({ roles: [{ code: "USER", status: 0 }] })).toBe(false);
    expect(hasRecipeAdminAccess({})).toBe(false);
  });
});

describe("菜谱设备规则", () => {
  it("解析并生成料盒投料命令", () => {
    expect(parseFeedingCommandId(500042)).toEqual({ receive: true, process: 3, boxNo: 2 });
    expect(buildFeedingCommandId(2, 3, true)).toBe(500042);
    expect(buildFeedingCommandId(1, 3, false)).toBe(500031);
  });

  it("为需要填值的基础指令生成参数规范", () => {
    const solid: Definition = {
      id: 9,
      command_id: 610000,
      name: "固体投料",
      command_type: "SOLID_SEASONING",
      duration_ms: 0,
      enabled: true,
    };
    expect(commandArgumentSpec(solid)).toEqual({
      min: 0.1,
      max: 40,
      step: 0.1,
      precision: 1,
      unit: "g",
    });
    expect(commandArgumentError(solid, {}, true)).toBe("该动作需要填写参数");
    expect(commandArgumentError(solid, { value: 12.5 }, true)).toBe("");
    expect(commandArgumentError(solid, { value: 41 }, true)).toContain("0.1～40g");
  });

  it("提供热锅和出菜步骤预设", () => {
    expect(stepCommandPresets("HEAT")).toEqual([
      { commandId: 300000, arguments: { value: 99 }, role: "heat_level" },
      { commandId: 100000, arguments: { value: 11 }, role: "heat_time" },
      { commandId: 810000, arguments: { value: 0 }, role: "heat_water" },
      { commandId: 710000, arguments: { value: 0 }, role: "heat_oil" },
    ]);
    expect(servingSpeedOptions).toEqual([
      { value: "NORMAL", label: "正常 / 高速", commandId: 200030 },
      { value: "SLOW", label: "低速", commandId: 200031 },
    ]);
  });

  it("按步骤限制附加指令分类", () => {
    const all = [
      "SYSTEM",
      "POT",
      "HEAT",
      "DISH_TRAY",
      "MATERIAL_BOX",
      "SOLID_SEASONING",
      "LIQUID_SEASONING",
      "WATER",
      "ROBOT",
    ];
    expect(allowedCommandTypes("FEED", all)).toEqual([
      "SYSTEM",
      "HEAT",
      "SOLID_SEASONING",
      "LIQUID_SEASONING",
      "WATER",
      "ROBOT",
    ]);
    expect(allowedCommandTypes("BRAISE", all)).toEqual(["SYSTEM", "HEAT"]);
    expect(allowedCommandTypes("SERVE", all)).toEqual([]);
    expect(allowedCommandTypes("CUSTOM", all)).toEqual(all);
  });

  it("接受首尾固定且包含投料和机械臂动作的流程", () => {
    const recipe = makeRecipe("测试菜谱", "TEST-1");
    const revision = recipe.revisions[0]!;
    revision.category_id = 1;
    revision.steps[0]!.commands.push({
      id: -10,
      step_id: revision.steps[0]!.id,
      command_definition_id: 1,
      command_order: 1,
      arguments: {},
      description: "",
    });
    const feed = makeStep(revision, "FEED", "倒入料盒1，翻炒", revision.boxes[0]!.id);
    feed.commands = [
      {
        id: -11,
        step_id: feed.id,
        command_definition_id: 2,
        command_order: 1,
        arguments: {},
        description: "",
      },
      {
        id: -12,
        step_id: feed.id,
        command_definition_id: 3,
        command_order: 2,
        arguments: {},
        description: "",
      },
    ];
    revision.steps.splice(1, 0, feed);
    revision.steps.at(-1)!.commands.push({
      id: -13,
      step_id: revision.steps.at(-1)!.id,
      command_definition_id: 4,
      command_order: 1,
      arguments: {},
      description: "",
    });

    expect(publishErrors(revision, definitions)).toEqual([]);
  });

  it("拒绝移动后的非法首尾流程", () => {
    const recipe = makeRecipe("测试菜谱", "TEST-2");
    const revision = recipe.revisions[0]!;
    revision.steps.reverse();

    const messages = publishErrors(revision, definitions).map((item) => item.message);

    expect(messages).toContain("第一步必须是热锅起油");
    expect(messages).toContain("最后一步必须是出菜");
  });
});

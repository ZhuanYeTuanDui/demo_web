import { isSupportedFeedingCommandId } from "@/config/recipeCommand";

/** 登录用户是否拥有跨创建人维护菜谱的管理员权限。 */
export function hasRecipeAdminAccess(user: {
  is_superuser?: boolean;
  roles?: { code?: string; status?: number }[];
}): boolean {
  return (
    user.is_superuser === true ||
    user.roles?.some(
      (role) => role.status === 0 && (role.code === "ADMIN" || role.code === "SUPER_ADMIN")
    ) === true
  );
}

/** 菜谱流程编辑模型，与后端版本聚合接口对应。 */
export interface Box {
  id: number;
  revision_id: number;
  box_no: number;
  content_text: string;
  remark: string;
  sort_order: number;
  /** 编辑条目：选中食材保存关联，手填内容只生成料盒说明。 */
  editor_ingredients?: { ingredient_id: number | null; name: string; quantity: string }[];
  ingredient_links?: {
    ingredient_id: number | null;
    name: string;
    quantity: string;
    sort_order: number;
  }[];
}
export interface StepCommand {
  id: number;
  step_id: number;
  command_definition_id: number;
  command_order: number;
  arguments: Record<string, unknown>;
  description: string;
}
export interface Step {
  id: number;
  revision_id: number;
  step_order: number;
  step_type: string;
  name: string;
  box_id: number | null;
  description: string;
  estimated_duration_ms: number | null;
  commands: StepCommand[];
  /** 仅用于编辑器暂存；保存时转换为预设指令 arguments/定义引用，不直接发送。 */
  editor_preset_values?: Partial<
    Record<"heat_level" | "heat_time" | "heat_water" | "heat_oil", number> & {
      serving_speed: "NORMAL" | "SLOW";
    }
  >;
}
export interface Revision {
  id: number;
  menu_id: number;
  revision_no: number;
  previous_revision_id: number | null;
  name: string;
  category_id: number;
  cuisine_id: number | null;
  author: string;
  description: string;
  portion_type: string;
  menu_segment: string;
  change_note: string;
  revision_status: number;
  created_by?: number | null;
  editor_creator_name?: string;
  boxes: Box[];
  steps: Step[];
  step_count?: number;
}
export interface Recipe {
  id: number;
  code: string;
  menu_type: number;
  owner_user_id: number | null;
  owner_user_name?: string;
  current_revision_id: number;
  published_revision_id: number | null;
  publish_status: number;
  featured?: boolean;
  base_price?: string | number;
  required_vip_level_id?: number | null;
  created_at?: string;
  updated_at?: string;
  revisions: Revision[];
  cover_file_id?: number | null;
  cover_url?: string;
  images?: RecipeImage[];
  remove_cover?: boolean;
  command_definitions?: Definition[];
}
export interface RecipeImage {
  id?: number;
  file_id: number | null;
  file_url: string;
  original_name: string;
  usage_type: string;
  sort_order: number;
  upload_uid?: number;
}
export interface Definition {
  id: number;
  command_id: number;
  name: string;
  command_type: string;
  duration_ms: number;
  enabled: boolean;
  box_no?: number;
  protocol_fields?: Record<string, unknown>;
}
export interface CommandArgumentSpec {
  min: number;
  max: number;
  step: number;
  precision: number;
  unit: string;
}
let sequence = 0;
export const nextId = () => --sequence;
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** 只在加载编辑副本时解析已有展示文本，避免浏览步骤引起未保存状态。 */
export function initializeIngredients(box: Box, forceRows = false) {
  if (box.editor_ingredients) return;
  const rows = (box.content_text || "")
    .split(/[，,]/)
    .filter(Boolean)
    .map((text) => {
      const colon = text.indexOf("：");
      const match = text.trim().match(/^(.*?)(\d.*)$/);
      return {
        ingredient_id: null as number | null,
        name: colon >= 0 ? text.slice(0, colon).trim() : match ? match[1]!.trim() : text.trim(),
        quantity: colon >= 0 ? text.slice(colon + 1).trim() : match ? match[2]!.trim() : "",
      };
    });
  if (!forceRows && rows.length && !box.ingredient_links?.length) return;
  for (const link of box.ingredient_links || [])
    rows[link.sort_order] = {
      ingredient_id: link.ingredient_id,
      name: link.name,
      quantity: link.quantity,
    };
  box.editor_ingredients = rows;
}
export const stepTypes = [
  { value: "HEAT", label: "热锅 / 加热" },
  { value: "FEED", label: "料盒投料" },
  { value: "BRAISE", label: "焖锅" },
  { value: "BLANCH_PREPARE", label: "焯笼预置" },
  { value: "BLANCH_SERVE", label: "焯笼出菜" },
  { value: "BLANCH_RETURN", label: "焯笼回锅" },
  { value: "ROBOT", label: "无投料机械臂" },
  { value: "SERVE", label: "出菜" },
  { value: "CUSTOM", label: "自定义步骤" },
];
export const repeatableStepTypes = new Set(["FEED", "BRAISE", "ROBOT", "CUSTOM"]);
export const fixedStepTypes = new Set(["HEAT", "SERVE"]);
export const normalizeStepType = (value: string) => (value === "WAIT" ? "BRAISE" : value);
export function commandArgumentSpec(definition?: Definition): CommandArgumentSpec | null {
  if (!definition) return null;
  const { command_id: commandId, command_type: commandType } = definition;
  if (commandType === "SOLID_SEASONING" && commandId % 1000 === 0)
    return { min: 0.1, max: 40, step: 0.1, precision: 1, unit: "g" };
  if (commandType === "LIQUID_SEASONING" && commandId % 1000 === 0)
    return { min: 0, max: 999, step: 1, precision: 0, unit: "ml" };
  if (commandType === "WATER" && commandId % 10000 === 0)
    return { min: 0, max: 3000, step: 1, precision: 0, unit: "ml" };
  if (commandType === "SYSTEM" && commandId < 110000 && commandId % 10000 === 0)
    return { min: 1, max: 999, step: 1, precision: 0, unit: "秒" };
  if (commandType === "HEAT" && commandId < 301000)
    return { min: 1, max: 99, step: 1, precision: 0, unit: "档" };
  return null;
}

export function commandArgumentError(
  definition: Definition,
  argumentsValue: Record<string, unknown>,
  required: boolean
) {
  const spec = commandArgumentSpec(definition);
  const keys = Object.keys(argumentsValue || {});
  if (!spec) return keys.length ? "该动作不支持填写参数" : "";
  if (!keys.length) return required ? "该动作需要填写参数" : "";
  if (keys.length !== 1 || keys[0] !== "value") return "动作参数格式不正确";
  const value = argumentsValue.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return "动作参数必须是数字";
  if (spec.precision === 0 && !Number.isInteger(value)) return "该动作参数必须是整数";
  if (value < spec.min || value > spec.max)
    return `动作参数必须在 ${spec.min}～${spec.max}${spec.unit} 之间`;
  return "";
}
export function current(recipe: Recipe): Revision {
  return recipe.revisions.find((r) => r.id === recipe.current_revision_id)!;
}
export function makeStep(
  revision: Revision,
  type: string,
  name: string,
  boxId: number | null = null
): Step {
  return {
    id: nextId(),
    revision_id: revision.id,
    step_order: revision.steps.length + 1,
    step_type: type,
    name,
    box_id: boxId,
    description: "",
    estimated_duration_ms: null,
    commands: [],
  };
}
export function makeCommand(step: Step, definitionId: number): StepCommand {
  return {
    id: nextId(),
    step_id: step.id,
    command_definition_id: definitionId,
    command_order: step.commands.length + 1,
    arguments: {},
    description: "",
  };
}
export function normalize(revision: Revision) {
  revision.steps.forEach((step, i) => {
    step.step_order = i + 1;
    step.commands.forEach((cmd, j) => (cmd.command_order = j + 1));
  });
}
export function makeRecipe(name: string, code: string): Recipe {
  const id = nextId(),
    revisionId = nextId();
  const revision: Revision = {
    id: revisionId,
    menu_id: id,
    revision_no: 1,
    previous_revision_id: null,
    name,
    category_id: 1,
    cuisine_id: 1,
    author: "",
    description: "",
    portion_type: "STANDARD",
    menu_segment: "regular",
    change_note: "",
    revision_status: 0,
    boxes: [],
    steps: [],
  };
  revision.boxes = Array.from({ length: 6 }, (_, i) => ({
    id: nextId(),
    revision_id: revisionId,
    box_no: i + 1,
    content_text: "",
    remark: "",
    sort_order: i,
  }));
  revision.steps = [makeStep(revision, "HEAT", "热锅起油"), makeStep(revision, "SERVE", "出菜")];
  normalize(revision);
  return {
    id,
    code,
    menu_type: 1,
    owner_user_id: null,
    current_revision_id: revisionId,
    published_revision_id: null,
    publish_status: 0,
    revisions: [revision],
  };
}
export function publishErrors(
  revision: Revision,
  definitions: Definition[]
): { stepId: number | null; message: string }[] {
  const errors: { stepId: number | null; message: string }[] = [];
  if (!revision.name.trim() || !revision.category_id)
    errors.push({ stepId: null, message: "请填写菜谱名称和分类" });
  if (!revision.steps.length) errors.push({ stepId: null, message: "至少添加一个步骤" });
  const types = revision.steps.map((step) => normalizeStepType(step.step_type));
  if (types.length && types[0] !== "HEAT")
    errors.push({ stepId: revision.steps[0]?.id || null, message: "第一步必须是热锅起油" });
  if (types.length && types.at(-1) !== "SERVE")
    errors.push({ stepId: revision.steps.at(-1)?.id || null, message: "最后一步必须是出菜" });
  for (const type of ["HEAT", "BLANCH_PREPARE", "BLANCH_SERVE", "BLANCH_RETURN", "SERVE"])
    if (types.filter((value) => value === type).length > 1)
      errors.push({
        stepId: null,
        message: `${stepTypes.find((item) => item.value === type)?.label || type}不能重复`,
      });
  if (!types.includes("FEED")) errors.push({ stepId: null, message: "至少要有一个料盒投料步骤" });

  const blanchTypes = ["BLANCH_PREPARE", "BLANCH_SERVE", "BLANCH_RETURN"];
  const blanchPositions = blanchTypes.map((type) => types.indexOf(type));
  if (blanchPositions.some((position) => position >= 0)) {
    if (blanchPositions.some((position) => position < 0))
      errors.push({ stepId: null, message: "焯笼预置、焯笼出菜、焯笼回锅必须同时存在" });
    else if (
      blanchPositions.some((position, index) => index > 0 && position < blanchPositions[index - 1]!)
    )
      errors.push({ stepId: null, message: "焯笼步骤顺序必须为焯笼预置、焯笼出菜、焯笼回锅" });
    else if (!types.slice(0, blanchPositions[1]).includes("FEED"))
      errors.push({
        stepId: revision.steps[blanchPositions[1]!]?.id || null,
        message: "必须先完成主料投放才能进行焯笼出菜",
      });
  }

  const usedBoxes = new Set<number>();
  let hasRobotCommand = false;
  let previousSolidKey: number | null = null;
  let previousWasInduction = false;
  const exclusiveSolidTypes = new Set<number>();
  revision.steps.forEach((step) => {
    const fail = (message: string) =>
      errors.push({
        stepId: step.id,
        message: `第 ${step.step_order} 步「${step.name}」：${message}`,
      });
    if (!step.name.trim()) fail("步骤名称不能为空");
    if (!step.commands.length) fail("至少添加一个动作");
    const box = revision.boxes.find((b) => b.id === step.box_id);
    if (step.box_id !== null) {
      if (!box || box.revision_id !== revision.id) fail("料盒不属于当前版本");
      if (usedBoxes.has(step.box_id)) fail("料盒重复绑定");
      usedBoxes.add(step.box_id);
    }
    const stepType = normalizeStepType(step.step_type);
    const index = revision.steps.indexOf(step);
    const previousType = index > 0 ? normalizeStepType(revision.steps[index - 1]!.step_type) : "";
    const nextType =
      index + 1 < revision.steps.length
        ? normalizeStepType(revision.steps[index + 1]!.step_type)
        : "";
    if (stepType === "BRAISE" && ["HEAT", "BLANCH_SERVE"].includes(previousType))
      fail("热锅起油或焯笼出菜后不能立即放置锅盖");
    if (["BRAISE", "ROBOT"].includes(stepType) && previousType === stepType)
      fail("焖锅或无投料机械臂步骤不能连续排列");
    if (stepType === "ROBOT" && (previousType === "FEED" || nextType === "FEED"))
      fail("无投料机械臂步骤不能与料盒投料步骤相邻");

    const materialCommands = step.commands.filter(
      (cmd) =>
        definitions.find((item) => item.id === cmd.command_definition_id)?.command_type ===
        "MATERIAL_BOX"
    );
    if (stepType === "FEED") {
      if (step.box_id === null) fail("料盒投料步骤必须绑定料盒");
      if (materialCommands.length !== 1) fail("必须且只能包含一个料盒主投料动作");
    }
    const liquidTypes = new Map<number, Set<number>>();
    if (["BRAISE", ...blanchTypes].includes(stepType)) previousWasInduction = false;
    step.commands.forEach((cmd) => {
      const def = definitions.find((d) => d.id === cmd.command_definition_id);
      if (!def?.enabled) fail("包含不存在或已停用的动作");
      if (def?.box_no && box?.box_no !== def.box_no) fail("料盒投料动作与绑定料盒不一致");
      if (!def) return;
      const argumentError = commandArgumentError(def, cmd.arguments, true);
      if (argumentError) fail(`${def.name}：${argumentError}`);
      const commandId = def.command_id;
      hasRobotCommand ||= def.command_type === "ROBOT";
      if (def.command_type === "MATERIAL_BOX") {
        const commandBox = commandId % 10;
        if (!isSupportedFeedingCommandId(commandId)) fail(`包含无效的料盒投料动作 ${commandId}`);
        if (stepType === "FEED" && box && commandBox !== box.box_no)
          fail("主投料动作与绑定料盒不一致");
      }
      if (def.command_type === "WATER") {
        const amount = commandId % 10000;
        if (amount > 3000) fail("单次供水必须在 1～3000ml 之间");
      }
      if (def.command_type === "SOLID_SEASONING") {
        const solidKey = Math.floor(commandId / 1000) * 1000;
        if (previousSolidKey === solidKey) fail("相同固体投料不能连续投放");
        previousSolidKey = solidKey;
        if (solidKey >= 630000 && solidKey < 633000) exclusiveSolidTypes.add(solidKey);
      } else previousSolidKey = null;
      if (def.command_type === "LIQUID_SEASONING") {
        const position = Math.floor(commandId / 10000) % 10;
        const liquidType = Math.floor((commandId % 10000) / 1000);
        const values = liquidTypes.get(position) || new Set<number>();
        values.add(liquidType);
        liquidTypes.set(position, values);
      }
      const induction = commandId >= 301000 && commandId <= 301099;
      if (induction && previousWasInduction) fail("检测到相邻的电磁炉动作，请调整动作顺序");
      previousWasInduction = induction;
    });
    if ([...liquidTypes.values()].some((values) => values.size > 1))
      fail("同一液体通道只能选择一种物料");
  });
  if (!hasRobotCommand) errors.push({ stepId: null, message: "菜谱应至少包含一个机械臂动作" });
  if (exclusiveSolidTypes.size > 1)
    errors.push({ stepId: null, message: "鸡精、胡椒粉、花椒粉只能选择其中一种" });
  return errors;
}

export function mainFeedingDefinition(step: Step, definitions: Definition[]) {
  return step.commands
    .map((command) =>
      definitions.find((definition) => definition.id === command.command_definition_id)
    )
    .find((definition) => definition?.command_type === "MATERIAL_BOX");
}

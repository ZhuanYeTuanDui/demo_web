/**
 * 菜谱编辑器使用的设备指令编码配置。
 *
 * 当前值来自 ccj_command_definition；后续协议调整只修改本文件，页面不得散落 CMD 数字。
 */
export const MATERIAL_BOX_COMMAND_PREFIX = 500000;

export const feedingProcessOptions = [
  { value: 1, label: "常速", commandCode: 1 },
  { value: 2, label: "低速", commandCode: 2 },
  { value: 3, label: "超低速", commandCode: 3 },
] as const;

export type FeedingProcess = (typeof feedingProcessOptions)[number]["value"];

export const DEFAULT_FEEDING_PROCESS: FeedingProcess = 1;
export const RECEIVE_FEEDING_COMMAND_CODE = 4;

export interface FeedingCommandState {
  receive: boolean;
  process: FeedingProcess;
  boxNo: number;
}

/** 解析 50001x～50004x 主投料 CMD。接料档固定对应超低速接料。 */
export function parseFeedingCommandId(commandId: number): FeedingCommandState {
  const commandCode = Math.floor(commandId / 10) % 10;
  const receive = commandCode === RECEIVE_FEEDING_COMMAND_CODE;
  const configured = feedingProcessOptions.find((item) => item.commandCode === commandCode);
  return {
    receive,
    process: receive ? 3 : configured?.value || DEFAULT_FEEDING_PROCESS,
    boxNo: commandId % 10,
  };
}

/** 根据料盒、工艺和接料状态生成要查询的既有 CMD 编号。 */
export function buildFeedingCommandId(boxNo: number, process: FeedingProcess, receive: boolean) {
  const processConfig = feedingProcessOptions.find((item) => item.value === process);
  const commandCode = receive
    ? RECEIVE_FEEDING_COMMAND_CODE
    : processConfig?.commandCode || DEFAULT_FEEDING_PROCESS;
  return MATERIAL_BOX_COMMAND_PREFIX + commandCode * 10 + boxNo;
}

export function isSupportedFeedingCommandId(commandId: number) {
  const state = parseFeedingCommandId(commandId);
  const commandCode = Math.floor(commandId / 10) % 10;
  return (
    Math.floor(commandId / 1000) === Math.floor(MATERIAL_BOX_COMMAND_PREFIX / 1000) &&
    state.boxNo >= 1 &&
    state.boxNo <= 6 &&
    (feedingProcessOptions.some((item) => item.commandCode === commandCode) ||
      commandCode === RECEIVE_FEEDING_COMMAND_CODE)
  );
}

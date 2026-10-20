<template>
  <div
    v-loading="loading || busy"
    class="domain-page recipe-page"
    :class="{ 'recipe-page--editing': editing && revision }"
  >
    <ElAlert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon
      ><ElButton link type="primary" @click="loadRecipes">重新加载</ElButton></ElAlert
    >
    <template v-if="!editing">
      <FaManagementList
        v-model:page="page"
        v-model:page-size="pageSize"
        v-model:columns="recipeColumns"
        embedded
        :rows="filteredRecipes as unknown as ManagementRow[]"
        :loading="loading"
        :total="total"
        :page-sizes="pageSizeOptions"
        :show-selection="false"
        :show-batch-delete="false"
        :show-create="Boolean(loginId)"
        create-label="新增菜谱"
        empty-text="暂无菜谱"
        @search="loadRecipes"
        @reset="resetRecipeSearch"
        @refresh="loadRecipes"
        @page-change="loadRecipes"
        @create="openInfo(true)"
      >
        <template #filters="{ search: submitSearch }">
          <ElFormItem label="菜谱名称">
            <ElInput
              v-model="search"
              class="search"
              placeholder="搜索菜谱名称或编码"
              clearable
              :prefix-icon="Search"
              @keyup.enter="submitSearch"
              @clear="submitSearch"
            />
          </ElFormItem>
          <ElFormItem label="作者">
            <ElSelect
              v-model="creatorFilter"
              class="creator-filter"
              filterable
              allow-create
              default-first-option
              clearable
              placeholder="选择或输入作者姓名"
              no-match-text="未找到匹配作者"
              @clear="submitSearch"
            >
              <ElOption
                v-for="creator in creatorOptions"
                :key="creator.id"
                :label="creatorLabel(creator)"
                :value="creator.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="菜品分类">
            <ElSelect
              v-model="categoryFilter"
              clearable
              placeholder="全部分类"
              @change="submitSearch"
            >
              <ElOption
                v-for="item in categories"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="菜系">
            <ElSelect
              v-model="cuisineFilter"
              clearable
              placeholder="全部菜系"
              @change="submitSearch"
            >
              <ElOption
                v-for="item in cuisines"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="可访问 VIP 等级">
            <ElSelect
              v-model="vipLevelFilter"
              clearable
              placeholder="全部等级"
              @change="submitSearch"
            >
              <ElOption
                v-for="item in vipOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
        </template>

        <template #table-toolbar-right>
          <ElButtonGroup>
            <ElTooltip content="表格视图" placement="top">
              <ElButton
                :type="viewMode === 'table' ? 'primary' : 'default'"
                :icon="List"
                aria-label="切换到表格视图"
                @click="switchView('table')"
              />
            </ElTooltip>
            <ElTooltip content="卡片视图" placement="top">
              <ElButton
                :type="viewMode === 'card' ? 'primary' : 'default'"
                :icon="Grid"
                aria-label="切换到卡片视图"
                @click="switchView('card')"
              />
            </ElTooltip>
          </ElButtonGroup>
        </template>

        <template #content="{ tableSize, stripe, border, highlightCurrentRow, headerCellStyle }">
          <ElTable
            v-if="viewMode === 'table'"
            :data="filteredRecipes"
            :size="tableSize"
            :stripe="stripe"
            :border="border"
            :highlight-current-row="highlightCurrentRow"
            :header-cell-style="headerCellStyle"
          >
            <ElTableColumn
              v-for="column in visibleRecipeColumns"
              :key="column.prop"
              :label="column.label"
              :width="column.width"
              :min-width="column.minWidth"
              :align="column.align"
            >
              <template #default="{ row }">
                <template v-if="column.prop === 'name'">
                  <strong>{{ current(row as Recipe).name }}</strong>
                  <div class="muted">{{ row.code }}</div>
                </template>
                <ElTag
                  v-else-if="column.prop === 'type'"
                  :type="row.menu_type === 1 ? 'success' : 'warning'"
                >
                  {{ row.menu_type === 1 ? "官方" : "私人" }}
                </ElTag>
                <template v-else-if="column.prop === 'owner'">
                  {{
                    row.menu_type === 1
                      ? "全部客户"
                      : row.owner_user_name || `用户 #${row.owner_user_id}`
                  }}
                </template>
                <template v-else-if="column.prop === 'price'"
                  >¥ {{ formatPrice(row.base_price) }}</template
                >
                <ElTag
                  v-else-if="column.prop === 'featured'"
                  :type="row.featured ? 'success' : 'info'"
                >
                  {{ row.featured ? "是" : "否" }}
                </ElTag>
                <template v-else-if="column.prop === 'created_at'">
                  {{ formatDateTime(row.created_at) }}
                </template>
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <FaTableActions :actions="recipeRowActions(row as Recipe)" />
              </template>
            </ElTableColumn>
          </ElTable>
          <div v-else class="recipe-card-grid">
            <button
              v-for="recipe in filteredRecipes"
              :key="recipe.id"
              type="button"
              class="recipe-card"
              @click="openGallery(recipe)"
            >
              <ElImage
                v-if="recipe.cover_url"
                :src="recipe.cover_url"
                fit="cover"
                class="recipe-card__image"
              />
              <div v-else class="recipe-card__fallback">
                <ElIcon><Picture /></ElIcon>
                <span>暂无图片</span>
              </div>
              <strong>{{ current(recipe).name }}</strong>
            </button>
          </div>
        </template>
      </FaManagementList>
    </template>
    <ElDialog
      v-if="versionRecipe"
      v-model="versionDialogOpen"
      title="版本管理"
      width="min(960px, calc(100vw - 32px))"
      destroy-on-close
      :close-on-click-modal="false"
      @closed="closeVersionDialog"
    >
      <div class="version-dialog__header">
        <div>
          <strong>{{ current(versionRecipe).name }}</strong>
          <span>{{ versionRecipe.code }}</span>
          <small>版本号由系统自动递增，用于区分同一道菜谱的不同修订。</small>
        </div>
        <ElButton
          v-if="canManageRecipe(versionRecipe)"
          type="primary"
          :icon="Plus"
          @click="newDraft(versionRecipe)"
        >
          创建新草稿
        </ElButton>
      </div>
      <ElTable
        :data="versionRecipe.revisions"
        stripe
        max-height="480"
        :row-style="{ height: '56px' }"
      >
        <ElTableColumn label="版本号" width="100">
          <template #default="{ row }">#{{ row.revision_no }}</template>
        </ElTableColumn>
        <ElTableColumn prop="name" label="名称" min-width="160" show-overflow-tooltip />
        <ElTableColumn label="状态" width="100" align="center">
          <template #default="{ row }">
            <ElTag :type="statusType(row.revision_status)">{{
              statusLabel(row.revision_status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="流程" width="90">
          <template #default="{ row }">{{ row.steps.length }} 步</template>
        </ElTableColumn>
        <ElTableColumn label="创建人" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.editor_creator_name || "未知创建人" }}</template>
        </ElTableColumn>
        <ElTableColumn prop="change_note" label="修订说明" min-width="150" show-overflow-tooltip />
        <ElTableColumn label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <FaTableActions :actions="versionRowActions(versionRecipe, row as Revision)" />
          </template>
        </ElTableColumn>
      </ElTable>
      <template #footer>
        <ElButton @click="versionDialogOpen = false">关闭</ElButton>
      </template>
    </ElDialog>
    <FaDialog
      v-if="galleryRecipe"
      v-model="galleryOpen"
      :title="galleryRecipeName"
      width="min(1000px, calc(100vw - 32px))"
      :draggable="false"
      :close-on-click-modal="false"
      @closed="closeGallery"
    >
      <div class="gallery-main">
        <div class="gallery-preview">
          <ElImage
            v-if="galleryImageUrl"
            :src="galleryImageUrl"
            fit="contain"
            class="gallery-preview__image"
          />
          <div v-else class="gallery-preview__fallback">
            <ElIcon><Picture /></ElIcon>
            <span>暂无图片</span>
          </div>
          <template v-if="galleryImages.length > 1">
            <ElButton
              class="gallery-preview__arrow is-left"
              circle
              :icon="ArrowLeft"
              aria-label="上一张图片"
              @click="previousGalleryImage"
            />
            <ElButton
              class="gallery-preview__arrow is-right"
              circle
              :icon="ArrowRight"
              aria-label="下一张图片"
              @click="nextGalleryImage"
            />
          </template>
          <span class="gallery-preview__counter">
            {{
              galleryImages.length ? `${galleryImageIndex + 1} / ${galleryImages.length}` : "默认图"
            }}
          </span>
        </div>

        <div class="gallery-boxes">
          <div class="gallery-section-title">绑定料盒</div>
          <ElTable
            :data="galleryBoundBoxes"
            stripe
            max-height="300"
            empty-text="当前版本未绑定料盒"
          >
            <ElTableColumn prop="box_no" label="料盒" width="72" align="center">
              <template #default="{ row }">{{ row.box_no }} 号</template>
            </ElTableColumn>
            <ElTableColumn prop="step_name" label="步骤" min-width="110" show-overflow-tooltip />
            <ElTableColumn
              prop="content_text"
              label="食材和用量"
              min-width="190"
              show-overflow-tooltip
            />
          </ElTable>
        </div>
      </div>

      <div class="gallery-version-row">
        <span>选择版本</span>
        <ElSelect v-model="galleryRevisionId" placeholder="请选择版本">
          <ElOption
            v-for="item in galleryRecipe.revisions"
            :key="item.id"
            :label="`版本 #${item.revision_no} · ${statusLabel(item.revision_status)}`"
            :value="item.id"
          />
        </ElSelect>
      </div>

      <div v-if="galleryRevision" class="gallery-version-summary">
        <div>
          <span>版本状态</span
          ><ElTag :type="statusType(galleryRevision.revision_status)">{{
            statusLabel(galleryRevision.revision_status)
          }}</ElTag>
        </div>
        <div>
          <span>创建人</span
          ><strong>{{ galleryRevision.editor_creator_name || "未知创建人" }}</strong>
        </div>
        <div>
          <span>流程</span><strong>{{ galleryRevision.steps.length }} 步</strong>
        </div>
      </div>

      <div v-if="galleryRevision" class="gallery-actions">
        <ElButton
          v-for="action in galleryVersionActions"
          :key="action.key"
          :type="
            action.key === 'publish' ? 'primary' : action.type === 'danger' ? 'danger' : 'default'
          "
          :plain="action.key !== 'publish'"
          :disabled="action.disabled"
          @click="action.onClick"
        >
          {{ action.label }}
        </ElButton>
        <ElButton :icon="Close" @click="galleryOpen = false">关闭</ElButton>
      </div>
    </FaDialog>
    <template v-if="editing && revision">
      <div class="g-card editor-header">
        <div class="editor-header__main">
          <ElButton class="editor-header__back" :icon="ArrowLeft" @click="requestLeave('versions')">
            返回版本列表
          </ElButton>
          <div class="editor-header__title">
            <strong>{{ revision.name }}</strong>
            <ElTag :type="statusType(revision.revision_status)">
              {{ statusLabel(revision.revision_status) }}{{ readonly ? " · 只读" : "" }}
            </ElTag>
          </div>
          <div class="editor-header__meta">
            {{ editing.code }} · 版本 #{{ revision.revision_no }} ·
            {{ dirty ? "有未保存修改" : "已保存" }}
          </div>
          <div v-if="readonly" class="editor-header__notice">
            {{
              revision.revision_status === 1
                ? "已发布版本不能直接修改，请复制为草稿后编辑。"
                : "当前账号不是该版本创建人，只能查看。"
            }}
          </div>
        </div>
        <div class="editor-header__actions">
          <ElButton @click="openInfo(false)">基本信息</ElButton>
          <ElButton @click="boxesOpen = true">料盒说明</ElButton>
          <ElButton
            v-if="revision.revision_status === 1 && canManageRevision(revision)"
            type="primary"
            plain
            @click="newDraft(editing, revision.id)"
          >
            复制为草稿编辑
          </ElButton>
          <template v-if="!readonly">
            <ElButton :loading="busy" @click="saveDraft">保存修改</ElButton>
            <ElButton type="primary" :loading="busy" @click="preparePublish">发布</ElButton>
          </template>
          <ElButton :icon="Close" :disabled="busy" @click="requestLeave('list')">关闭</ElButton>
        </div>
      </div>
      <div class="workspace">
        <ElCard shadow="never" class="flow-panel">
          <template #header
            ><div class="toolbar compact">
              <strong>烹饪主流程</strong
              ><ElButton :disabled="readonly" link type="primary" :icon="Plus" @click="openStep"
                >添加步骤</ElButton
              >
            </div></template
          >
          <p class="muted">拖动手柄排序，也可使用上下移按钮</p>
          <VueDraggable
            v-model="revision.steps"
            handle=".step-handle"
            :disabled="readonly"
            :animation="180"
            @end="normalizeStepOrder"
          >
            <div
              v-for="(step, index) in revision.steps"
              :key="step.id"
              class="flow-item"
              :class="{ selected: step.id === selectedId }"
            >
              <div
                class="step-order-zone"
                :class="{ 'step-handle': !isFixedStep(step) && !readonly }"
                :title="!isFixedStep(step) && !readonly ? '按住左侧区域拖动排序' : undefined"
              >
                <div v-if="!isFixedStep(step)" class="step-drag-target">
                  <ElIcon aria-hidden="true"><Rank /></ElIcon><span>排序</span>
                </div>
                <span v-else class="step-fixed">固定</span>
                <span class="number">{{ index + 1 }}</span>
                <div class="step-order-actions" @mousedown.stop @pointerdown.stop @touchstart.stop>
                  <ElButton
                    link
                    :disabled="readonly || !canMoveStep(index, -1)"
                    :icon="ArrowUp"
                    aria-label="上移步骤"
                    @click="moveStep(index, -1)"
                  /><ElButton
                    link
                    :disabled="readonly || !canMoveStep(index, 1)"
                    :icon="ArrowDown"
                    aria-label="下移步骤"
                    @click="moveStep(index, 1)"
                  />
                </div>
              </div>
              <div class="step-select-zone">
                <button
                  class="step-select"
                  :aria-pressed="step.id === selectedId"
                  @click="selectedId = step.id"
                >
                  <span
                    ><strong>{{ step.name || "未命名步骤" }}</strong
                    ><small
                      >{{ step.commands.length }} 个动作{{
                        step.box_id ? " · 料盒 " + boxNo(step.box_id) : ""
                      }}</small
                    ></span
                  >
                </button>
                <ElButton
                  class="step-delete"
                  link
                  type="danger"
                  :disabled="readonly || isFixedStep(step)"
                  :icon="Delete"
                  aria-label="删除步骤"
                  @click="deleteStep(step)"
                />
              </div>
            </div>
          </VueDraggable>
          <ElEmpty
            v-if="!revision.steps.length"
            description="点击添加步骤，开始编排流程"
            :image-size="70"
          />
        </ElCard>
        <ElCard shadow="never" class="detail-panel">
          <template v-if="activeStep">
            <div class="toolbar">
              <div>
                <div class="muted">
                  步骤 {{ activeStep.step_order }} / {{ revision.steps.length }}
                </div>
                <h3>{{ activeStep.name || "未命名步骤" }}</h3>
              </div>
              <ElTag>{{ typeLabel(activeStep.step_type) }}</ElTag>
            </div>
            <HeatStepCard
              v-if="activeStepType === 'HEAT'"
              :step="activeStep"
              :readonly="readonly"
              :type-label="typeLabel(activeStep.step_type)"
              :update-step="updateActiveStep"
              :values="activeHeatValues"
              @parameter-change="onHeatParameterChange"
            />
            <FeedStepCard
              v-else-if="activeStepType === 'FEED'"
              :step="activeStep"
              :box="activeBox"
              :boxes="revision.boxes"
              :readonly="readonly"
              :type-label="typeLabel(activeStep.step_type)"
              :feeding-state="activeFeedingState"
              :has-main-command="!!activeMainFeedingDefinition"
              :command-updating="feedCommandUpdating"
              :show-errors="boxErrors"
              :box-disabled="isBoxBoundToOtherStep"
              :update-step="updateActiveStep"
              @update:box-id="onActiveBoxIdChange"
              @process-change="onFeedingProcessChange"
              @receive-change="onReceiveChange"
              @box-change="updateBox"
            />
            <ProcessStepCard
              v-else-if="['BRAISE', 'ROBOT', 'CUSTOM'].includes(activeStepType)"
              :step="activeStep"
              :readonly="readonly"
              :type-label="typeLabel(activeStep.step_type)"
              :title="stepCardCopy.title"
              :description="stepCardCopy.description"
              :update-step="updateActiveStep"
            />
            <ServeStepCard
              v-else-if="['BLANCH_SERVE', 'SERVE'].includes(activeStepType)"
              :step="activeStep"
              :readonly="readonly"
              :type-label="typeLabel(activeStep.step_type)"
              :title="stepCardCopy.title"
              :description="stepCardCopy.description"
              :update-step="updateActiveStep"
              :speed="activeServingSpeed"
              :speed-updating="servingSpeedUpdating"
              @speed-change="onServingSpeedChange"
            />
            <FixedStepCard
              v-else
              :step="activeStep"
              :readonly="readonly"
              :type-label="typeLabel(activeStep.step_type)"
              :title="stepCardCopy.title"
              :description="stepCardCopy.description"
              :update-step="updateActiveStep"
            />
            <ElDivider />
            <div class="toolbar">
              <div>
                <h3>执行动作</h3>
                <div class="muted">
                  {{ additionalCommands.length }} 个附加动作 · 预计 {{ commandDuration }} 秒
                </div>
              </div>
              <ElButton
                v-if="allowedCommandTypeOptions.length"
                type="primary"
                :disabled="readonly"
                :icon="Plus"
                @click="openCommand()"
                >添加动作</ElButton
              >
            </div>
            <VueDraggable
              v-model="additionalCommands"
              handle=".command-handle"
              :disabled="readonly"
              :animation="180"
              @end="normalize(revision)"
            >
              <div
                v-for="(command, index) in additionalCommands"
                :key="command.id"
                class="command-row"
              >
                <ElIcon class="command-handle" aria-hidden="true"><Rank /></ElIcon
                ><span class="number">{{ index + 1 }}</span>
                <div class="command-content">
                  <strong>{{
                    definition(command.command_definition_id)?.name || "未知动作"
                  }}</strong>
                  <div class="muted">
                    {{ commandTypeLabel(definition(command.command_definition_id)?.command_type) }}
                    · 动作编号 {{ definition(command.command_definition_id)?.command_id }} ·
                    {{ (definition(command.command_definition_id)?.duration_ms || 0) / 1000 }} 秒
                  </div>
                  <div v-if="command.description">{{ command.description }}</div>
                </div>
                <div
                  v-if="command.arguments.value !== undefined"
                  class="command-parameter"
                  :aria-label="`动作参数 ${command.arguments.value}${
                    commandArgumentSpec(definition(command.command_definition_id))?.unit || ''
                  }`"
                >
                  {{ command.arguments.value
                  }}{{ commandArgumentSpec(definition(command.command_definition_id))?.unit || "" }}
                </div>
                <div class="actions">
                  <ElButton
                    link
                    :disabled="readonly || index === 0"
                    :icon="ArrowUp"
                    aria-label="上移动作"
                    @click="moveCommand(index, -1)"
                  /><ElButton
                    link
                    :disabled="readonly || index === additionalCommands.length - 1"
                    :icon="ArrowDown"
                    aria-label="下移动作"
                    @click="moveCommand(index, 1)"
                  /><ElButton
                    link
                    :disabled="
                      readonly ||
                      !isCommandTypeAllowed(definition(command.command_definition_id)?.command_type)
                    "
                    @click="openCommand(command)"
                    >编辑 / 替换</ElButton
                  ><ElButton link type="danger" :disabled="readonly" @click="deleteCommand(index)"
                    >删除</ElButton
                  >
                </div>
              </div>
            </VueDraggable>
            <ElEmpty
              v-if="!additionalCommands.length"
              :description="emptyCommandDescription"
              :image-size="70"
            /> </template
          ><ElEmpty v-else description="请选择或添加一个步骤" />
        </ElCard>
      </div>
    </template>
    <ElDialog
      v-model="infoOpen"
      :title="creating ? '新增菜谱' : infoViewOnly ? '菜谱详情' : '基本信息'"
      width="720px"
      :close-on-click-modal="false"
    >
      <ElForm
        ref="infoForm"
        :model="info"
        :rules="infoRules"
        label-position="top"
        :disabled="infoViewOnly || (!creating && readonly)"
      >
        <div class="form-grid">
          <ElFormItem label="菜谱名称" prop="name"
            ><ElInput v-model="info.name" maxlength="255" @blur="onNameBlur" /></ElFormItem
          ><ElFormItem label="菜谱编码" prop="code"
            ><ElInput v-model="info.code" maxlength="64" :disabled="!creating" />
            <div class="form-tip">菜谱的稳定业务编码，创建后不可修改。</div></ElFormItem
          >
          <ElFormItem label="分类" prop="category_id"
            ><ElSelect v-model="info.category_id"
              ><ElOption
                v-for="item in categories"
                :key="item.id"
                :label="item.name"
                :value="item.id" /></ElSelect></ElFormItem
          ><ElFormItem label="菜系"
            ><ElSelect v-model="info.cuisine_id" clearable
              ><ElOption
                v-for="item in cuisines"
                :key="item.id"
                :label="item.name"
                :value="item.id" /></ElSelect
          ></ElFormItem>
          <ElFormItem label="菜谱类型"
            ><ElRadioGroup v-model="info.menu_type"
              ><ElRadioButton :value="1">官方</ElRadioButton
              ><ElRadioButton :value="2">私人</ElRadioButton></ElRadioGroup
            >
            <div class="form-tip">决定菜谱归属范围，不决定后台编辑权限。</div></ElFormItem
          ><ElFormItem v-if="info.menu_type === 2" label="所属用户" prop="owner_user_id"
            ><ElSelect v-model="info.owner_user_id"
              ><ElOption
                v-for="owner in owners"
                :key="owner.id"
                :label="owner.name || owner.username"
                :value="owner.id"
            /></ElSelect>
            <div class="form-tip">私人菜谱的所属系统用户，不代表版本创建人。</div>
          </ElFormItem>
          <ElFormItem label="作者">
            <ElInput v-model="info.author" maxlength="128" />
            <div class="form-tip">
              默认使用登录人姓名，仅用于展示；编辑权限按版本创建人及管理员身份判断。
            </div>
          </ElFormItem>
          <ElFormItem label="份量">
            <ElSelect v-model="info.portion_type"
              ><ElOption label="标准份" value="STANDARD" /><ElOption
                label="大份"
                value="LARGE" /><ElOption label="多人份" value="SHARING"
            /></ElSelect>
          </ElFormItem>
          <ElFormItem label="菜谱分段">
            <ElSelect v-model="info.menu_segment">
              <ElOption label="常规" value="regular" />
              <ElOption label="湘菜大师" value="hunan_masterchef" />
              <ElOption label="粤菜大师" value="cantonese_masterchef" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="基础价格">
            <ElInputNumber
              v-model="info.base_price"
              :min="0"
              :precision="2"
              controls-position="right"
              style="width: 100%"
            />
            <div class="form-tip">菜谱公共价格，所有版本共用。</div>
          </ElFormItem>
          <ElFormItem label="VIP 等级" prop="required_vip_level_id">
            <div style="width: 100%">
              <ElSelect v-model="info.required_vip_level_id" placeholder="请选择菜谱所需等级" style="width: 100%">
                <ElOption v-for="level in vipOptions" :key="level.id" :label="`${level.name}（等级 ${level.level_value}）`" :value="level.id" />
                <ElOption v-if="info.required_vip_level_id && !vipOptions.some(level => level.id === info.required_vip_level_id)" :value="info.required_vip_level_id" label="原等级已停用，请重新选择" disabled />
              </ElSelect>
              <div class="form-tip">所有版本共用，设备等级达到此等级才可访问。</div>
            </div>
          </ElFormItem>
        </div>
        <ElFormItem class="image-form-item">
          <template #label>
            <div class="image-form-title">
              <span>菜谱图片</span>
              <ElButton
                v-if="!infoViewOnly && (creating || !readonly)"
                :icon="Picture"
                :loading="coverMatching"
                @click="triggerMatchCover"
                >匹配封面</ElButton
              >
            </div>
          </template>
          <div class="recipe-images">
            <FaFileUpload
              v-model:file-list="imageFiles"
              list-type="picture-card"
              accept="image/png,image/jpeg,image/webp"
              directory="menu"
              multiple
              :limit="3"
              :disabled="infoViewOnly || (!creating && readonly)"
              :before-upload="beforeImageUpload"
              :on-remove="removeImage"
              :on-preview="previewImage"
              :on-exceed="handleImageExceed"
              @uploaded="imageUploaded"
              @pending-change="(count) => (imagePending = count > 0)"
            >
              <template v-if="creating || !readonly">
                <ElIcon><Plus /></ElIcon>
                <span class="upload-label">上传图片</span>
              </template>
            </FaFileUpload>
            <div class="form-tip">
              最多上传 3 张，支持 JPG、PNG、WebP，单张最大
              10MB；第一张自动作为封面，点击「匹配封面」可按菜名覆盖封面。
            </div>
          </div>
        </ElFormItem>
        <ElFormItem label="菜谱描述"
          ><ElInput v-model="info.description" type="textarea" :rows="2" /></ElFormItem
        ><ElFormItem label="本次修订说明"
          ><ElInput v-model="info.change_note" maxlength="500" />
          <div class="form-tip">
            记录本版本相较来源版本的主要变化，方便版本管理时识别。
          </div></ElFormItem
        > </ElForm
      ><template #footer
        ><ElButton @click="infoOpen = false">{{
          infoViewOnly || (readonly && !creating) ? "关闭" : "取消"
        }}</ElButton
        ><ElButton
          v-if="!infoViewOnly && (creating || !readonly)"
          type="primary"
          @click="confirmInfo"
          >{{ creating ? "创建并编辑" : "应用修改" }}</ElButton
        ></template
      >
    </ElDialog>
    <ElDialog v-model="stepOpen" title="添加步骤" width="520px" :close-on-click-modal="false"
      ><ElForm label-position="top"
        ><ElFormItem label="步骤类型"
          ><ElSelect v-model="stepForm.type" @change="onStepFormTypeChange"
            ><ElOption
              v-for="type in availableStepTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value" /></ElSelect></ElFormItem
        ><ElFormItem label="步骤名称"
          ><ElInput
            v-model="stepForm.name"
            :placeholder="typeLabel(stepForm.type)"
            maxlength="255" /></ElFormItem
        ><ElFormItem v-if="stepForm.type === 'FEED'" label="绑定料盒（必选）"
          ><ElSelect v-model="stepForm.box_id"
            ><ElOption
              v-for="box in revision?.boxes"
              :key="box.id"
              :label="`料盒 ${box.box_no}`"
              :value="box.id"
              :disabled="boxUsed(box.id)" /></ElSelect></ElFormItem
        ><ElFormItem label="插入位置"
          ><ElSelect v-model="stepForm.after"
            ><ElOption
              v-for="step in insertAfterSteps"
              :key="step.id"
              :label="`在 ${step.name} 之后`"
              :value="step.id" /></ElSelect></ElFormItem></ElForm
      ><template #footer
        ><ElButton @click="stepOpen = false">取消</ElButton
        ><ElButton type="primary" :loading="stepAdding" @click="addStep"
          >添加步骤</ElButton
        ></template
      ></ElDialog
    >
    <ElDialog
      v-model="commandOpen"
      :title="commandTarget ? '编辑 / 替换动作' : '添加动作'"
      width="760px"
      :close-on-click-modal="false"
      ><div class="command-filters" :class="{ 'has-subgroup': commandGroups.length }">
        <ElSelect v-model="commandType" placeholder="请先选择动作分类"
          ><ElOption
            v-for="type in allowedCommandTypeOptions"
            :key="type.dict_value"
            :label="type.dict_label"
            :value="type.dict_value" /></ElSelect
        ><ElSelect
          v-if="commandGroups.length"
          v-model="commandGroup"
          placeholder="请选择机械臂二级分类"
          @change="searchCommands"
        >
          <ElOption
            v-for="group in commandGroups"
            :key="group.value"
            :label="group.label"
            :value="group.value"
          /> </ElSelect
        ><ElInput
          v-model="commandSearch"
          placeholder="搜索名称或动作编号"
          clearable
          :prefix-icon="Search"
          :disabled="!commandType"
          @keyup.enter="searchCommands"
          @clear="searchCommands"
        />
        <ElButton type="primary" :disabled="!commandType" @click="searchCommands">查询</ElButton>
      </div>
      <ElTable
        v-loading="commandLoading"
        :data="filteredDefinitions"
        :empty-text="commandType ? '没有匹配的动作' : '请先选择动作分类'"
        highlight-current-row
        @row-click="selectDefinition"
        ><ElTableColumn width="55"
          ><template #default="{ row }"
            ><ElRadio
              v-model="commandChoice"
              :value="row.id"
              :disabled="!compatible(row as Definition)"
              ><span class="sr-only">选择 {{ row.name }}</span></ElRadio
            ></template
          ></ElTableColumn
        ><ElTableColumn prop="name" label="动作" min-width="200" /><ElTableColumn
          prop="command_id"
          label="动作编号"
          width="110"
        /><ElTableColumn label="参数" width="110"
          ><template #default="{ row }">
            <ElTag v-if="commandArgumentSpec(row as Definition)" type="warning" size="small">
              需填写 {{ commandArgumentSpec(row as Definition)?.unit }}
            </ElTag>
            <span v-else class="muted">无需填写</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="可用性" min-width="150"
          ><template #default="{ row }"
            ><ElTag :type="compatible(row as Definition) ? 'success' : 'info'">{{
              !row.enabled
                ? "已停用"
                : compatible(row as Definition)
                  ? "可选择"
                  : "与当前料盒不匹配"
            }}</ElTag></template
          ></ElTableColumn
        ></ElTable
      >
      <div class="pagination">
        <ElPagination
          v-if="commandType"
          v-model:current-page="commandPage"
          :total="commandTotal"
          :page-size="20"
          layout="total, prev, pager, next"
          @current-change="loadCommands"
        />
      </div>
      <ElForm label-position="top" class="command-note"
        ><ElFormItem v-if="selectedCommandArgumentSpec" label="本次动作参数（必填）">
          <ElInputNumber
            v-model="commandValue"
            :min="selectedCommandArgumentSpec.min"
            :max="selectedCommandArgumentSpec.max"
            :step="selectedCommandArgumentSpec.step"
            :precision="selectedCommandArgumentSpec.precision"
            controls-position="right"
            style="width: 100%"
          />
          <div class="form-tip">
            范围 {{ selectedCommandArgumentSpec.min }}～{{ selectedCommandArgumentSpec.max
            }}{{ selectedCommandArgumentSpec.unit }}。
          </div>
        </ElFormItem>
        <ElFormItem label="本次使用说明"
          ><ElInput v-model="commandDescription" maxlength="500" /></ElFormItem></ElForm
      ><ElAlert
        title="请选择动作库中已有的动作；需要数值的动作必须填写本次参数。"
        type="info"
        :closable="false"
      /><template #footer
        ><ElButton @click="commandOpen = false">关闭</ElButton
        ><ElButton type="primary" :disabled="!commandChoice" @click="confirmCommand">{{
          commandTarget ? "应用修改" : "添加动作"
        }}</ElButton></template
      ></ElDialog
    >
    <ElDialog v-model="boxesOpen" title="版本料盒说明" width="700px"
      ><ElForm v-if="revision" label-position="top" :disabled="readonly"
        ><ElEmpty v-if="!boundBoxes.length" description="暂无绑定料盒的步骤" :image-size="70" />
        <div v-for="box in boundBoxes" :key="box.id" class="box-entry">
          <strong>料盒 {{ box.box_no }}</strong
          ><ElTag size="small">{{
            revision.steps.find((s) => s.box_id === box.id)?.name || "未绑定步骤"
          }}</ElTag
          ><ElFormItem label="食材和用量" required
            ><BoxIngredientEditor
              :box="box"
              @change="updateBox"
              :disabled="readonly"
              :show-errors="boxErrors" /></ElFormItem
          ><ElFormItem label="备料提示"
            ><ElInput v-model="box.remark" maxlength="500"
          /></ElFormItem></div></ElForm
      ><template #footer
        ><ElButton type="primary" @click="boxesOpen = false">完成</ElButton></template
      ></ElDialog
    >
    <ElDialog
      v-model="publishOpen"
      :title="errors.length ? '发布检查未通过' : '确认发布'"
      width="600px"
      ><template v-if="errors.length"
        ><ElAlert title="请修正以下问题后重新发布" type="warning" :closable="false" />
        <div v-for="(error, i) in errors" :key="i" class="error-item">
          <span>{{ error.message }}</span
          ><ElButton link type="primary" @click="locateError(error.stepId)">定位</ElButton>
        </div></template
      ><template v-else-if="revision"
        ><ElDescriptions :column="2" border
          ><ElDescriptionsItem label="菜谱">{{ revision.name }}</ElDescriptionsItem
          ><ElDescriptionsItem label="修订">#{{ revision.revision_no }}</ElDescriptionsItem
          ><ElDescriptionsItem label="步骤">{{ revision.steps.length }}</ElDescriptionsItem
          ><ElDescriptionsItem label="动作">{{ totalCommands }}</ElDescriptionsItem></ElDescriptions
        ><ElAlert
          class="publish-tip"
          title="发布后此版本只读，其他已发布版本不受影响；此操作不向设备下发。"
          type="warning"
          :closable="false" /></template
      ><template #footer
        ><ElButton @click="publishOpen = false">{{ errors.length ? "返回修改" : "取消" }}</ElButton
        ><ElButton v-if="!errors.length" type="primary" @click="confirmPublish"
          >确认发布</ElButton
        ></template
      ></ElDialog
    >
    <FaDialog
      v-model="leaveOpen"
      title="存在未保存修改"
      width="460px"
      :draggable="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      ><p>
        {{ leaveTarget === "versions" ? "返回版本管理" : "关闭编辑器" }}后，未保存的修改将丢失。
      </p>
      <template #footer
        ><ElButton @click="leaveOpen = false">继续编辑</ElButton
        ><ElButton @click="discardAndLeave">放弃修改</ElButton
        ><ElButton type="primary" @click="saveAndLeave">保存并离开</ElButton></template
      ></FaDialog
    >
  </div>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type UploadFile,
  type UploadFiles,
  type UploadRawFile,
  type UploadUserFile,
} from "element-plus";
import {
  Plus,
  Search,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Delete,
  Rank,
  Close,
  Grid,
  List,
  Picture,
  ArrowRight,
} from "@element-plus/icons-vue";
import { VueDraggable } from "vue-draggable-plus";
import { useDictStore, useUserStore } from "@stores";
import FaFileUpload from "@/components/actions/fa-file-upload/index.vue";
import type { FileUploadResult } from "@/components/actions/fa-file-upload/upload";
import type { TableAction } from "@/components/tables/fa-table-actions/index.vue";
import type { ManagementRow } from "@/components/business/fa-management-list/index.vue";
import type { ColumnOption } from "@/types/component";
import { FaDialog } from "@/components/modal";
import BoxIngredientEditor from "./BoxIngredientEditor.vue";
import FeedStepCard from "./step-editors/FeedStepCard.vue";
import FixedStepCard from "./step-editors/FixedStepCard.vue";
import HeatStepCard from "./step-editors/HeatStepCard.vue";
import ProcessStepCard from "./step-editors/ProcessStepCard.vue";
import ServeStepCard from "./step-editors/ServeStepCard.vue";
import {
  stepTypes,
  current,
  copy,
  normalize,
  makeRecipe,
  makeStep,
  makeCommand,
  nextId,
  publishErrors,
  initializeIngredients,
  repeatableStepTypes,
  fixedStepTypes,
  normalizeStepType,
  mainFeedingDefinition,
  commandArgumentSpec,
  commandArgumentError,
  hasRecipeAdminAccess,
  type Revision,
  type Recipe,
  type Step,
  type StepCommand,
  type Definition,
  type Box,
  type RecipeImage,
} from "./recipeEditor";
import {
  DEFAULT_FEEDING_PROCESS,
  buildFeedingCommandId,
  parseFeedingCommandId,
  type FeedingProcess,
} from "@/config/recipeCommand";
import { getVipLevelOptions, type VipLevelOption } from "@/api/business/customer";
import {
  listRecipes,
  getRecipe,
  createRecipe,
  saveRecipeRevision,
  cloneRecipeRevision,
  publishRecipeRevision,
  getCommands,
  getCommandGroups,
  getCommandPresets,
  getDictionary,
  matchRecipeCover,
} from "@/api/business/recipeEditor";
import {
  allowedCommandTypes,
  isManagedStepPresetCommand,
  servingSpeedOptions,
  stepCommandPresets,
  type ServingSpeed,
  type StepCommandPreset,
} from "@/config/recipeStepPreset";
import { formatDateTime } from "@/api/business/common";
import {
  getRecipeOwnerOptions,
  type RecipeOwnerOption,
  type MatchedCover,
  type CommandGroupOption,
} from "@/api/business/recipeEditor";
import {
  recipeCreatorOptions,
  resolveRecipeCreatorId,
  type RecipeCreatorOption,
} from "@/config/recipeCreators";
const userStore = useUserStore();
const dictStore = useDictStore();
const COMMAND_TYPE_DICT = "device_command_type";
const commandTypeOptions = computed(() => dictStore.getDictArray(COMMAND_TYPE_DICT));
const loginId = computed(() => {
  const id = Number(userStore.info.id ?? userStore.basicInfo.user_id);
  return userStore.isLogin && Number.isSafeInteger(id) && id > 0 ? id : null;
});
const loginName = computed(
  () => userStore.info.name?.trim() || userStore.info.username?.trim() || ""
);
const isRecipeAdmin = computed(() => hasRecipeAdminAccess(userStore.info));
const recipes = ref<Recipe[]>([]),
  editing = ref<Recipe | null>(null),
  savedSnapshot = ref("");
const categories = ref<{ id: number; name: string }[]>([]),
  cuisines = ref<{ id: number; name: string }[]>([]),
  owners = ref<RecipeOwnerOption[]>([]);
const creatorOptions: readonly RecipeCreatorOption[] = recipeCreatorOptions;
const definitions = ref<Definition[]>([]);
const busy = ref(false),
  loading = ref(false),
  loadError = ref("");
type ViewMode = "table" | "card";
const storedViewMode = localStorage.getItem("recipe-management-view");
const viewMode = ref<ViewMode>(storedViewMode === "card" ? "card" : "table");
const search = ref(""),
  creatorFilter = ref<number | string>(""),
  categoryFilter = ref<number | "">(""),
  cuisineFilter = ref<number | "">(""),
  vipLevelFilter = ref<number | "">(""),
  page = ref(1),
  pageSize = ref(viewMode.value === "card" ? 12 : 10),
  total = ref(0);
const pageSizeOptions = computed(() =>
  viewMode.value === "card" ? [12, 24, 48] : [10, 20, 50, 100]
);
const recipeColumns = ref<ColumnOption[]>([
  { prop: "name", label: "菜谱名称", minWidth: 180, visible: true },
  { prop: "type", label: "类型", width: 90, align: "center", visible: true },
  { prop: "owner", label: "归属", minWidth: 140, visible: true },
  { prop: "price", label: "基础价格", width: 110, visible: true },
  { prop: "featured", label: "平台推荐", width: 100, align: "center", visible: true },
  { prop: "created_at", label: "创建时间", width: 170, visible: true },
]);
const visibleRecipeColumns = computed(() =>
  recipeColumns.value.filter((column) => column.visible !== false && column.checked !== false)
);
const selectedId = ref<number | null>(null),
  versionDialogOpen = ref(false),
  versionRecipeId = ref<number | null>(null),
  selectedRevisionId = ref<number | null>(null);
const versionRecipe = computed(() => recipes.value.find((r) => r.id === versionRecipeId.value));
const revision = computed(
  () => editing.value?.revisions.find((r) => r.id === selectedRevisionId.value) || null
);
const canManageRevision = (r: Revision) =>
  isRecipeAdmin.value || (loginId.value !== null && r.created_by === loginId.value);
const canEditRevision = (r: Revision) => r.revision_status !== 1 && canManageRevision(r);
const canManageRecipe = (r: Recipe) =>
  !!r.revisions.length &&
  canManageRevision(
    r.revisions.reduce((first, item) => (item.revision_no < first.revision_no ? item : first))
  );
const readonly = computed(() => !revision.value || !canEditRevision(revision.value));
const statusLabel = (status: number) => ({ 0: "草稿", 1: "已发布", 2: "已下架" })[status] || "未知";
const statusType = (status: number): "success" | "warning" | "info" =>
  status === 1 ? "success" : status === 0 ? "warning" : "info";
const activeStep = computed(() => revision.value?.steps.find((s) => s.id === selectedId.value));
function updateActiveStep(changes: Partial<Step>) {
  if (!activeStep.value || readonly.value) return;
  Object.assign(activeStep.value, changes);
}
const activeStepType = computed(() => normalizeStepType(activeStep.value?.step_type || "CUSTOM"));
const allowedCommandTypeValues = computed(() =>
  allowedCommandTypes(
    activeStepType.value,
    commandTypeOptions.value.map((item) => item.dict_value)
  )
);
const allowedCommandTypeOptions = computed(() =>
  commandTypeOptions.value.filter((item) =>
    allowedCommandTypeValues.value.includes(item.dict_value)
  )
);
const commandTypeLabels = computed(
  () => new Map(commandTypeOptions.value.map((item) => [item.dict_value, item.dict_label]))
);
const emptyCommandDescription = computed(() => {
  if (activeStepType.value === "FEED")
    return "暂无附加动作；料盒主投料由上方工艺和接料设置自动维护";
  if (!allowedCommandTypeValues.value.length) return "当前固定步骤使用上方预设配置";
  return "暂无附加动作，可按当前步骤允许的分类添加";
});
function commandTypeLabel(value?: string) {
  return value ? commandTypeLabels.value.get(value) || value : "未知分类";
}
function isCommandTypeAllowed(value?: string) {
  return !!value && allowedCommandTypeValues.value.includes(value);
}
const stepCardCopy = computed(() => {
  const copyByType: Record<string, { title: string; description: string }> = {
    BRAISE: {
      title: "焖锅工艺",
      description: "配置焖锅期间的等待、电磁炉和其他附加动作；连续焖锅会在发布时被拦截。",
    },
    ROBOT: {
      title: "无投料机械臂",
      description: "仅编排机械臂及相关辅助动作；机械臂候选支持基础、拨菜和搅拌二级分类。",
    },
    BLANCH_PREPARE: {
      title: "焯笼预置",
      description: "焯笼固定流程步骤，发布时必须与焯笼出菜、焯笼回锅同时存在并保持顺序。",
    },
    BLANCH_SERVE: {
      title: "焯笼出菜",
      description: "焯笼固定出菜步骤；执行前必须已经完成至少一个料盒主料投放。",
    },
    BLANCH_RETURN: {
      title: "焯笼回锅",
      description: "焯笼固定回锅步骤，用于完成焯笼流程闭环。",
    },
    SERVE: {
      title: "出菜",
      description: "主流程固定结束步骤，始终保持在最后且不能删除。",
    },
    CUSTOM: {
      title: "自定义步骤",
      description: "用于兼容非标准流程，设备实际行为完全由下方动作决定。",
    },
  };
  return copyByType[activeStepType.value] || copyByType.CUSTOM!;
});
const activeBox = computed(() =>
  revision.value?.boxes.find((b) => b.id === activeStep.value?.box_id)
);
const activeMainFeedingDefinition = computed(() =>
  activeStep.value ? mainFeedingDefinition(activeStep.value, definitions.value) : undefined
);
const activeFeedingState = computed(() =>
  activeMainFeedingDefinition.value
    ? parseFeedingCommandId(activeMainFeedingDefinition.value.command_id)
    : {
        receive: false,
        process: DEFAULT_FEEDING_PROCESS,
        boxNo: activeBox.value?.box_no || 0,
      }
);
const feedCommandUpdating = ref(false);
const servingSpeedUpdating = ref(false);
function commandForPresetRole(step: Step | undefined, role: StepCommandPreset["role"]) {
  if (!step) return undefined;
  const preset = stepCommandPresets(normalizeStepType(step.step_type)).find(
    (item) => item.role === role
  );
  if (!preset) return undefined;
  return step.commands.find((command) => {
    const commandId = definition(command.command_definition_id)?.command_id;
    if (role === "serving_speed")
      return servingSpeedOptions.some((option) => option.commandId === commandId);
    return commandId === preset.commandId;
  });
}
const activeHeatValues = computed(() => {
  const value = (role: StepCommandPreset["role"], fallback: number) => {
    const pending = role ? activeStep.value?.editor_preset_values?.[role] : undefined;
    if (typeof pending === "number") return pending;
    const command = commandForPresetRole(activeStep.value, role);
    return typeof command?.arguments?.value === "number" ? command.arguments.value : fallback;
  };
  return {
    level: value("heat_level", 99),
    time: value("heat_time", 11),
    water: value("heat_water", 0),
    oil: value("heat_oil", 0),
  };
});
function servingSpeedForStep(step?: Step): ServingSpeed {
  const pending = step?.editor_preset_values?.serving_speed;
  if (pending) return pending;
  const command = commandForPresetRole(step, "serving_speed");
  const commandId = command ? definition(command.command_definition_id)?.command_id : undefined;
  return servingSpeedOptions.find((item) => item.commandId === commandId)?.value || "NORMAL";
}
const activeServingSpeed = computed<ServingSpeed>(() => servingSpeedForStep(activeStep.value));
const boundBoxes = computed(
  () =>
    revision.value?.boxes.filter((b) => revision.value!.steps.some((s) => s.box_id === b.id)) || []
);
const boxErrors = ref(false);
function updateBox(box: Box) {
  if (!revision.value || readonly.value) return;
  const index = revision.value.boxes.findIndex((item) => item.id === box.id);
  if (index >= 0) revision.value.boxes[index] = box;
}
function validateBoxes() {
  boxErrors.value = true;
  const missing = boundBoxes.value.find((b) =>
    b.editor_ingredients === undefined
      ? !(b.content_text || "").trim()
      : !b.editor_ingredients.length ||
        b.editor_ingredients.some((i) => !i.name.trim() || !i.quantity.trim())
  );
  if (!missing) return true;
  selectedId.value = revision.value?.steps.find((s) => s.box_id === missing.id)?.id || null;
  ElMessage.warning(`请补齐料盒 ${missing.box_no} 的食材和用量`);
  return false;
}
const dirty = computed(
  () => !!editing.value && JSON.stringify(editing.value) !== savedSnapshot.value
);
const filteredRecipes = computed(() => recipes.value);
const totalCommands = computed(
  () => revision.value?.steps.reduce((n, s) => n + s.commands.length, 0) || 0
);
const definition = (id: number) => definitions.value.find((d) => d.id === id);
const isMainFeedingCommand = (command: StepCommand) =>
  definition(command.command_definition_id)?.command_type === "MATERIAL_BOX";
const isManagedPresetCommand = (command: StepCommand) => {
  const commandId = definition(command.command_definition_id)?.command_id;
  return commandId !== undefined && isManagedStepPresetCommand(activeStepType.value, commandId);
};
const additionalCommands = computed<StepCommand[]>({
  get: () =>
    activeStep.value?.commands.filter(
      (command) => !isMainFeedingCommand(command) && !isManagedPresetCommand(command)
    ) || [],
  set: (commands) => {
    if (!activeStep.value || !revision.value) return;
    const managedCommands = activeStep.value.commands.filter(
      (command) => isMainFeedingCommand(command) || isManagedPresetCommand(command)
    );
    activeStep.value.commands = [...managedCommands, ...commands];
    normalize(revision.value);
  },
});
const commandDuration = computed(
  () =>
    additionalCommands.value.reduce(
      (n, c) => n + (definition(c.command_definition_id)?.duration_ms || 0),
      0
    ) / 1000
);
const typeLabel = (type: string) =>
  stepTypes.find((t) => t.value === normalizeStepType(type))?.label || type;
const boxNo = (id: number) => revision.value?.boxes.find((b) => b.id === id)?.box_no;
const boxUsed = (id: number, except?: number) =>
  !!revision.value?.steps.some((s) => s.box_id === id && s.id !== except);
const isBoxBoundToOtherStep = (id: number) => boxUsed(id, activeStep.value?.id);
const formatPrice = (value: string | number | undefined) => Number(value || 0).toFixed(2);
async function switchView(mode: ViewMode) {
  if (viewMode.value === mode) return;
  viewMode.value = mode;
  localStorage.setItem("recipe-management-view", mode);
  page.value = 1;
  pageSize.value = mode === "card" ? 12 : 10;
  await loadRecipes();
}
function recipeRowActions(recipe: Recipe): TableAction[] {
  const actions: TableAction[] = [
    {
      key: "view",
      label: "查看",
      onClick: () => void viewRecipeInfo(recipe),
    },
    {
      key: "versions",
      label: `版本管理（${recipe.revisions.length}）`,
      icon: "ep:message-box",
      onClick: () => void openVersions(recipe.id),
    },
  ];
  if (canManageRecipe(recipe)) {
    actions.push({
      key: "create-draft",
      label: "创建新草稿",
      onClick: () => void newDraft(recipe),
    });
  }
  return actions;
}
function versionRowActions(recipe: Recipe, item: Revision): TableAction[] {
  const actions: TableAction[] = [
    {
      key: "edit-or-view",
      label: canEditRevision(item) ? "编辑" : "查看",
      onClick: () => editRecipe(recipe, item.id),
    },
  ];
  if (canEditRevision(item)) {
    actions.push({
      key: "publish",
      label: "发布",
      onClick: () => void openRevisionPublish(recipe, item.id),
    });
  }
  if (canManageRevision(item)) {
    actions.push({
      key: "copy-draft",
      label: "复制草稿",
      onClick: () => void newDraft(recipe, item.id),
    });
  }
  if (item.revision_status === 1 && canManageRevision(item)) {
    actions.push({
      key: "offline",
      label: "下架",
      onClick: () => void takeOffline(recipe, item.id),
    });
  }
  return actions;
}
const galleryOpen = ref(false),
  galleryRecipe = ref<Recipe | null>(null),
  galleryRevisionId = ref<number | null>(null),
  galleryImageIndex = ref(0);
const galleryRevision = computed(
  () => galleryRecipe.value?.revisions.find((item) => item.id === galleryRevisionId.value) || null
);
const galleryRecipeName = computed(
  () =>
    galleryRevision.value?.name ||
    (galleryRecipe.value ? current(galleryRecipe.value).name : "菜谱预览")
);
const galleryImages = computed(() =>
  (galleryRecipe.value?.images || []).filter((item) => Boolean(item.file_url))
);
const galleryImageUrl = computed(
  () => galleryImages.value[galleryImageIndex.value]?.file_url || ""
);
const galleryBoundBoxes = computed(() => {
  if (!galleryRevision.value) return [];
  return galleryRevision.value.steps.flatMap((step) => {
    if (!step.box_id) return [];
    const box = galleryRevision.value!.boxes.find((item) => item.id === step.box_id);
    return box ? [{ ...box, step_name: step.name }] : [];
  });
});
const galleryVersionActions = computed<TableAction[]>(() => {
  if (!galleryRecipe.value || !galleryRevision.value) return [];
  return versionRowActions(galleryRecipe.value, galleryRevision.value).map((action) => ({
    ...action,
    onClick: () => {
      galleryOpen.value = false;
      action.onClick();
    },
  }));
});
function previousGalleryImage() {
  if (!galleryImages.value.length) return;
  galleryImageIndex.value =
    (galleryImageIndex.value - 1 + galleryImages.value.length) % galleryImages.value.length;
}
function nextGalleryImage() {
  if (!galleryImages.value.length) return;
  galleryImageIndex.value = (galleryImageIndex.value + 1) % galleryImages.value.length;
}
function closeGallery() {
  galleryRecipe.value = null;
  galleryRevisionId.value = null;
  galleryImageIndex.value = 0;
}
function mergeDefinitions(rows: Definition[]) {
  const map = new Map(definitions.value.map((d) => [d.id, d]));
  rows.forEach((d) => {
    const protocolBox = d.protocol_fields?.box_no;
    const encodedBox = d.command_type === "MATERIAL_BOX" ? d.command_id % 10 : undefined;
    const box =
      protocolBox ?? (encodedBox && encodedBox >= 1 && encodedBox <= 6 ? encodedBox : undefined);
    map.set(d.id, { ...d, box_no: box === undefined ? undefined : Number(box) });
  });
  definitions.value = [...map.values()];
}
function acceptRecipe(r: Recipe) {
  mergeDefinitions(r.command_definitions || []);
  const index = recipes.value.findIndex((item) => item.id === r.id);
  if (index < 0) recipes.value.unshift(r);
  else recipes.value[index] = r;
}
let listRequest = 0;
async function loadRecipes() {
  const current = ++listRequest;
  loading.value = true;
  loadError.value = "";
  try {
    const result = await listRecipes(page.value, pageSize.value, {
      name: search.value,
      createdId: resolveRecipeCreatorId(creatorFilter.value),
      categoryId: typeof categoryFilter.value === "number" ? categoryFilter.value : undefined,
      cuisineId: typeof cuisineFilter.value === "number" ? cuisineFilter.value : undefined,
      accessibleVipLevelId:
        typeof vipLevelFilter.value === "number" ? vipLevelFilter.value : undefined,
    });
    if (current !== listRequest) return;
    recipes.value = result.items;
    total.value = result.total;
    result.items.forEach((r) => mergeDefinitions(r.command_definitions || []));
  } catch (error) {
    if (current === listRequest)
      loadError.value = error instanceof Error ? error.message : "菜谱加载失败";
  } finally {
    if (current === listRequest) loading.value = false;
  }
}
async function resetRecipeSearch() {
  search.value = "";
  creatorFilter.value = "";
  categoryFilter.value = "";
  cuisineFilter.value = "";
  vipLevelFilter.value = "";
  page.value = 1;
  await loadRecipes();
}
function creatorLabel(creator: RecipeCreatorOption) {
  return creator.name;
}
async function openGallery(recipe: Recipe) {
  loading.value = true;
  try {
    const detail = await getRecipe(recipe.id);
    acceptRecipe(detail);
    galleryRecipe.value = detail;
    galleryImageIndex.value = 0;
    const latestPublished = [...detail.revisions]
      .filter((item) => item.revision_status === 1)
      .sort((a, b) => b.revision_no - a.revision_no)[0];
    galleryRevisionId.value = latestPublished?.id || detail.current_revision_id;
    galleryOpen.value = true;
  } finally {
    loading.value = false;
  }
}
async function openVersions(id: number) {
  loading.value = true;
  try {
    const r = await getRecipe(id);
    acceptRecipe(r);
    versionRecipeId.value = id;
    versionDialogOpen.value = true;
  } finally {
    loading.value = false;
  }
}
async function viewRecipeInfo(recipe: Recipe) {
  loading.value = true;
  try {
    const detail = await getRecipe(recipe.id);
    acceptRecipe(detail);
    const latestPublished = [...detail.revisions]
      .filter((item) => item.revision_status === 1)
      .sort((a, b) => b.revision_no - a.revision_no)[0];
    const selected =
      latestPublished || detail.revisions.find((item) => item.id === detail.current_revision_id);
    if (!selected) throw new Error("菜谱版本不存在");
    infoViewOnly.value = true;
    creating.value = false;
    populateInfo(detail, selected);
    infoOpen.value = true;
    infoForm.value?.clearValidate();
  } finally {
    loading.value = false;
  }
}
function editRecipe(r: Recipe, revisionId = r.current_revision_id) {
  versionDialogOpen.value = false;
  editing.value = copy(r);
  versionRecipeId.value = r.id;
  selectedRevisionId.value = revisionId;
  editing.value.revisions.forEach((item) =>
    item.boxes.forEach((box) => initializeIngredients(box))
  );
  const selected = revision.value;
  if (selected && selected.revision_status !== 1 && canManageRevision(selected)) {
    for (let no = 1; no <= 6; no++)
      if (!selected.boxes.some((box) => box.box_no === no))
        selected.boxes.push({
          id: nextId(),
          revision_id: selected.id,
          box_no: no,
          content_text: "",
          remark: "",
          sort_order: no - 1,
          editor_ingredients: [],
        });
  }
  boxErrors.value = false;
  savedSnapshot.value = JSON.stringify(editing.value);
  selectedId.value = revision.value?.steps[0]?.id || null;
}
function closeVersionDialog() {
  if (!editing.value) versionRecipeId.value = null;
}
const infoOpen = ref(false),
  creating = ref(false),
  infoViewOnly = ref(false),
  infoForm = ref<FormInstance>();
const info = reactive({
  name: "",
  code: "",
  category_id: null as number | null,
  cuisine_id: null as number | null,
  author: "",
  menu_type: 1,
  owner_user_id: null as number | null,
  base_price: 0,
  required_vip_level_id: null as number | null,
  portion_type: "STANDARD",
  menu_segment: "regular",
  description: "",
  change_note: "",
  images: [] as RecipeImage[],
});
const imagePending = ref(false),
  imageFiles = ref<UploadUserFile[]>([]);
function normalizeInfoImages() {
  const positions = new Map(imageFiles.value.map((file, index) => [file.uid, index]));
  info.images.sort(
    (left, right) =>
      (positions.get(left.upload_uid) ?? left.sort_order) -
      (positions.get(right.upload_uid) ?? right.sort_order)
  );
  info.images.forEach((image, index) => {
    image.usage_type = index === 0 ? "cover" : "gallery";
    image.sort_order = index;
  });
}
function beforeImageUpload(file: UploadRawFile) {
  const valid =
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024;
  if (!valid) ElMessage.warning("请选择不超过10MB的JPG、PNG或WebP图片");
  return valid;
}
function imageUploaded(result: FileUploadResult, raw: File) {
  if (!result.file_id) throw new Error("上传接口未返回文件ID");
  const uid = (raw as UploadRawFile).uid;
  const url = result.preview_url || result.file_url || result.url || "";
  info.images.push({
    file_id: Number(result.file_id),
    file_url: url,
    original_name: result.origin_name || raw.name,
    usage_type: info.images.length === 0 ? "cover" : "gallery",
    sort_order: info.images.length,
    upload_uid: uid,
  });
  const upload = imageFiles.value.find((item) => item.uid === uid);
  if (upload) upload.url = url;
  normalizeInfoImages();
}
function removeImage(_file: UploadFile, files: UploadFiles) {
  const ordered = files
    .map((file) =>
      info.images.find(
        (image) => image.upload_uid === file.uid || (!!file.url && image.file_url === file.url)
      )
    )
    .filter((image): image is RecipeImage => Boolean(image));
  info.images.splice(
    0,
    info.images.length,
    ...ordered.map((image, index) => ({
      ...image,
      usage_type: index === 0 ? "cover" : "gallery",
      sort_order: index,
    }))
  );
  normalizeInfoImages();
}
function previewImage(file: UploadFile) {
  if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
}
function handleImageExceed() {
  ElMessage.warning("菜谱图片最多上传3张");
}
const coverMatching = ref(false);
let coverUidSeed = -1000000;
let lastMatchedName = "";
function nextCoverUid() {
  return coverUidSeed--;
}
/** 重建上传组件文件列表，保持与 info.images 的顺序一致。 */
function syncImageFiles() {
  imageFiles.value = info.images.map((image) => ({
    uid: image.upload_uid as number,
    name: image.original_name || "菜谱图片",
    url: image.file_url || undefined,
  }));
}
/** 匹配结果作为新封面，替换旧封面并保留其余图片。 */
function applyMatchedCover(matched: MatchedCover) {
  const uid = nextCoverUid();
  info.images = info.images.filter((image) => image.usage_type !== "cover");
  info.images.unshift({
    file_id: matched.file_id,
    file_url: matched.file_url,
    original_name: matched.original_name || "菜谱封面",
    usage_type: "cover",
    sort_order: 0,
    upload_uid: uid,
  });
  syncImageFiles();
  normalizeInfoImages();
}
async function runMatchCover(manual: boolean) {
  const name = info.name.trim();
  if (!name) {
    if (manual) ElMessage.warning("请先填写菜谱名称");
    return;
  }
  if (imagePending.value) {
    ElMessage.warning("图片正在上传，请稍后");
    return;
  }
  coverMatching.value = true;
  try {
    const matched = await matchRecipeCover(name);
    if (!matched) {
      if (manual) ElMessage.warning(`未找到与「${name}」匹配的封面`);
      return;
    }
    applyMatchedCover(matched);
    ElMessage.success(`${manual ? "" : "已自动"}匹配封面：${matched.original_name}`);
  } catch (error) {
    if (manual) ElMessage.error(error instanceof Error ? error.message : "匹配封面失败，请重试");
  } finally {
    coverMatching.value = false;
  }
}
/** 仅当还没有任何图片时，菜名失焦后自动匹配一次。 */
function onNameBlur() {
  if (!infoOpen.value || infoViewOnly.value || (!creating.value && readonly.value)) return;
  if (info.images.length || imagePending.value || coverMatching.value) return;
  const name = info.name.trim();
  if (!name || name === lastMatchedName) return;
  lastMatchedName = name;
  void runMatchCover(false);
}
async function triggerMatchCover() {
  if (infoViewOnly.value || (!creating.value && readonly.value)) return;
  const name = info.name.trim();
  if (!name) {
    ElMessage.warning("请先填写菜谱名称");
    return;
  }
  try {
    await ElMessageBox.confirm("匹配封面会覆盖当前封面，是否继续？", "匹配封面", {
      type: "warning",
      confirmButtonText: "继续匹配",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  lastMatchedName = name;
  await runMatchCover(true);
}
const infoRules: FormRules = {
  required_vip_level_id: [{ required: true, message: "请选择 VIP 等级", trigger: "change" }],
  name: [{ required: true, whitespace: true, message: "请输入菜谱名称", trigger: "blur" }],
  code: [{ required: true, whitespace: true, message: "请输入菜谱编码", trigger: "blur" }],
  category_id: [{ required: true, message: "请选择分类", trigger: "change" }],
  owner_user_id: [
    {
      validator: (_rule, value, callback) => {
        if (info.menu_type === 2 && !value) callback(new Error("请选择私人菜谱所属用户"));
        else callback();
      },
      trigger: "change",
    },
  ],
};
function populateInfo(recipe: Recipe, selected: Revision) {
  const images = copy(recipe.images || []).map((image, index) => ({
    ...image,
    upload_uid: image.id ?? -(index + 1),
  }));
  Object.assign(info, selected, {
    code: recipe.code,
    menu_type: recipe.menu_type,
    owner_user_id: recipe.owner_user_id,
    base_price: Number(recipe.base_price || 0),
    required_vip_level_id: recipe.required_vip_level_id ?? null,
    images,
  });
  imageFiles.value = images.map((image) => ({
    uid: image.upload_uid,
    name: image.original_name || "菜谱图片",
    url: image.file_url || undefined,
  }));
}
function openInfo(create: boolean) {
  if (create && !loginId.value) {
    ElMessage.warning("请先登录再创建菜谱");
    return;
  }
  creating.value = create;
  infoViewOnly.value = false;
  if (create)
    Object.assign(info, {
      name: "",
      code: `MENU-${Date.now()}`,
      category_id: null,
      cuisine_id: null,
      author: loginName.value,
      menu_type: 1,
      owner_user_id: null,
      base_price: 0,
      required_vip_level_id: vipOptions.value.find(level => level.is_default)?.id ?? null,
      portion_type: "STANDARD",
      menu_segment: "regular",
      description: "",
      change_note: "",
      images: [],
    });
  else if (editing.value && revision.value) populateInfo(editing.value, revision.value);
  if (create) imageFiles.value = [];
  lastMatchedName = "";
  infoOpen.value = true;
  infoForm.value?.clearValidate();
}
async function confirmInfo() {
  if (infoViewOnly.value || !loginId.value || (!creating.value && readonly.value)) return;
  if (imagePending.value) {
    ElMessage.warning("图片正在上传，请稍后");
    return;
  }
  if (!(await infoForm.value?.validate().catch(() => false))) return;
  const target = creating.value ? makeRecipe(info.name.trim(), info.code.trim()) : editing.value!;
  const r = creating.value ? current(target) : revision.value!;
  Object.assign(r, {
    name: info.name.trim(),
    category_id: info.category_id,
    cuisine_id: info.cuisine_id || null,
    author: info.author,
    portion_type: info.portion_type,
    menu_segment: info.menu_segment,
    description: info.description,
    change_note: info.change_note,
  });
  Object.assign(target, {
    menu_type: info.menu_type,
    owner_user_id: info.menu_type === 2 ? info.owner_user_id : null,
    base_price: info.base_price,
    required_vip_level_id: info.required_vip_level_id,
    images: copy(info.images),
    cover_url: info.images[0]?.file_url || "",
    cover_file_id: info.images[0]?.file_id || null,
  });
  if (creating.value) {
    busy.value = true;
    try {
      const saved = await createRecipe(target, r);
      acceptRecipe(saved);
      editRecipe(saved);
      ElMessage.success("菜谱草稿已创建");
      infoOpen.value = false;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : "菜谱预设加载失败");
    } finally {
      busy.value = false;
    }
  } else infoOpen.value = false;
}
async function saveDraft(): Promise<boolean> {
  if (!editing.value || !revision.value || readonly.value) return false;
  try {
    await ensureStepCommandPresets(revision.value.steps);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "步骤预设动作加载失败");
    return false;
  }
  if (!validateBoxes()) return false;
  if (!revision.value.name.trim() || revision.value.steps.some((s) => !s.name.trim())) {
    ElMessage.warning("菜谱名称和步骤名称不能为空");
    return false;
  }
  const id = revision.value.id,
    position = revision.value.steps.findIndex((s) => s.id === selectedId.value);
  normalize(revision.value);
  busy.value = true;
  try {
    const saved = await saveRecipeRevision(editing.value, revision.value);
    acceptRecipe(saved);
    editRecipe(saved, id);
    selectedId.value = revision.value?.steps[Math.max(position, 0)]?.id || null;
    ElMessage.success("版本修改已保存");
    return true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败，请重试");
    return false;
  } finally {
    busy.value = false;
  }
}
async function newDraft(r: Recipe, sourceId = r.current_revision_id) {
  if (!canManageRecipe(r) || busy.value) return;
  try {
    await ElMessageBox.confirm(
      "复制所选版本及料盒、步骤和动作，生成独立草稿。现有草稿和发布版本不受影响。",
      "创建新草稿",
      { confirmButtonText: "创建并编辑", cancelButtonText: "取消" }
    );
  } catch (action) {
    if (action === "cancel" || action === "close") return;
    throw action;
  }
  busy.value = true;
  try {
    const saved = await cloneRecipeRevision(r.id, sourceId);
    acceptRecipe(saved);
    editRecipe(saved);
    ElMessage.success("新草稿已创建");
  } finally {
    busy.value = false;
  }
}
const stepOpen = ref(false),
  stepAdding = ref(false),
  stepForm = reactive({ type: "FEED", name: "", box_id: null as number | null, after: 0 });
const availableStepTypes = computed(() => {
  const used = new Set(
    (revision.value?.steps || []).map((step) => normalizeStepType(step.step_type))
  );
  const hasFreeBox = !!revision.value?.boxes.some((box) => !boxUsed(box.id));
  return stepTypes.filter((item) => {
    if (fixedStepTypes.has(item.value)) return false;
    if (item.value === "FEED" && !hasFreeBox) return false;
    return repeatableStepTypes.has(item.value) || !used.has(item.value);
  });
});
const insertAfterSteps = computed(() =>
  (revision.value?.steps || []).filter((step) => normalizeStepType(step.step_type) !== "SERVE")
);
const isFixedStep = (step: Step) => fixedStepTypes.has(normalizeStepType(step.step_type));
function canMoveStep(index: number, direction: number) {
  if (!revision.value) return false;
  const step = revision.value.steps[index];
  const target = index + direction;
  return !!step && !isFixedStep(step) && target > 0 && target < revision.value.steps.length - 1;
}
function normalizeStepOrder() {
  if (!revision.value) return;
  const heatIndex = revision.value.steps.findIndex(
    (step) => normalizeStepType(step.step_type) === "HEAT"
  );
  if (heatIndex > 0) revision.value.steps.unshift(...revision.value.steps.splice(heatIndex, 1));
  const serveIndex = revision.value.steps.findIndex(
    (step) => normalizeStepType(step.step_type) === "SERVE"
  );
  if (serveIndex >= 0 && serveIndex !== revision.value.steps.length - 1)
    revision.value.steps.push(...revision.value.steps.splice(serveIndex, 1));
  normalize(revision.value);
}
function onStepFormTypeChange() {
  stepForm.name = "";
  if (stepForm.type !== "FEED") stepForm.box_id = null;
}
function openStep() {
  if (!revision.value || readonly.value) return;
  const defaultType =
    availableStepTypes.value.find((item) => item.value === "FEED")?.value ||
    availableStepTypes.value[0]?.value;
  if (!defaultType) {
    ElMessage.info("当前没有可添加的步骤类型");
    return;
  }
  const activeCanPrecede =
    activeStep.value && normalizeStepType(activeStep.value.step_type) !== "SERVE";
  Object.assign(stepForm, {
    type: defaultType,
    name: "",
    box_id: null,
    after: activeCanPrecede ? activeStep.value!.id : revision.value.steps.at(-2)?.id || 0,
  });
  stepOpen.value = true;
}
async function addStep() {
  if (!revision.value || readonly.value || stepAdding.value) return;
  if (!availableStepTypes.value.some((item) => item.value === stepForm.type)) {
    ElMessage.warning("该步骤类型当前不可重复添加");
    return;
  }
  if (stepForm.type === "FEED" && (!stepForm.box_id || boxUsed(stepForm.box_id))) {
    ElMessage.warning("请选择尚未绑定的料盒");
    return;
  }
  const boxId = stepForm.type === "FEED" ? stepForm.box_id : null;
  const step = makeStep(
    revision.value,
    stepForm.type,
    stepForm.name.trim() || (boxId ? `料盒 ${boxNo(boxId)} 投料` : typeLabel(stepForm.type)),
    boxId
  );
  const requestedPosition = stepForm.after
    ? revision.value.steps.findIndex((s) => s.id === stepForm.after) + 1
    : 1;
  const serveIndex = revision.value.steps.findIndex(
    (item) => normalizeStepType(item.step_type) === "SERVE"
  );
  const position = Math.max(
    1,
    Math.min(requestedPosition, serveIndex < 0 ? revision.value.steps.length : serveIndex)
  );
  stepAdding.value = true;
  try {
    if (boxId) {
      const box = revision.value.boxes.find((item) => item.id === boxId);
      if (!box) throw new Error("所选料盒不存在");
      const target = await findFeedingDefinition(box.box_no, DEFAULT_FEEDING_PROCESS, false);
      mergeDefinitions([target]);
      step.commands.unshift(makeCommand(step, target.id));
    }
    revision.value.steps.splice(position, 0, step);
    normalize(revision.value);
    selectedId.value = step.id;
    stepOpen.value = false;
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? `料盒步骤添加失败：${error.message}`
        : "料盒步骤添加失败：未找到预设主投料动作"
    );
  } finally {
    stepAdding.value = false;
  }
}
async function deleteStep(step: Step) {
  if (readonly.value) return;
  if (isFixedStep(step)) {
    ElMessage.warning("热锅起油和出菜是固定步骤，不能删除");
    return;
  }
  try {
    await ElMessageBox.confirm("删除该步骤及内部全部动作，料盒说明保留。", "删除步骤", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch (action) {
    if (action === "cancel" || action === "close") return;
    throw action;
  }
  if (!revision.value) return;
  const index = revision.value.steps.findIndex((s) => s.id === step.id);
  revision.value.steps.splice(index, 1);
  normalize(revision.value);
  selectedId.value =
    revision.value.steps[Math.min(index, revision.value.steps.length - 1)]?.id || null;
}
function moveStep(index: number, direction: number) {
  if (!revision.value || readonly.value || !canMoveStep(index, direction)) return;
  const [s] = revision.value.steps.splice(index, 1);
  if (s) revision.value.steps.splice(index + direction, 0, s);
  normalize(revision.value);
}
function moveCommand(index: number, direction: number) {
  if (!activeStep.value || !revision.value || readonly.value) return;
  const commands = [...additionalCommands.value];
  const [command] = commands.splice(index, 1);
  if (command) commands.splice(index + direction, 0, command);
  additionalCommands.value = commands;
}
function deleteCommand(index: number) {
  if (readonly.value) return;
  const commands = [...additionalCommands.value];
  commands.splice(index, 1);
  additionalCommands.value = commands;
}
const commandOpen = ref(false),
  commandTarget = ref<StepCommand | null>(null),
  commandChoice = ref<number | undefined>(undefined),
  commandDescription = ref(""),
  commandValue = ref<number | undefined>(undefined),
  commandSearch = ref(""),
  commandType = ref(""),
  commandGroup = ref(""),
  commandGroups = ref<CommandGroupOption[]>([]),
  commandPage = ref(1),
  commandTotal = ref(0),
  commandLoading = ref(false),
  commandRows = ref<Definition[]>([]);
const filteredDefinitions = computed(() => commandRows.value);
const selectedCommandArgumentSpec = computed(() =>
  commandArgumentSpec(definition(commandChoice.value || 0))
);
const compatible = (d: Definition) =>
  d.enabled && (!d.box_no || d.box_no === activeBox.value?.box_no);
async function updateFeedingCommand(change: { process?: FeedingProcess; receive?: boolean }) {
  const step = activeStep.value;
  const box = activeBox.value;
  const currentDefinition = activeMainFeedingDefinition.value;
  if (readonly.value || !step || !box || feedCommandUpdating.value) return;
  if (!currentDefinition) {
    ElMessage.error("当前料盒步骤缺少默认主投料动作，请删除后重新添加该步骤");
    return;
  }
  const currentState = parseFeedingCommandId(currentDefinition.command_id);
  const process = change.process ?? currentState.process;
  const receive = change.receive ?? currentState.receive;
  if (
    currentDefinition &&
    buildFeedingCommandId(box.box_no, process, receive) === currentDefinition.command_id
  )
    return;
  feedCommandUpdating.value = true;
  try {
    const target = await findFeedingDefinition(box.box_no, process, receive);
    mergeDefinitions([target]);
    const current = step.commands.find((command) => isMainFeedingCommand(command));
    if (!current) throw new Error("当前步骤缺少料盒默认动作");
    current.command_definition_id = target.id;
    normalize(revision.value!);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "投料工艺更新失败");
  } finally {
    feedCommandUpdating.value = false;
  }
}
async function onActiveBoxIdChange(boxId: number | null) {
  const step = activeStep.value;
  if (readonly.value || !step || feedCommandUpdating.value || step.box_id === boxId) return;
  if (boxId === null) {
    step.box_id = null;
    return;
  }
  if (boxUsed(boxId, step.id)) {
    ElMessage.warning("该料盒已绑定其他步骤");
    return;
  }
  const box = revision.value?.boxes.find((item) => item.id === boxId);
  const currentDefinition = activeMainFeedingDefinition.value;
  if (!box || !currentDefinition) {
    ElMessage.error("当前料盒步骤缺少默认主投料动作，请删除后重新添加该步骤");
    return;
  }
  const state = parseFeedingCommandId(currentDefinition.command_id);
  feedCommandUpdating.value = true;
  try {
    const target = await findFeedingDefinition(box.box_no, state.process, state.receive);
    mergeDefinitions([target]);
    const current = step.commands.find((command) => isMainFeedingCommand(command));
    if (!current) throw new Error("当前步骤缺少料盒默认动作");
    current.command_definition_id = target.id;
    step.box_id = boxId;
    if (revision.value) normalize(revision.value);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "料盒切换失败");
  } finally {
    feedCommandUpdating.value = false;
  }
}
async function ensureStepCommandPresets(steps: Step[]) {
  const plans = steps.map((step) => ({
    step,
    presets: stepCommandPresets(normalizeStepType(step.step_type)).map((preset) => {
      if (preset.role !== "serving_speed") return preset;
      const speed = servingSpeedForStep(step);
      const option = servingSpeedOptions.find((item) => item.value === speed);
      return option ? { ...preset, commandId: option.commandId } : preset;
    }),
  }));
  const commandIds = [
    ...new Set(plans.flatMap((plan) => plan.presets.map((preset) => preset.commandId))),
  ];
  if (!commandIds.length) return;
  const rows = await getCommandPresets(commandIds);
  const byCommandId = new Map(rows.map((row) => [row.command_id, row]));
  const missing = commandIds.filter((commandId) => !byCommandId.has(commandId));
  if (missing.length) throw new Error(`动作库缺少步骤预设动作：${missing.join("、")}`);
  mergeDefinitions(rows);

  plans.forEach(({ step, presets }) => {
    presets.forEach((preset) => {
      const existing = preset.role
        ? commandForPresetRole(step, preset.role)
        : step.commands.find(
            (command) => definition(command.command_definition_id)?.command_id === preset.commandId
          );
      if (existing) {
        const target = byCommandId.get(preset.commandId)!;
        if (preset.role === "serving_speed") existing.command_definition_id = target.id;
        if (preset.arguments && existing.arguments.value === undefined)
          existing.arguments = { ...preset.arguments };
        const pending = preset.role ? step.editor_preset_values?.[preset.role] : undefined;
        if (typeof pending === "number") existing.arguments = { value: pending };
        return;
      }
      const target = byCommandId.get(preset.commandId)!;
      const command = makeCommand(step, target.id);
      command.arguments = preset.arguments ? { ...preset.arguments } : {};
      const pending = preset.role ? step.editor_preset_values?.[preset.role] : undefined;
      if (typeof pending === "number") command.arguments = { value: pending };
      step.commands.push(command);
    });
  });
  if (revision.value) normalize(revision.value);
}
function onHeatParameterChange(role: StepCommandPreset["role"], value: number) {
  const step = activeStep.value;
  if (readonly.value || !step || !role) return;
  step.editor_preset_values = { ...step.editor_preset_values, [role]: value };
}
function onServingSpeedChange(speed: ServingSpeed) {
  const step = activeStep.value;
  if (readonly.value || !step) return;
  step.editor_preset_values = { ...step.editor_preset_values, serving_speed: speed };
}
async function findFeedingDefinition(boxNo: number, process: FeedingProcess, receive: boolean) {
  const targetId = buildFeedingCommandId(boxNo, process, receive);
  const result = await getCommands("MATERIAL_BOX", String(targetId), 1);
  const target = result.items.find((item) => item.command_id === targetId && item.enabled);
  if (!target) throw new Error(`未找到对应的料盒投料动作 ${targetId}`);
  return target;
}
function onFeedingProcessChange(value: string | number) {
  void updateFeedingCommand({ process: Number(value) as FeedingProcess });
}
function onReceiveChange(value: string | number | boolean) {
  void updateFeedingCommand({ receive: Boolean(value) });
}
let commandRequest = 0;
async function loadCommands() {
  const token = ++commandRequest;
  if (!commandType.value) {
    commandRows.value = [];
    commandTotal.value = 0;
    commandLoading.value = false;
    return;
  }
  commandLoading.value = true;
  try {
    const result = await getCommands(
      commandType.value,
      commandSearch.value,
      commandPage.value,
      commandType.value === "ROBOT" ? commandGroup.value : "",
      revision.value?.portion_type === "LARGE"
    );
    if (token !== commandRequest) return;
    mergeDefinitions(result.items);
    commandRows.value = result.items.map((d) => definition(d.id)!);
    commandTotal.value = result.total;
  } finally {
    if (token === commandRequest) commandLoading.value = false;
  }
}
let commandGroupRequest = 0;
watch(commandType, async () => {
  const token = ++commandGroupRequest;
  commandChoice.value =
    commandTarget.value &&
    definition(commandTarget.value.command_definition_id)?.command_type === commandType.value
      ? commandTarget.value.command_definition_id
      : undefined;
  commandPage.value = 1;
  commandGroup.value = "";
  commandGroups.value = [];
  if (commandType.value === "ROBOT") {
    try {
      const groups = await getCommandGroups(commandType.value);
      if (token !== commandGroupRequest) return;
      commandGroups.value = groups;
      commandGroup.value = groups[0]?.value || "";
    } catch {
      if (token !== commandGroupRequest) return;
      commandGroups.value = [];
      commandGroup.value = "";
    }
  }
  await loadCommands();
});
watch(commandChoice, (value, previous) => {
  if (value === previous) return;
  if (value !== commandTarget.value?.command_definition_id) commandValue.value = undefined;
});
function searchCommands() {
  commandPage.value = 1;
  loadCommands();
}
function selectDefinition(d: Definition) {
  if (!compatible(d)) return;
  if (commandChoice.value !== d.id) commandValue.value = undefined;
  commandChoice.value = d.id;
}
function openCommand(command?: StepCommand) {
  if (readonly.value) return;
  const existingType = command ? definition(command.command_definition_id)?.command_type || "" : "";
  if (command && !isCommandTypeAllowed(existingType)) {
    ElMessage.warning("该动作分类不适用于当前步骤");
    return;
  }
  if (!command && !allowedCommandTypeOptions.value.length) {
    ElMessage.info("当前固定步骤不允许添加附加动作");
    return;
  }
  commandTarget.value = command || null;
  commandDescription.value = command?.description || "";
  commandValue.value =
    typeof command?.arguments?.value === "number" ? command.arguments.value : undefined;
  commandSearch.value = "";
  commandRows.value = [];
  commandPage.value = 1;
  commandType.value = existingType || allowedCommandTypeOptions.value[0]?.dict_value || "";
  commandChoice.value = command?.command_definition_id;
  commandOpen.value = true;
}
async function confirmCommand() {
  const def = definition(commandChoice.value || 0);
  if (!def || !compatible(def) || !activeStep.value) {
    ElMessage.warning("请选择适用于当前步骤的启用动作");
    return;
  }
  if (!isCommandTypeAllowed(def.command_type)) {
    ElMessage.warning("该动作分类不适用于当前步骤");
    return;
  }
  const argumentSpec = commandArgumentSpec(def);
  const argumentsValue = argumentSpec ? { value: commandValue.value } : {};
  const argumentError = commandArgumentError(def, argumentsValue, true);
  if (argumentError) {
    ElMessage.warning(argumentError);
    return;
  }
  const targetIsMainFeeding = !!commandTarget.value && isMainFeedingCommand(commandTarget.value);
  if (targetIsMainFeeding && def.command_type !== "MATERIAL_BOX") {
    ElMessage.warning("料盒主投料动作只能通过投料工艺和接料设置替换");
    return;
  }
  const otherDefinitions = activeStep.value.commands
    .filter((command) => command !== commandTarget.value)
    .map((command) => definition(command.command_definition_id))
    .filter((item): item is Definition => !!item);
  if (
    def.command_type === "MATERIAL_BOX" &&
    otherDefinitions.some((item) => item.command_type === "MATERIAL_BOX")
  ) {
    ElMessage.warning("一个料盒步骤只能包含一个主投料动作");
    return;
  }
  if (def.command_type === "LIQUID_SEASONING") {
    const position = Math.floor(def.command_id / 10000) % 10;
    const liquidType = Math.floor((def.command_id % 10000) / 1000);
    const conflict = otherDefinitions.some(
      (item) =>
        item.command_type === "LIQUID_SEASONING" &&
        Math.floor(item.command_id / 10000) % 10 === position &&
        Math.floor((item.command_id % 10000) / 1000) !== liquidType
    );
    if (conflict) {
      ElMessage.warning("同一液体通道只能选择一种物料");
      return;
    }
  }
  if (def.command_type === "SOLID_SEASONING") {
    const solidKey = Math.floor(def.command_id / 1000) * 1000;
    if (solidKey >= 630000 && solidKey < 633000) {
      const exclusive = new Set<number>();
      revision.value?.steps.forEach((step) =>
        step.commands.forEach((command) => {
          if (command === commandTarget.value) return;
          const item = definition(command.command_definition_id);
          const key = item ? Math.floor(item.command_id / 1000) * 1000 : 0;
          if (item?.command_type === "SOLID_SEASONING" && key >= 630000 && key < 633000)
            exclusive.add(key);
        })
      );
      if (exclusive.size && !exclusive.has(solidKey)) {
        ElMessage.warning("鸡精、胡椒粉、花椒粉只能选择其中一种");
        return;
      }
    }
    const solidAmount = argumentSpec ? Number(commandValue.value) : (def.command_id % 1000) / 10;
    if (solidAmount > 20) {
      try {
        await ElMessageBox.confirm("该固体投料量超过 20g，是否继续添加？", "投料量确认", {
          type: "warning",
          confirmButtonText: "继续添加",
          cancelButtonText: "取消",
        });
      } catch {
        return;
      }
    }
  }
  if (commandTarget.value)
    Object.assign(commandTarget.value, {
      command_definition_id: def.id,
      arguments: argumentsValue,
      description: commandDescription.value,
    });
  else {
    const cmd = makeCommand(activeStep.value, def.id);
    cmd.arguments = argumentsValue;
    cmd.description = commandDescription.value;
    activeStep.value.commands.push(cmd);
  }
  if (revision.value) normalize(revision.value);
  commandOpen.value = false;
}
const boxesOpen = ref(false),
  publishOpen = ref(false),
  errors = ref<ReturnType<typeof publishErrors>>([]);
async function preparePublish() {
  if (!revision.value || !(await saveDraft())) return;
  errors.value = publishErrors(revision.value, definitions.value);
  publishOpen.value = true;
}
function locateError(stepId: number | null) {
  publishOpen.value = false;
  if (stepId) selectedId.value = stepId;
  else openInfo(false);
}
async function confirmPublish() {
  if (!editing.value || !revision.value || readonly.value) return;
  busy.value = true;
  const id = revision.value.id;
  try {
    const saved = await publishRecipeRevision(editing.value.id, id);
    acceptRecipe(saved);
    editRecipe(saved, id);
    publishOpen.value = false;
    ElMessage.success("版本发布成功");
  } finally {
    busy.value = false;
  }
}
function openRevisionPublish(r: Recipe, id: number) {
  editRecipe(r, id);
  preparePublish();
}
async function takeOffline(r: Recipe, id: number) {
  const target = r.revisions.find((v) => v.id === id);
  if (!target || !canManageRevision(target) || busy.value) return;
  try {
    await ElMessageBox.confirm("下架后此版本可编辑和重新发布，菜谱暂时没有发布版本。", "下架版本", {
      confirmButtonText: "确认下架",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch (action) {
    if (action === "cancel" || action === "close") return;
    throw action;
  }
  busy.value = true;
  try {
    acceptRecipe(await publishRecipeRevision(r.id, id, true));
    ElMessage.success("版本已下架");
  } finally {
    busy.value = false;
  }
}
type LeaveTarget = "versions" | "list";
const leaveOpen = ref(false),
  leaveTarget = ref<LeaveTarget>("versions");
function requestLeave(target: LeaveTarget) {
  if (busy.value) return;
  leaveTarget.value = target;
  if (dirty.value) {
    leaveOpen.value = true;
  } else {
    finishLeave(target);
  }
}
function finishLeave(target: LeaveTarget) {
  leaveOpen.value = false;
  editing.value = null;
  if (target === "versions") {
    versionDialogOpen.value = true;
  } else {
    versionDialogOpen.value = false;
    versionRecipeId.value = null;
  }
}
function discardAndLeave() {
  finishLeave(leaveTarget.value);
}
async function saveAndLeave() {
  if (await saveDraft()) finishLeave(leaveTarget.value);
}
onBeforeRouteLeave(async () => {
  if (busy.value) return false;
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm("当前修改尚未保存，确定放弃并离开吗？", "未保存修改", {
      confirmButtonText: "放弃并离开",
      cancelButtonText: "继续编辑",
      type: "warning",
    });
    return true;
  } catch (action) {
    if (action === "cancel" || action === "close") return false;
    throw action;
  }
});
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
};
window.addEventListener("beforeunload", beforeUnload);
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
const vipOptions = ref<VipLevelOption[]>([]);
onMounted(async () => {
  await loadRecipes();
  const results = await Promise.allSettled([
    getDictionary("/menu/category/list"),
    getDictionary("/menu/cuisine/list"),
    getRecipeOwnerOptions(),
    dictStore.getDict([COMMAND_TYPE_DICT], true),
    getVipLevelOptions(),
  ]);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      loadError.value = "部分选项加载失败，请刷新重试";
      return;
    }
    if (index === 0) categories.value = result.value as { id: number; name: string }[];
    if (index === 1) cuisines.value = result.value as { id: number; name: string }[];
    if (index === 2) owners.value = result.value as RecipeOwnerOption[];
    if (index === 4) {
      vipOptions.value = result.value as VipLevelOption[];
      if (creating.value && info.required_vip_level_id === null)
        info.required_vip_level_id = vipOptions.value.find(level => level.is_default)?.id ?? null;
    }
  });
});
</script>

<style scoped lang="scss">
.recipe-page {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 20px;
}
// 编辑区沿布局高度收缩，避免步骤和表单内容撑高整页。
.recipe-page--editing {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
}
.recipe-page--editing > .editor-header,
.recipe-page--editing > .el-alert {
  flex-shrink: 0;
}
h2 {
  margin: 12px 0;
  font-size: 22px;
}
h3 {
  margin: 8px 0;
  font-size: 18px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.form-tip {
  width: 100%;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.image-form-title {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
}

:deep(.image-form-item > .el-form-item__label) {
  width: 100%;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.compact {
  margin: 0;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.search {
  width: 220px;
}
.filter :deep(.el-card__body) {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px 20px;
  align-items: center;
  padding: 16px 20px;
}
.filter :deep(.el-form) {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  min-width: 0;
}
.filter :deep(.el-form-item) {
  margin: 0;
}
.filter-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  justify-content: flex-end;
  margin-left: auto;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
.recipe-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.recipe-card {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}
.recipe-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 8px 22px rgb(30 55 110 / 10%);
  transform: translateY(-2px);
}
.recipe-card:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.recipe-card__image,
.recipe-card__fallback {
  display: flex;
  width: 100%;
  aspect-ratio: 2.3 / 1;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
}
.recipe-card__fallback {
  flex-direction: column;
  gap: 6px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.recipe-card__fallback .el-icon {
  font-size: 30px;
}
.recipe-card strong {
  display: block;
  padding: 11px 13px 12px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gallery-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
.gallery-preview,
.gallery-boxes {
  position: relative;
  min-width: 0;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-light);
}
.gallery-preview__image,
.gallery-preview__fallback {
  display: flex;
  width: 100%;
  height: 300px;
  align-items: center;
  justify-content: center;
}
.gallery-preview__fallback {
  flex-direction: column;
  gap: 8px;
  color: var(--el-text-color-placeholder);
}
.gallery-preview__fallback .el-icon {
  font-size: 42px;
}
.gallery-preview__arrow {
  position: absolute;
  top: 50%;
  z-index: 2;
  transform: translateY(-50%);
}
.gallery-preview__arrow.is-left {
  left: 12px;
}
.gallery-preview__arrow.is-right {
  right: 12px;
}
.gallery-preview__counter {
  position: absolute;
  right: 12px;
  bottom: 10px;
  padding: 3px 9px;
  border-radius: 12px;
  color: #fff;
  background: rgb(18 22 30 / 65%);
  font-size: 12px;
}
.gallery-boxes {
  padding: 12px;
  background: var(--el-bg-color-overlay);
}
.gallery-section-title {
  margin-bottom: 10px;
  font-weight: 600;
}
.gallery-version-row {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  margin-top: 18px;
}
.gallery-version-row > span {
  font-weight: 600;
}
.gallery-version-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px 0;
  margin: 16px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.gallery-version-summary > div {
  display: flex;
  gap: 8px;
  align-items: center;
}
.gallery-version-summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.gallery-actions {
  display: flex;
  justify-content: flex-end;
}
.version-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
}
.version-dialog__header strong {
  display: block;
  margin-bottom: 4px;
  font-size: 16px;
}
.version-dialog__header span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.version-dialog__header small {
  display: block;
  margin-top: 4px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
  padding: 16px 20px;
  overflow: visible;
}
.editor-header__main {
  min-width: 0;
}
.editor-header__back {
  margin-bottom: 6px;
}
.editor-header__title {
  display: flex;
  gap: 10px;
  align-items: center;
}
.editor-header__title strong {
  overflow: hidden;
  font-size: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-header__meta,
.editor-header__notice {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.editor-header__notice {
  color: var(--el-color-warning-dark-2);
}
.editor-header__actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.workspace {
  display: grid;
  // 扣除间距后按 20% / 80% 分配宽度，不使用固定像素列宽。
  grid-template-columns: minmax(0, 1fr) minmax(0, 4fr);
  flex: 1 1 0;
  min-height: 0;
  gap: 18px;
  align-items: stretch;
}
.flow-panel,
.detail-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.flow-panel :deep(.el-card__header) {
  flex-shrink: 0;
}
.flow-panel :deep(.el-card__body),
.detail-panel :deep(.el-card__body) {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.flow-item {
  display: grid;
  grid-template-columns: minmax(64px, 2fr) minmax(0, 8fr);
  min-height: 116px;
  padding: 0;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
}
.flow-item.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}
.step-order-zone {
  display: flex;
  min-width: 0;
  padding: 10px 6px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}
.step-drag-target {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 24px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  user-select: none;
}
.step-select-zone {
  position: relative;
  display: flex;
  min-width: 0;
  background: var(--el-bg-color);
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}
.flow-item.selected .step-select-zone {
  background: var(--el-color-primary-light-9);
}
.step-select {
  display: flex;
  width: 100%;
  min-height: 114px;
  align-items: center;
  min-width: 0;
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  padding: 18px 48px 42px 18px;
  font: inherit;
}
.step-select:hover {
  background: var(--el-fill-color-lighter);
}
.flow-item.selected .step-select:hover {
  background: var(--el-color-primary-light-8);
}
.step-select:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -3px;
}
.step-select strong {
  display: block;
  overflow-wrap: anywhere;
}
.step-select small {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-secondary);
}
.number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}
.step-handle,
.command-handle {
  cursor: grab;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.step-fixed {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}
.step-order-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.step-order-actions :deep(.el-button) {
  margin-left: 0;
}
.step-order-zone.step-handle:active {
  cursor: grabbing;
}
.step-delete {
  position: absolute;
  right: 10px;
  bottom: 10px;
  margin-left: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}
.form-grid :deep(.el-select),
.form-grid :deep(.el-input-number) {
  width: 100%;
}
.command-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}
.command-content {
  flex: 1;
  min-width: 180px;
  overflow-wrap: anywhere;
}
.command-parameter {
  flex: 0 0 auto;
  min-width: 72px;
  margin-left: auto;
  color: var(--el-text-color-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.command-filters {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: 12px;
  margin-bottom: 16px;
}
.command-filters.has-subgroup {
  grid-template-columns: 180px 160px 1fr auto;
}
.command-note {
  margin-top: 20px;
}
.box-entry {
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-light);
}
.box-entry :deep(.el-tag) {
  margin-left: 12px;
}
.error-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--el-border-color-light);
}
.publish-tip {
  margin-top: 18px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 1000px) {
  .editor-header {
    align-items: stretch;
    flex-direction: column;
  }
  .editor-header__actions {
    justify-content: flex-start;
  }
  .workspace {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 35fr) minmax(0, 65fr);
  }
  .recipe-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .gallery-main {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .recipe-page {
    padding: 12px;
  }
  .filter :deep(.el-card__body) {
    flex-wrap: wrap;
    padding: 12px;
  }
  .filter :deep(.el-form) {
    flex-direction: column;
    align-items: stretch;
  }
  .filter :deep(.el-form-item),
  .filter :deep(.el-input),
  .filter-actions {
    width: 100%;
  }
  .pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
  .version-dialog__header {
    align-items: stretch;
    flex-direction: column;
  }
  .form-grid,
  .command-filters,
  .command-filters.has-subgroup {
    grid-template-columns: 1fr;
  }
  .recipe-card-grid,
  .gallery-version-summary {
    grid-template-columns: 1fr;
  }
  .gallery-version-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .actions {
    gap: 12px;
  }
  .command-parameter {
    min-width: auto;
  }
}
</style>

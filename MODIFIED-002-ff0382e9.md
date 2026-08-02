# 第二阶段改动说明与手动测试清单

## 统计范围

- 上游共同基准：`ff0382e97145cb6585b575dcc1269fa1512e853b`。
- 原始提交范围：包含 `37bcc675d0922a793099311b9b3d8148e50f6975`，截至 `e1fe5a015359361c61ea645465d322626e2a7931`，共 20 个非合并提交。
- 不包含 `7c094b12d90f2b3b89b25d81d7de7ec2358b389c` 本身，也不包含其后的第一阶段工作区提交 `eccb2e784727a12121316856392e0fe0135480a6`；这两部分由 `MODIFIED-001-17544802.md` 及第一阶段代码负责说明。
- 历史整理后，本文档由独立 docs 提交承载；上述 20 个提交、第一阶段工作区代码及为降低上游冲突所做的重构由紧随其后的单个功能提交承载。
- 主要影响范围：服务器协议恢复、会话 Agent/模型切换、消息 ID、终端键盘与光标、桌面标题栏和构建流程，以及相关国际化完整性。

## 功能改动摘要

### 1. 服务器重试时重新探测协议

- 会话因服务器启动中、断线或 `Failed to fetch` 进入“暂时无法连接”页面后，点击“重试”会销毁目标服务器对应的 App 上下文并重新创建。
- 重新创建会再次执行服务器协议探测，避免首次探测失败后一直复用错误的 V1/V2 判定结果。
- 刷新只针对目标服务器；其他已连接服务器的项目、会话和同步状态不应被重置。

### 2. 本地构建识别修正

- `InstallationLocal` 同时检查构建渠道和版本。
- 即使渠道常量存在，只要版本回退为 `local`，仍按本地开发构建处理，避免本地构建误进入正式安装包逻辑。

### 3. 桌面构建与模型目录缓存

- dev、beta 和 prod 桌面构建统一复制 prod 图标；渠道仍保留在版本和构建信息中，不再通过图标区分。
- Electron Builder 关闭 Electron zip 的远程校验和下载，允许直接使用本地缓存，减少无法访问 GitHub 时的构建失败。
- CLI 与 opencode 构建生成器共享 models 快照缓存逻辑：
  - `MODELS_DEV_API_JSON` 仍具有最高优先级，可直接读取指定快照。
  - 默认优先读取 `${XDG_CACHE_HOME:-~/.cache}/opencode/models.json`。
  - 缓存不存在时从 `OPENCODE_MODELS_URL` 或默认目录下载并回写缓存。
  - 设置 `OPENCODE_MODELS_REFRESH=1` 可跳过旧缓存并强制刷新。
- 主窗口禁用 Chromium 后台节流，使窗口失焦后持续运行的终端、流式会话和计时任务不被明显降频。

### 4. Bash/Shell 输出可读性

- Bash 输出区域恢复原生纵向滚动条，长输出可以直接拖动浏览。
- 复制按钮向左避让滚动条，悬停或键盘聚焦时不会与滚动条重叠。
- 保留第一阶段已有的实时输出、自动跟随和完成后折叠行为。

### 5. 桌面标题栏和 Windows 原生按钮

- 桌面侧栏宽度提取为共享的 `--desktop-sidebar-width`，固定为 262px，侧栏布局和赛道皮肤标题栏分隔线共用该值。
- YU7 GT 与 SU7 Ultra 的标题栏底部分隔线在侧栏右侧逐渐淡出，减少标题栏与 Windows 窗口按钮区域之间的硬接缝。
- 两个深色赛道皮肤在窗口按钮附近使用与原生控制区一致的碳黑背景；标签底色改为不透明混色，避免透明层叠造成色带。
- 标签背景变量迁移到上游组件使用的 `--tab-base` / `--tab-overlay`，兼容新的标签绘制结构；关闭按钮背景保持透明。
- Electron `nativeTheme` 在 Windows 和 macOS 上都跟随应用主题；Windows caption button 的符号色、默认背景和悬停色与当前皮肤/主题一致。

### 6. 堆叠对话框中的输入焦点

- 只有对话框栈顶项保持 modal；被覆盖的设置对话框不再与上层“添加服务器”对话框争夺焦点。
- 添加服务器时，地址、名称、用户名和密码输入框均可点击、输入和重新聚焦。
- 新增 E2E 回归用例覆盖设置页内继续打开服务器表单的场景。

### 7. 客户端消息 ID 单调递增

- 消息 ID 改为由目标服务器会话状态统一生成，而不是各发送入口独立读取进程级时间。
- 每个会话维护自己的下一 ID 基线，并观察实时 `message.updated` 事件和分页拉取到的服务器消息。
- 新 ID 至少从当前时间前 24 小时的安全基线开始；若服务器已有更新的 ID，则从其后一位继续。
- 普通 Prompt、自定义命令和跟进草稿共用该生成器，减少快速连续发送或客户端时钟落后时的 ID 逆序。
- 会话删除时同步释放其 ID 基线；新增单元测试覆盖连续生成、事件推进和历史消息推进。

### 8. 远程服务器视觉区分与国际化完整性

- 桌面侧栏的远程项目云图标根据服务器连接 key 计算稳定 HSL 色相；同一服务器重启后颜色不变，不同服务器更容易区分。
- 补齐 App 与 UI 非英文语言文件中缺失的键，恢复语言键一致性测试。
- 本阶段新增的 Agent/模型切换失败提示具备英文源文案，并在其他语言字典中提供兼容项。

### 9. 会话 Agent、模型和变体切换

- 已存在的 V2 会话切换 Agent 时调用 `session.switchAgent`；切换模型或变体时调用 `session.switchModel`。
- UI 先乐观更新本地选中值，请求成功后保持；请求失败且用户尚未进行下一次选择时，回滚到先前的会话配置并显示错误 Toast。
- Agent 切换不再隐式覆盖当前模型和变体；三者的持久化状态保持独立。
- 切换请求期间：
  - 传统 Prompt 输入框以 Spinner 替换对应选择器。
  - V2 输入框禁用对应选择器并显示 Loader。
  - 命令面板中的 Agent/模型循环命令暂时禁用，防止并发请求覆盖状态。
- V1 兼容层为 `switchAgent` 和 `switchModel` 提供安全的空操作，因为 V1 服务器仍在每次 Prompt 中携带 Agent/模型，不存在独立切换端点。
- 新建会话草稿不调用切换 API，只更新草稿设置；创建完成后仍由正常 Prompt 请求带入选择结果。

### 10. 新建会话皮肤挂载点恢复

- V2 新建会话输入框重新带有 `data-component="session-new-composer"`。
- 桌面皮肤依赖该稳定挂载点设置输入框尺寸、边框和背景；Web 版只增加语义属性，不改变原布局。

### 11. 终端键盘与光标行为

- 终端获得焦点后，除终端自身处理的复制组合键外，所有按键直接交给 PTY。
- 全局命令处理器识别 `[data-component="terminal"]`，不再拦截与应用快捷键重合的按键，例如 tmux 常用的 `Ctrl+B`。
- 光标闪烁状态改为监听终端容器的 `focusin` / `focusout`，正确处理 ghostty-web 在 contenteditable 容器和内部 textarea 之间的焦点切换。
- 焦点真正离开终端后关闭 ghostty 光标闪烁，并将宿主 DOM caret 设为透明，避免左上角出现额外的浏览器闪烁光标。

## 手动测试准备

- 使用桌面版启动应用，并准备一个 V2 服务器、一个可选的旧版 V1 服务器，以及至少两个远程服务器连接。
- 在一个已有历史消息的会话中准备至少两个 Agent、两个模型，并保证其中一个模型有多个变体。
- 准备可模拟 `Failed to fetch`、切换端点失败和服务器重启的测试环境。
- 准备一个输出超过 240px 高度的 Shell 命令，以及安装了 tmux 或能读取组合键的交互式终端程序。
- 如需验证缓存，从干净的临时 `XDG_CACHE_HOME` 启动构建脚本，避免污染日常缓存。

## 手动测试用例

### MT-01 断线重试重新探测协议

**步骤**

1. 打开目标服务器上的会话，并使服务器暂时不可达。
2. 等页面进入“暂时无法连接”状态。
3. 以与首次连接不同的 V1/V2 协议实现重新启动同一地址的服务器。
4. 点击“重试”。

**目视检查**

- 页面重新连接并加载会话，不会一直复用首次失败或旧协议的客户端。
- 目标服务器之外的标签、项目和会话保持可用。
- 多次点击重试不会产生重复服务器上下文或重复事件。

### MT-02 本地构建识别

**步骤**

1. 不注入 `OPENCODE_VERSION` 构建或运行本地包。
2. 分别测试渠道常量缺失和渠道常量存在的情况。

**目视检查**

- 版本为 `local` 时 `InstallationLocal` 始终为真。
- 正式版本和正式渠道仍按非本地安装处理。

### MT-03 桌面图标和离线 Electron 构建

**步骤**

1. 分别以 dev、beta、prod 渠道运行图标复制脚本。
2. 预先放置 Electron zip 缓存，并在无法访问 GitHub 校验文件的网络环境中运行打包。

**目视检查**

- 三个渠道的 `resources/icons` 都来自 prod 图标目录，日志仍显示实际渠道。
- Electron Builder 使用缓存继续构建，不再因下载 `SHASUMS256.txt` 失败而中止。

### MT-04 models 快照缓存与强制刷新

**步骤**

1. 指定空的临时 `XDG_CACHE_HOME`，运行 CLI 或 opencode 构建生成器。
2. 确认缓存生成后断网，再运行一次。
3. 恢复网络，设置 `OPENCODE_MODELS_REFRESH=1` 再运行。
4. 设置 `MODELS_DEV_API_JSON` 指向本地快照并重复。

**目视检查**

- 首次运行下载并写入 `opencode/models.json`；断网重跑可使用缓存。
- 强制刷新时会请求远端并更新缓存。
- 指定 `MODELS_DEV_API_JSON` 时直接使用该文件，不读取或刷新共享缓存。

### MT-05 深色皮肤标题栏和窗口按钮

**步骤**

1. 在 Windows 上分别切换 YU7 GT、SU7 Ultra 和 OpenCode 深色主题。
2. 悬停最小化、最大化和关闭按钮，并观察侧栏、标题栏标签及其交界处。
3. 缩放界面后重复观察。

**目视检查**

- 分隔线从侧栏边界向右平滑淡出，不出现突兀竖线或色带。
- 标签普通、悬停、活动和关闭按钮区域均为稳定的不透明底色。
- 原生按钮符号、背景和悬停色与应用主题一致，缩放后标题栏高度仍正确。

### MT-06 Bash 输出滚动条

**步骤**

1. 执行一个产生大量输出的 Bash/Shell 工具调用。
2. 展开输出，拖动滚动条并悬停复制按钮。

**目视检查**

- 纵向滚动条可见且可拖动。
- 复制按钮与滚动条之间有间距，不遮挡滚动条滑块。
- 复制按钮和实时输出的原有展开/折叠行为正常。

### MT-07 堆叠设置与添加服务器对话框

**步骤**

1. 打开设置，进入“服务器”，点击“添加服务器”。
2. 依次点击并填写地址、名称、用户名和密码。
3. 回到第一个输入框重新编辑。

**目视检查**

- 四个输入框均能获得焦点、保留输入并正常显示光标。
- 下层设置对话框不会抢回焦点；关闭上层表单后设置页恢复 modal 行为。

### MT-08 消息 ID 单调性

**步骤**

1. 在同一会话中快速连续发送普通 Prompt、自定义命令和跟进草稿。
2. 模拟服务器已有一个时间戳更靠后的消息，再从客户端发送下一条。
3. 切换到另一会话发送消息，再删除原会话。

**目视检查**

- 同一会话的新消息顺序稳定，不因同毫秒发送或客户端时钟差出现逆序。
- 观察到服务器较新的 ID 后，下一条客户端 ID 位于其后。
- 不同会话互不污染；删除会话后不残留旧 ID 基线。

### MT-09 远程服务器云图标颜色

**步骤**

1. 同时连接至少两个远程服务器并观察项目侧栏。
2. 重启应用、调整项目顺序，再重新连接相同服务器。

**目视检查**

- 不同服务器的云图标通常具有不同色相，本地项目仍使用普通文件夹图标。
- 同一服务器的颜色跨重启和重连保持稳定。

### MT-10 V2 会话 Agent/模型/变体切换

**步骤**

1. 在已有 V2 会话中依次切换 Agent、模型和模型变体。
2. 观察网络请求和选择器状态。
3. 刷新会话。

**目视检查**

- 分别调用 `switchAgent` 和 `switchModel`，模型请求包含 provider、model 和当前变体。
- 请求期间对应选择器显示 Spinner/Loader，命令面板的相关循环命令不可执行。
- 请求成功后选择保持，刷新后服务器和客户端显示一致。
- 只切换 Agent 不会意外重置模型或变体。

### MT-11 切换失败回滚与连续选择

**步骤**

1. 让 `switchAgent` 或 `switchModel` 返回错误。
2. 选择一个新值，等待失败。
3. 再测试第一次请求未完成时用户已经选择另一个值的情况。

**目视检查**

- 单次失败会回滚到之前值并显示包含服务器错误详情的 Toast。
- 若用户已作出更新选择，旧请求失败不会覆盖新选择。
- 请求完成后选择器解除禁用，可继续操作。

### MT-12 V1 与新建会话兼容

**步骤**

1. 在 V1 服务器的已有会话中切换 Agent 和模型后发送 Prompt。
2. 在新建会话草稿中切换 Agent、模型和变体，再发送首条 Prompt。

**目视检查**

- V1 服务器不会收到不存在的独立切换请求，发送 Prompt 时仍携带最终选择。
- 新建草稿阶段不调用切换端点；会话创建和首条 Prompt 正常完成。

### MT-13 新建会话皮肤选择器

**步骤**

1. 依次切换各桌面皮肤并打开 V2 新建会话页。
2. 检查输入框 DOM 和视觉样式。

**目视检查**

- 输入框根节点具有 `data-component="session-new-composer"`。
- 皮肤的输入框边框、背景、尺寸和位置正常；Web 版布局没有变化。

### MT-14 后台运行连续性

**步骤**

1. 启动一个持续输出的终端命令和一个流式会话。
2. 将桌面窗口最小化或切到其他应用数分钟，再返回。

**目视检查**

- 后台期间终端输出、流式事件和计时任务持续处理，没有明显成倍降速或集中补帧。
- 返回窗口后界面可立即交互。

### MT-15 终端组合键隔离

**步骤**

1. 聚焦内置终端，在 tmux 中按 `Ctrl+B` 及其他与应用快捷键重合的组合键。
2. 测试 `Ctrl+Shift+C` 复制。
3. 点击终端外部后再次触发应用快捷键。

**目视检查**

- 终端聚焦时组合键由 PTY 接收，不打开应用命令或切换面板。
- 复制组合键仍可复制终端选区。
- 焦点离开终端后，全局应用快捷键恢复正常。

### MT-16 终端光标焦点

**步骤**

1. 在终端容器、内部输入节点和终端外部之间切换焦点。
2. 切换终端标签后返回。

**目视检查**

- 终端内部焦点转移时 ghostty 光标持续正常闪烁。
- 焦点离开时终端光标停止闪烁。
- 终端左上角不出现第二个浏览器 caret 或游离闪烁光标。

### MT-17 国际化键完整性

**步骤**

1. 运行 App 与 UI 的语言键一致性测试。
2. 切换简体中文及任一非英文语言，触发服务器不可用、切换失败和“在文件管理器中显示”等界面。

**目视检查**

- 语言键一致性测试通过，不出现缺失键异常。
- 尚未本地化的新增项安全回退为可读英文，不显示原始 key。

## 上游同步注意事项

- 截至同步分支 `dev` 的 `32f278b48f`，上游和魔改共同修改 14 个文件，集中在 App 布局/输入框、桌面 renderer/窗口、Session UI 和模型生成脚本。
- 上游 `f67e80c275` 对 V2 Prompt 控件使用 keyed 读取；本分支只扩展 `disabled` 状态，两者应同时保留。
- 上游 `2039c90c06` 重构外部链接和桌面通知；本分支的皮肤 Provider、标题栏主题和终端按键逻辑与其位于不同职责区域，合并时应优先保留上游的新 `openExternal` / `openLocalFile` API。
- 上游 `db4dbaa289` 修正标签和新建页的 stale accessor；本分支新增的数据属性及标签样式不应撤销 keyed 读取。
- 上游 `a4f25a94b4` 将默认模型目录改为 `https://models.opencode.ai`；缓存加载已抽到独立模块，未来同步时应保留上游 URL，并继续通过共享加载器读取/刷新缓存。
- 皮肤公共导出位于稳定的 App 导出区，避免与上游删除旧 `handleNotificationClick` 导出发生尾部冲突。

## 压缩前提交对应表

| 原提交 | 标题 | 对应改动 |
| --- | --- | --- |
| `37bcc675d0` | `fix(app): redetect server protocol on retry` | 重建目标服务器上下文并在重试时重新探测协议。 |
| `05019f4e2a` | `fix(core): detect local builds from version` | 将 `local` 版本也纳入本地构建判断。 |
| `bb6af71fae` | `fix(desktop): use prod icons in dev channel builds` | 各渠道统一复制 prod 桌面图标。 |
| `e2618792bf` | `fix(session-ui): show bash output scrollbar and offset copy button` | 恢复 Bash 滚动条并避让复制按钮。 |
| `5930221ee2` | `fix(desktop): fade titlebar divider under window controls` | 共享侧栏宽度并淡出赛道皮肤标题栏分隔线。 |
| `78255e543f` | `fix(desktop): skip Electron checksum download to avoid GitHub access` | 允许离线复用 Electron zip 缓存。 |
| `daef1c3d5d` | `fix(build): reuse models.dev cache, honor OPENCODE_MODELS_REFRESH to force fetch` | 构建生成器缓存 models 快照；压缩前进一步收敛为共享模块。 |
| `c9c78ecefe` | `fix(desktop): blend titlebar into window controls color` | 赛道皮肤标题栏向原生按钮背景过渡。 |
| `e8d0d5ba18` | `fix(desktop): opaque tab backgrounds to remove titlebar color banding` | 使用不透明标签底色消除色带。 |
| `bb3f2dd963` | `fix(desktop): align Windows caption button hover and color with app theme` | Windows 原生按钮跟随主题和皮肤。 |
| `59a9fdf996` | `fix(desktop): inputbox disabled when adding server` | 修复堆叠对话框的输入焦点并增加 E2E。 |
| `ce19d577bb` | `fix(app): keep client message ids monotonic` | 会话级消息 ID 生成、观察与测试。 |
| `3356117746` | `feat(app): color cloud icon by server URL hash` | 远程服务器云图标稳定着色。 |
| `8c9183068f` | `fix(i18n): add missing locale keys for parity test` | 补齐 App/UI 语言键。 |
| `9f7469af3e` | `feat(app): call switchAgent and switchModel endpoints with optimistic UI and rollback on failure` | V2 会话切换 API、乐观 UI、失败回滚和 V1 兼容。 |
| `c59939849a` | `fix(desktop): migrate skin tab backgrounds from --tab-bg to --tab-base/--tab-overlay` | 皮肤标签变量适配新版标签组件。 |
| `7dcb339d46` | `fix(desktop): restore session-new-composer data attribute on prompt input` | 恢复新建页皮肤挂载点。 |
| `ed093225b6` | `fix(desktop): disable background throttling on main window` | 关闭桌面主窗口后台节流。 |
| `a625d2ea9e` | `fix(app): send all keystrokes to terminal when focused` | 终端聚焦时隔离全局快捷键。 |
| `e1fe5a0153` | `fix(app): stop stray blinking cursor at terminal top-left` | 修正 ghostty 焦点监听并隐藏宿主 caret。 |

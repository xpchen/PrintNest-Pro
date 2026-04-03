/**
 * 原生应用菜单：系统 role 与业务 app:command 分离（见计划 §架构）
 */
import { Menu, type MenuItemConstructorOptions, app, BrowserWindow, shell } from 'electron';
import { getAppDataProjectsRoot } from './projectPaths';
import { AppCommand } from '../shared/commands/appCommands';

function sendCommand(getWindow: () => BrowserWindow | null, id: string): void {
  const w = getWindow();
  if (w && !w.webContents.isDestroyed()) {
    w.webContents.send('app:command', { id });
  }
}

export function createApplicationMenu(getWindow: () => BrowserWindow | null): void {
  const cmd = (id: string) => () => sendCommand(getWindow, id);
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: [
      { label: '新建项目', accelerator: 'CmdOrCtrl+N', click: cmd(AppCommand.FILE_NEW_PROJECT) },
      { label: '打开最近项目', accelerator: 'CmdOrCtrl+Shift+O', click: cmd(AppCommand.FILE_OPEN_RECENT) },
      { label: '打开当前项目文件夹', click: cmd(AppCommand.FILE_OPEN_CURRENT_PROJECT_FOLDER) },
      {
        label: '打开所有项目根目录',
        click: () => {
          void shell.openPath(getAppDataProjectsRoot());
        },
      },
      { type: 'separator' },
      { label: '导入图片…', accelerator: 'CmdOrCtrl+I', click: cmd(AppCommand.FILE_IMPORT_IMAGES) },
      { label: '导入 Excel…', click: cmd(AppCommand.FILE_IMPORT_EXCEL) },
      { type: 'separator' },
      { label: '导出当前 PDF…', accelerator: 'CmdOrCtrl+E', click: cmd(AppCommand.FILE_EXPORT_PDF) },
      { label: '导出历史 Run PDF…', click: cmd(AppCommand.FILE_EXPORT_RUN_PDF) },
      { type: 'separator' },
      { label: '关闭项目', click: cmd(AppCommand.FILE_CLOSE_PROJECT) },
      ...(isMac
        ? [{ role: 'close' as const }]
        : [{ label: '退出', accelerator: 'Alt+F4', click: () => app.quit() }]),
    ],
  });

  template.push({
    label: 'Edit',
    submenu: [
      { label: '撤销', accelerator: 'CmdOrCtrl+Z', enabled: false },
      { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', enabled: false },
      { type: 'separator' },
      { label: '删除', accelerator: 'Delete', click: cmd(AppCommand.EDIT_DELETE) },
      { label: '全选', accelerator: 'CmdOrCtrl+A', click: cmd(AppCommand.EDIT_SELECT_ALL) },
      { label: '取消选中', accelerator: 'Escape', click: cmd(AppCommand.EDIT_DESELECT) },
    ],
  });

  template.push({
    label: 'View',
    submenu: [
      { label: '适配整张', accelerator: 'CmdOrCtrl+0', click: cmd(AppCommand.VIEW_FIT_ALL) },
      { label: '适配宽度', accelerator: 'CmdOrCtrl+1', click: cmd(AppCommand.VIEW_FIT_WIDTH) },
      { label: '100% 实际尺寸', accelerator: 'CmdOrCtrl+2', click: cmd(AppCommand.VIEW_ACTUAL_100) },
      { type: 'separator' },
      { label: '放大', accelerator: 'CmdOrCtrl+=', click: cmd(AppCommand.VIEW_ZOOM_IN) },
      { label: '缩小', accelerator: 'CmdOrCtrl+-', click: cmd(AppCommand.VIEW_ZOOM_OUT) },
      { type: 'separator' },
      { label: '切换网格显示', click: cmd(AppCommand.VIEW_TOGGLE_GRID) },
      { label: '切换标尺显示', click: cmd(AppCommand.VIEW_TOGGLE_RULER) },
      { label: '切换安全边线', click: cmd(AppCommand.VIEW_TOGGLE_SAFE_MARGIN) },
      { label: '切换小地图', click: cmd(AppCommand.VIEW_TOGGLE_MINIMAP) },
      { type: 'separator' },
      { label: '切换左侧栏', click: cmd(AppCommand.VIEW_TOGGLE_LEFT_PANEL) },
      { label: '切换右侧栏', click: cmd(AppCommand.VIEW_TOGGLE_RIGHT_PANEL) },
      { label: '切换状态栏', click: cmd(AppCommand.VIEW_TOGGLE_STATUS) },
      { type: 'separator' },
      { label: '跳到卷材头部', click: cmd(AppCommand.VIEW_SEGMENT_HEAD) },
      { label: '跳到卷材中部', click: cmd(AppCommand.VIEW_SEGMENT_MID) },
      { label: '跳到卷材尾部', click: cmd(AppCommand.VIEW_SEGMENT_TAIL) },
      { type: 'separator' },
      { label: '打开 Run 面板', click: cmd(AppCommand.VIEW_OPEN_RUN_PANEL) },
    ],
  });

  template.push({
    label: 'Layout',
    submenu: [
      { label: '自动排版', accelerator: 'CmdOrCtrl+L', click: cmd(AppCommand.LAYOUT_RUN) },
      { label: '取消排版', click: cmd(AppCommand.LAYOUT_CANCEL) },
      { type: 'separator' },
      { label: '切换单画布模式', click: cmd(AppCommand.LAYOUT_TOGGLE_SINGLE_CANVAS) },
    ],
  });

  template.push({
    label: 'Run',
    submenu: [
      { label: '导出最近 Run PDF', click: cmd(AppCommand.RUN_EXPORT_LATEST_PDF) },
    ],
  });

  template.push({
    label: 'Help',
    submenu: [
      { label: '快捷键说明', click: cmd(AppCommand.HELP_SHORTCUTS) },
      ...(isMac ? [] : [{ label: '关于', click: cmd(AppCommand.HELP_ABOUT) }]),
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

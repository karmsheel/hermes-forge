import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("forgeDesktop", {
  isDesktop: true,
  platform: process.platform,
  openVscodeThemeFile: () => ipcRenderer.invoke("theme:open-vscode-file"),
});
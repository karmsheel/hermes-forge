import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("forgeDesktop", {
  isDesktop: true,
  platform: process.platform,
});
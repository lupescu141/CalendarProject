"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const api_1 = require("../scripts/api");
const mysql_1 = require("../src/lib/mysql");
let apiServer;
let shuttingDown = false;
async function createWindow() {
    const staticDir = electron_1.app.isPackaged
        ? node_path_1.default.join(process.resourcesPath, "web")
        : node_path_1.default.resolve(__dirname, "../../dist");
    apiServer = await (0, api_1.startApiServer)({
        host: "127.0.0.1",
        port: 3000,
        staticDir,
    });
    const apiUrl = `http://127.0.0.1:${apiServer.port}`;
    const window = new electron_1.BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    await window.loadURL(`${apiUrl}/sign-in?apiUrl=${encodeURIComponent(apiUrl)}`);
}
electron_1.app.whenReady().then(async () => {
    try {
        await createWindow();
    }
    catch (error) {
        console.error("Could not start CalendarProject:", error);
        electron_1.dialog.showErrorBox("CalendarProject could not start", `The local app services could not start. Ensure MySQL is running and local port 3000 is available, then restart the app.\n\n${error instanceof Error ? error.message : String(error)}`);
        electron_1.app.quit();
    }
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("before-quit", (event) => {
    if (shuttingDown)
        return;
    event.preventDefault();
    shuttingDown = true;
    void (async () => {
        await apiServer?.close();
        await (0, mysql_1.closeDatabase)();
        electron_1.app.quit();
    })().catch((error) => {
        console.error("Could not shut down CalendarProject cleanly:", error);
        electron_1.app.exit(1);
    });
});

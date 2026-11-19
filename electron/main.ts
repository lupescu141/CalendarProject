import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";

import { startApiServer } from "../scripts/api";
import { closeDatabase } from "../src/lib/mysql";

let apiServer: Awaited<ReturnType<typeof startApiServer>> | undefined;
let shuttingDown = false;

async function createWindow() {
  const staticDir = app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.resolve(__dirname, "../../dist");
  apiServer = await startApiServer({
    host: "127.0.0.1",
    port: 3000,
    staticDir,
  });

  const apiUrl = `http://127.0.0.1:${apiServer.port}`;
  const window = new BrowserWindow({
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

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error("Could not start CalendarProject:", error);
    dialog.showErrorBox(
      "CalendarProject could not start",
      `The local app services could not start. Ensure MySQL is running and local port 3000 is available, then restart the app.\n\n${error instanceof Error ? error.message : String(error)}`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shuttingDown = true;

  void (async () => {
    await apiServer?.close();
    await closeDatabase();
    app.quit();
  })().catch((error) => {
    console.error("Could not shut down CalendarProject cleanly:", error);
    app.exit(1);
  });
});

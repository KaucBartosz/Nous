// main/updater.js — Updater (E3): IPC aktualizacji + zdarzenia autoUpdatera.
// Przeniesione 1:1 z main.js. Deps wstrzyknięte; okno przez getMainWindow()
// (guardy `if (mainWindow)` jak wcześniej — poza dev-ścieżką check, też jak wcześniej).

function createUpdater({ app, autoUpdater }) {
  function checkAppUpdate(getMainWindow) {
    if (!app.isPackaged) {
      getMainWindow().webContents.send("app-update-not-available", { version: app.getVersion() });
      return;
    }
    autoUpdater.checkForUpdates();
  }

  function downloadAppUpdate() {
    autoUpdater.downloadUpdate();
  }

  function installAppUpdate() {
    autoUpdater.quitAndInstall();
  }

  function getAppVersion() {
    return app.getVersion();
  }

  function registerIpc(ipcMain, getMainWindow) {
    ipcMain.on("check-app-update", () => checkAppUpdate(getMainWindow));
    ipcMain.on("download-app-update", downloadAppUpdate);
    ipcMain.on("install-app-update", installAppUpdate);
    ipcMain.handle("get-app-version", getAppVersion);
  }

  function registerFeedEvents(getMainWindow) {
    const emit = (channel, payload) => {
      const mainWindow = getMainWindow();
      if (mainWindow) mainWindow.webContents.send(channel, payload);
    };
    autoUpdater.on("checking-for-update", () => emit("app-update-checking"));
    autoUpdater.on("update-available", (info) => emit("app-update-available", info));
    autoUpdater.on("update-not-available", (info) => emit("app-update-not-available", info));
    autoUpdater.on("error", (err) => emit("app-update-error", err.message));
    autoUpdater.on("download-progress", (progressObj) => emit("app-download-progress", progressObj));
    autoUpdater.on("update-downloaded", (info) => emit("app-update-downloaded", info));
  }

  return {
    checkAppUpdate,
    downloadAppUpdate,
    installAppUpdate,
    getAppVersion,
    registerIpc,
    registerFeedEvents,
  };
}

module.exports = { createUpdater };

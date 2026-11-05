const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kopiaUI", {
  updateAndShutdown: function () {
    return ipcRenderer.invoke("update-and-shutdown");
  },
  selectPath: function (options) {
    return ipcRenderer.invoke("select-path", options);
  },
  selectDirectory: function (onSelected) {
    ipcRenderer.invoke("select-dir").then((v) => {
      onSelected(v);
    });
  },
  browseDirectory: function (path) {
    return ipcRenderer.invoke("browse-dir", path);
  },
});

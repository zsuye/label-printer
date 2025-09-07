const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 打印机相关
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printPDF: (pdfPath, printerName, copies) => 
    ipcRenderer.invoke('print-pdf', pdfPath, printerName, copies),
  
  // PDF相关
  generatePDF: (labelData, settings) => 
    ipcRenderer.invoke('generate-pdf', labelData, settings),
  previewPDF: (pdfPath) => ipcRenderer.invoke('preview-pdf', pdfPath),
  
  // 数据存储
  saveData: (key, value) => ipcRenderer.invoke('save-data', key, value),
  getData: (key) => ipcRenderer.invoke('get-data', key),
  deleteData: (key) => ipcRenderer.invoke('delete-data', key),
  getAllLabels: () => ipcRenderer.invoke('get-all-labels'),
  
  // 导入导出
  exportLabels: () => ipcRenderer.invoke('export-labels'),
  importLabels: () => ipcRenderer.invoke('import-labels')
});
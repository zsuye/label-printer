const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const Store = require('electron-store');

const store = new Store();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // 开发时打开DevTools
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 获取打印机列表
ipcMain.handle('get-printers', async () => {
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers;
});

// 保存数据
ipcMain.handle('save-data', (event, key, value) => {
  store.set(key, value);
  return true;
});

// 获取数据
ipcMain.handle('get-data', (event, key) => {
  return store.get(key);
});

// 删除数据
ipcMain.handle('delete-data', (event, key) => {
  store.delete(key);
  return true;
});

// 获取所有标签
ipcMain.handle('get-all-labels', () => {
  return store.get('labels', []);
});

// 导出标签数据
ipcMain.handle('export-labels', async () => {
  const labels = store.get('labels', []);
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `labels_${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(labels, null, 2));
    return true;
  }
  return false;
});

// 导入标签数据
ipcMain.handle('import-labels', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  
  if (filePaths && filePaths.length > 0) {
    const data = fs.readFileSync(filePaths[0], 'utf8');
    const labels = JSON.parse(data);
    store.set('labels', labels);
    return labels;
  }
  return null;
});

// 生成PDF
ipcMain.handle('generate-pdf', async (event, labelData, settings) => {
  const tempPath = path.join(app.getPath('temp'), `label_${Date.now()}.pdf`);
  
  // 设置纸张大小（转换mm到points）
  const mmToPoints = (mm) => mm * 2.83465;
  let width, height;
  
  if (settings.paperSize === 'custom' && settings.customWidth && settings.customHeight) {
    width = mmToPoints(parseFloat(settings.customWidth));
    height = mmToPoints(parseFloat(settings.customHeight));
  } else if (settings.paperSize === '70x70mm') {
    width = mmToPoints(70);
    height = mmToPoints(70);
  } else {
    // 默认 76x130mm
    width = mmToPoints(76);
    height = mmToPoints(130);
  }
  
  const doc = new PDFDocument({
    size: [width, height],
    margins: {
      top: mmToPoints(5),
      bottom: mmToPoints(5),
      left: mmToPoints(5),
      right: mmToPoints(5)
    }
  });
  
  const stream = fs.createWriteStream(tempPath);
  doc.pipe(stream);
  
  // 注册中文字体（需要您提供中文字体文件）
  // 如果没有中文字体，可以使用系统字体或下载开源字体
  try {
    // Windows系统字体路径
    if (process.platform === 'win32') {
      const fontPath = 'C:/Windows/Fonts/simhei.ttf';
      if (fs.existsSync(fontPath)) {
        doc.registerFont('Chinese', fontPath);
      }
    }
  } catch (e) {
    console.log('Font registration failed:', e);
  }
  
  // 可用区域
  const contentWidth = width - mmToPoints(10);
  const contentHeight = height - mmToPoints(10);
  let currentY = mmToPoints(5);
  
  // 设置字体
  const fontSize = Math.min(12, contentWidth / 20);
  doc.fontSize(fontSize);
  
  // 如果品名要独立显示在顶部
  if (settings.showProductNameOnTop && labelData.productName) {
    doc.font('Chinese').fontSize(fontSize * 1.5)
       .text(labelData.productName, mmToPoints(5), currentY, {
         width: contentWidth,
         align: 'center'
       });
    currentY += fontSize * 2;
  }
  
  // 显示各个字段
  const fields = [
    { key: 'productName', label: '品名' },
    { key: 'ingredients', label: '配料' },
    { key: 'standardNo', label: '产品标准号' },
    { key: 'licenseNo', label: '生产许可证号' },
    { key: 'shelfLife', label: '保质期' },
    { key: 'productionDate', label: '生产日期' },
    { key: 'expiryDate', label: '保质期至' },
    { key: 'storageCondition', label: '贮存条件' },
    { key: 'netContent', label: '净含量' },
    { key: 'boxSpec', label: '箱规' },
    { key: 'origin', label: '产地' },
    { key: 'usage', label: '食用方法' },
    { key: 'manufacturer', label: '生产商' },
    { key: 'phone', label: '联系电话' },
    { key: 'address', label: '地址' },
    { key: 'allergen', label: '致敏物质提示' },
    { key: 'tips', label: '温馨提示' }
  ];
  
  doc.fontSize(fontSize);
  
  for (const field of fields) {
    if (labelData[field.key]) {
      // 跳过已经在顶部显示的品名
      if (settings.showProductNameOnTop && field.key === 'productName') {
        continue;
      }
      
      const text = `${field.label}：${labelData[field.key]}`;
      const lines = doc.heightOfString(text, { width: contentWidth });
      
      // 检查是否超出页面
      if (currentY + lines > height - mmToPoints(5)) {
        break;
      }
      
      doc.font('Chinese').text(text, mmToPoints(5), currentY, {
        width: contentWidth,
        align: 'left'
      });
      currentY += lines + 2;
    }
  }
  
  // 显示额外字段
  if (labelData.extraFields && labelData.extraFields.length > 0) {
    for (const field of labelData.extraFields) {
      if (field.label && field.value) {
        const text = `${field.label}：${field.value}`;
        const lines = doc.heightOfString(text, { width: contentWidth });
        
        if (currentY + lines > height - mmToPoints(5)) {
          break;
        }
        
        doc.font('Chinese').text(text, mmToPoints(5), currentY, {
          width: contentWidth,
          align: 'left'
        });
        currentY += lines + 2;
      }
    }
  }
  
  // 如果有营养成分表图片
  if (labelData.nutritionImage) {
    try {
      const remainingHeight = height - mmToPoints(5) - currentY;
      const imageHeight = Math.min(remainingHeight, contentWidth * 0.8);
      
      if (imageHeight > 20) {
        // 将base64转换为buffer
        const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
        doc.image(imageBuffer, mmToPoints(5), currentY, {
          width: contentWidth,
          height: imageHeight,
          fit: [contentWidth, imageHeight]
        });
      }
    } catch (e) {
      console.error('Failed to add nutrition image:', e);
    }
  }
  
  doc.end();
  
  return new Promise((resolve) => {
    stream.on('finish', () => {
      resolve(tempPath);
    });
  });
});

// 打印PDF - 方案一：使用pdf-to-printer（推荐）
ipcMain.handle('print-pdf', async (event, pdfPath, printerName, copies) => {
  try {
    // 根据操作系统选择打印方式
    if (process.platform === 'win32') {
      // Windows: 使用 pdf-to-printer
      const ptp = require('pdf-to-printer');
      
       // 一次性打印多份（pdf-to-printer支持copies参数）
      const options = {
        printer: printerName,
        copies: copies || 1,
        silent: true
      };
      
      await ptp.print(pdfPath, options);
      
      return { success: true };
    } else {
      // macOS/Linux: 使用命令行
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      let command;
      if (process.platform === 'darwin') {
        // macOS
        command = `lpr -P "${printerName}" -# ${copies || 1} "${pdfPath}"`;
      } else {
        // Linux
        command = `lp -d "${printerName}" -n ${copies || 1} "${pdfPath}"`;
      }
      
      await execPromise(command);
      return { success: true };
    }
  } catch (error) {
    console.error('Print error:', error);
    return { success: false, error: error.message };
  }
});

// 打开PDF预览
ipcMain.handle('preview-pdf', async (event, pdfPath) => {
  shell.openPath(pdfPath);
  return true;
});
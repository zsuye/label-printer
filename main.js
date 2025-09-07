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

// 生成PDF - 改进版，支持自适应布局
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
  
  // 判断是否为小尺寸纸张
  const isSmallPaper = width < mmToPoints(75) && height < mmToPoints(75);
  
  // 根据纸张大小调整边距
  const margin = isSmallPaper ? mmToPoints(3) : mmToPoints(5);
  
  const doc = new PDFDocument({
    size: [width, height],
    margins: {
      top: margin,
      bottom: margin,
      left: margin,
      right: margin
    }
  });
  
  const stream = fs.createWriteStream(tempPath);
  doc.pipe(stream);
  
  // 注册中文字体
  try {
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
  const contentWidth = width - (margin * 2);
  const contentHeight = height - (margin * 2);
  let currentY = margin;
  
  // 根据纸张大小动态调整字体大小
  let baseFontSize;
  if (isSmallPaper) {
    baseFontSize = Math.min(8, contentWidth / 30);
  } else {
    baseFontSize = Math.min(12, contentWidth / 20);
  }
  
  // 如果品名要独立显示在顶部
  if (settings.showProductNameOnTop && labelData.productName) {
    doc.font('Chinese').fontSize(baseFontSize * 1.3)
       .text(labelData.productName, margin, currentY, {
         width: contentWidth,
         align: 'center'
       });
    currentY += baseFontSize * 1.8;
  }
  
  // 定义字段顺序和显示
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
  
  doc.fontSize(baseFontSize);
  
  // 根据纸张大小选择布局方式
  if (isSmallPaper) {
    // 小纸张：紧凑布局，多个字段放在同一行
    let lineBuffer = [];
    let lineWidth = 0;
    const separator = '  '; // 两个空格分隔
    const separatorWidth = doc.widthOfString(separator);
    
    // 预留营养成分表空间（下1/3）
    const nutritionHeight = labelData.nutritionImage ? contentHeight * 0.33 : 0;
    const textAreaHeight = contentHeight - nutritionHeight;
    
    for (const field of fields) {
      if (labelData[field.key]) {
        // 跳过已经在顶部显示的品名
        if (settings.showProductNameOnTop && field.key === 'productName') {
          continue;
        }
        
        const text = `${field.label}：${labelData[field.key]}`;
        const textWidth = doc.widthOfString(text);
        
        // 判断是否需要换行
        if (lineWidth + textWidth + (lineBuffer.length > 0 ? separatorWidth : 0) > contentWidth || 
            // 某些字段强制独占一行
            ['ingredients', 'address', 'usage', 'tips', 'allergen'].includes(field.key)) {
          
          // 输出当前行
          if (lineBuffer.length > 0) {
            if (currentY < margin + textAreaHeight - baseFontSize) {
              doc.font('Chinese').text(lineBuffer.join(separator), margin, currentY, {
                width: contentWidth,
                align: 'left'
              });
              currentY += baseFontSize * 1.3;
            }
            lineBuffer = [];
            lineWidth = 0;
          }
          
          // 长文本字段独占行
          if (['ingredients', 'address', 'usage', 'tips', 'allergen'].includes(field.key)) {
            if (currentY < margin + textAreaHeight - baseFontSize) {
              const lines = doc.heightOfString(text, { width: contentWidth });
              doc.font('Chinese').text(text, margin, currentY, {
                width: contentWidth,
                align: 'left'
              });
              currentY += lines + 2;
            }
          } else {
            lineBuffer.push(text);
            lineWidth = textWidth;
          }
        } else {
          // 添加到当前行
          lineBuffer.push(text);
          lineWidth += textWidth + (lineBuffer.length > 1 ? separatorWidth : 0);
        }
      }
    }
    
    // 输出最后一行
    if (lineBuffer.length > 0 && currentY < margin + textAreaHeight - baseFontSize) {
      doc.font('Chinese').text(lineBuffer.join(separator), margin, currentY, {
        width: contentWidth,
        align: 'left'
      });
      currentY += baseFontSize * 1.3;
    }
    
    // 额外字段也采用紧凑布局
    if (labelData.extraFields && labelData.extraFields.length > 0) {
      lineBuffer = [];
      lineWidth = 0;
      
      for (const field of labelData.extraFields) {
        if (field.label && field.value) {
          const text = `${field.label}：${field.value}`;
          const textWidth = doc.widthOfString(text);
          
          if (lineWidth + textWidth + (lineBuffer.length > 0 ? separatorWidth : 0) > contentWidth) {
            if (lineBuffer.length > 0 && currentY < margin + textAreaHeight - baseFontSize) {
              doc.font('Chinese').text(lineBuffer.join(separator), margin, currentY, {
                width: contentWidth,
                align: 'left'
              });
              currentY += baseFontSize * 1.3;
              lineBuffer = [];
              lineWidth = 0;
            }
          }
          
          lineBuffer.push(text);
          lineWidth += textWidth + (lineBuffer.length > 1 ? separatorWidth : 0);
        }
      }
      
      if (lineBuffer.length > 0 && currentY < margin + textAreaHeight - baseFontSize) {
        doc.font('Chinese').text(lineBuffer.join(separator), margin, currentY, {
          width: contentWidth,
          align: 'left'
        });
        currentY += baseFontSize * 1.3;
      }
    }
    
  } else {
    // 大纸张：传统的一行一个字段布局
    for (const field of fields) {
      if (labelData[field.key]) {
        // 跳过已经在顶部显示的品名
        if (settings.showProductNameOnTop && field.key === 'productName') {
          continue;
        }
        
        const text = `${field.label}：${labelData[field.key]}`;
        const lines = doc.heightOfString(text, { width: contentWidth });
        
        // 检查是否超出页面
        if (currentY + lines > height - margin) {
          break;
        }
        
        doc.font('Chinese').text(text, margin, currentY, {
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
          
          if (currentY + lines > height - margin) {
            break;
          }
          
          doc.font('Chinese').text(text, margin, currentY, {
            width: contentWidth,
            align: 'left'
          });
          currentY += lines + 2;
        }
      }
    }
  }
  
  // 如果有营养成分表图片
  if (labelData.nutritionImage) {
    try {
      let imageY, imageHeight;
      
      if (isSmallPaper) {
        // 小纸张：确保图片在下1/3区域
        const nutritionAreaHeight = contentHeight * 0.33;
        const nutritionStartY = height - margin - nutritionAreaHeight;
        
        // 确保文字不会进入营养成分表区域
        if (currentY > nutritionStartY) {
          // 文字已经进入营养区域，需要调整
          console.log('Warning: Text overflow into nutrition area');
        }
        
        imageY = Math.max(nutritionStartY, currentY + 5); // 留5点间隔
        imageHeight = Math.min(nutritionAreaHeight - 5, height - margin - imageY);
      } else {
        // 大纸张：在文字下方显示
        const remainingHeight = height - margin - currentY;
        imageY = currentY + 5;
        imageHeight = Math.min(remainingHeight - 5, contentWidth * 0.8);
      }
      
      if (imageHeight > 10) {
        // 将base64转换为buffer
        const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
        doc.image(imageBuffer, margin, imageY, {
          width: contentWidth,
          height: imageHeight,
          fit: [contentWidth, imageHeight],
          align: 'center',
          valign: 'center'
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

// 打印PDF
ipcMain.handle('print-pdf', async (event, pdfPath, printerName, copies) => {
  try {
    if (process.platform === 'win32') {
      const ptp = require('pdf-to-printer');
      
      const options = {
        printer: printerName,
        copies: copies || 1,
        silent: true
      };
      
      await ptp.print(pdfPath, options);
      return { success: true };
    } else {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      let command;
      if (process.platform === 'darwin') {
        command = `lpr -P "${printerName}" -# ${copies || 1} "${pdfPath}"`;
      } else {
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
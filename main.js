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
  } else if (settings.paperSize === '70x100mm') {
    width = mmToPoints(70);
    height = mmToPoints(100);
  } else {
    // 默认 76x130mm
    width = mmToPoints(76);
    height = mmToPoints(130);
  }
  
  // 判断纸张类型
  const isSmallPaper = settings.paperSize === '70x70mm';
  const isMediumPaper = settings.paperSize === '70x100mm';
  
  // 根据纸张大小调整边距
  const margin = isSmallPaper||isMediumPaper ? mmToPoints(3) : mmToPoints(5);
  
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
    baseFontSize = 8;
  } else if (isMediumPaper) {
    baseFontSize = 8; // 70x100mm使用8号字体
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

  // 角标处理
  if (labelData.cornerTag) {
    const tagText = labelData.cornerTag;
    const tagFontSize = 8;
    const tagPadding = 2;
    
    doc.font('Chinese').fontSize(tagFontSize);
    
    const tagWidth = Math.min(doc.widthOfString(tagText) + (tagPadding * 2), mmToPoints(15));
    const tagHeight = tagFontSize + (tagPadding * 2);
    
    const tagX = width - margin - tagWidth - mmToPoints(2);
    const tagY = margin;
    
    doc.rect(tagX, tagY, tagWidth, tagHeight).stroke();
    
    doc.text(tagText, tagX + tagPadding, tagY + tagPadding, {
      width: tagWidth - (tagPadding * 2),
      height: tagHeight - (tagPadding * 2),
      align: 'center',
      lineBreak: true
    });
    
    doc.fontSize(baseFontSize);
  }
  
  // 根据纸张类型选择布局方式
  if (isSmallPaper) {
    // 小纸张：完全不分行，连续文本流布局
    let fullText = '';
    const separator = ' | ';
    
    const nutritionHeight = labelData.nutritionImage ? contentHeight * 0.33 : 0;
    const textAreaHeight = contentHeight - nutritionHeight;
    
    for (const field of fields) {
      if (labelData[field.key]) {
        if (fullText) {
          fullText += separator;
        }
        fullText += `${field.label}：${labelData[field.key]}`;
      }
    }
    
    if (labelData.extraFields && labelData.extraFields.length > 0) {
      for (const field of labelData.extraFields) {
        if (field.label && field.value) {
          if (fullText) {
            fullText += separator;
          }
          fullText += `${field.label}：${field.value}`;
        }
      }
    }
    
    if (fullText) {
      const maxTextHeight = textAreaHeight - 5;
      
      const textOptions = {
        width: contentWidth,
        align: 'left',
        lineBreak: true,
        wordSpacing: 0,
        characterSpacing: 0,
        lineGap: -1,
        paragraphGap: 0
      };
      
      const textHeight = doc.heightOfString(fullText, textOptions);
      
      if (textHeight > maxTextHeight) {
        doc.fontSize(baseFontSize * 0.9);
      }
      
      doc.font('Chinese').text(fullText, margin, currentY, textOptions);
      currentY = margin + Math.min(textHeight, maxTextHeight);
    }
  } else {
    // 中等纸张（70x100mm）和大纸张：传统的一行一个字段布局
    for (const field of fields) {
      if (labelData[field.key]) {
        const text = `${field.label}：${labelData[field.key]}`;
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
  
  // 营养成分表图片处理
  if (labelData.nutritionImage) {
    try {
      let imageY, imageHeight;
      
      if (isSmallPaper) {
        // 小纸张：固定使用底部1/3空间
        const totalUsableHeight = height - (margin * 2);
        imageHeight = totalUsableHeight * 0.4;
        imageY = height - margin - imageHeight;
        
        if (imageHeight > 15) {
          const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
          doc.image(imageBuffer, margin, imageY, {
            width: contentWidth,
            height: imageHeight
          });
        }
      } else if (isMediumPaper) {
        // 70x100mm：营养成分表压缩到1/4
        const totalUsableHeight = height - (margin * 2);
        imageHeight = totalUsableHeight * 0.2; // 1/5高度
        imageY = height - margin - imageHeight;
        
        if (imageHeight > 10) {
          const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
          doc.image(imageBuffer, margin, imageY, {
            width: contentWidth,
            height: imageHeight
          });
        }
      } else {
        // 大纸张：在文字下方显示，保持宽高比
        const remainingHeight = height - margin - currentY;
        imageY = currentY + 5;
        imageHeight = Math.min(remainingHeight - 5, contentWidth * 0.8);
        
        if (imageHeight > 10) {
          const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
          doc.image(imageBuffer, margin, imageY, {
            width: contentWidth,
            height: imageHeight,
            fit: [contentWidth, imageHeight],
            align: 'center',
            valign: 'center'
          });
        }
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
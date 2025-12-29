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
ipcMain.handle('get-printers', async () => {
  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers;
});
ipcMain.handle('save-data', (event, key, value) => {
  store.set(key, value);
  return true;
});
ipcMain.handle('get-data', (event, key) => {
  return store.get(key);
});
ipcMain.handle('delete-data', (event, key) => {
  store.delete(key);
  return true;
});
ipcMain.handle('get-all-labels', () => {
  return store.get('labels', []);
});
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
ipcMain.handle('generate-pdf', async (event, labelData, settings) => {
  const tempPath = path.join(app.getPath('temp'), `label_${Date.now()}.pdf`);
  const mmToPoints = (mm) => mm * 2.83465;
  let width, height;
  if (settings.paperSize === 'custom' && settings.customWidth && settings.customHeight) {
    width = mmToPoints(parseFloat(settings.customWidth));
    height = mmToPoints(parseFloat(settings.customHeight));
  } else if (settings.paperSize === '70x70mm') {
    width = mmToPoints(70);
    height = mmToPoints(70);
  } else if (settings.paperSize === '60x80mm') {
    // 60x80mm纸张 - PDF高度设大补偿打印机下移，但内容按实际高度布局
    width = mmToPoints(60);
    height = mmToPoints(100);  // PDF高度100mm
  } else if (settings.paperSize === '70x100mm') {
    width = mmToPoints(70);
    height = mmToPoints(100);
  } else {
    width = mmToPoints(76);
    height = mmToPoints(130);
  }
  // 60x80mm与70x70mm使用相同的小纸张逻辑
  const isSmallPaper = settings.paperSize === '70x70mm' || settings.paperSize === '60x80mm';
  const is60x80Paper = settings.paperSize === '60x80mm';
  const isMediumPaper = settings.paperSize === '70x100mm';
  const isBulkFood = settings.isBulkFood;
  
  // 60x80mm的实际纸张高度（用于营养成分表等底部元素定位）
  const actualPaperHeight = is60x80Paper ? mmToPoints(80) : height;
  
  // 边距设置
  let topMargin, sideMargin, bottomMargin;
  
  if (is60x80Paper) {
    topMargin = mmToPoints(2);      // 上边距2mm
    sideMargin = mmToPoints(2);     // 左右边距2mm
    bottomMargin = mmToPoints(2);   // 下边距2mm
  } else if (isSmallPaper || isMediumPaper) {
    topMargin = sideMargin = bottomMargin = mmToPoints(3);
  } else {
    topMargin = sideMargin = bottomMargin = mmToPoints(5);
  }
  
  const doc = new PDFDocument({
    size: [width, height],
    margins: {
      top: topMargin,
      bottom: bottomMargin,
      left: sideMargin,
      right: sideMargin
    }
  });
  const stream = fs.createWriteStream(tempPath);
  doc.pipe(stream);
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
  const contentWidth = width - (sideMargin * 2);
  // 使用actualPaperHeight计算内容高度，确保60x80mm布局正确
  const contentHeight = actualPaperHeight - topMargin - bottomMargin;
  let currentY = topMargin;
  
  let baseFontSize;
  if (isBulkFood) {
    if (isSmallPaper) {
      baseFontSize = 9;
    } else if (isMediumPaper) {
      baseFontSize = 10;
    } else {
      baseFontSize = Math.min(14, contentWidth / 18);
    }
  } else {
    if (isSmallPaper) {
      baseFontSize = 8;
    } else if (isMediumPaper) {
      baseFontSize = 8;
    } else {
      baseFontSize = Math.min(12, contentWidth / 20);
    }
  }
  if (isBulkFood) {
    doc.font('Chinese').fontSize(baseFontSize * 1.4)
       .text('散装食品标签', sideMargin, currentY, {
         width: contentWidth,
         align: 'center'
       });
    const textWidth = doc.widthOfString('散装食品标签');
    const lineY = currentY + baseFontSize * 1.5;
    const lineStartX = sideMargin + (contentWidth - textWidth) / 2;
    doc.moveTo(lineStartX, lineY)
       .lineTo(lineStartX + textWidth, lineY)
       .stroke();
    currentY += baseFontSize * 2.2;
  } else if (settings.showProductNameOnTop && labelData.productName) {
    doc.font('Chinese').fontSize(baseFontSize * 1.3)
       .text(labelData.productName, sideMargin, currentY, {
         width: contentWidth,
         align: 'center'
       });
    currentY += baseFontSize * 1.8;
  }
  let fields;
  if (isBulkFood) {
    fields = [
      { key: 'productName', label: '产品名称' },
      { key: 'origin', label: '产地' },
      { key: 'ingredients', label: '配料' },
      { key: 'licenseNo', label: '生产许可证号' },
      { key: 'productionDateBulk', label: '生产日期' },
      { key: 'shelfLife', label: '保质期' }
    ];
    if (labelData.packingDate) {
      fields.push({ key: 'packingDate', label: '分装日期' });
    }
    fields.push(
      { key: 'storageCondition', label: '贮存条件' },
      { key: 'usage', label: '食用方法' },
      { key: 'manufacturer', label: '生产商' },
      { key: 'address', label: '生产商地址' },
      { key: 'phone', label: '生产商电话' },
      { key: 'operator', label: '经营者' },
      { key: 'operatorPhone', label: '经营者电话' },
      { key: 'tips', label: '温馨提示' }
    );
  } else {
    fields = [
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
  }
  doc.fontSize(baseFontSize);
  if (labelData.cornerTag) {
    const tagText = labelData.cornerTag;
    const tagFontSize = 8;
    const tagPadding = 2;
    doc.font('Chinese').fontSize(tagFontSize);
    const tagWidth = Math.min(doc.widthOfString(tagText) + (tagPadding * 2), mmToPoints(15));
    const tagHeight = tagFontSize + (tagPadding * 2);
    const tagX = width - sideMargin - tagWidth - mmToPoints(2);
    const tagY = topMargin;
    doc.rect(tagX, tagY, tagWidth, tagHeight).stroke();
    doc.text(tagText, tagX + tagPadding, tagY + tagPadding, {
      width: tagWidth - (tagPadding * 2),
      height: tagHeight - (tagPadding * 2),
      align: 'center',
      lineBreak: true
    });
    doc.fontSize(baseFontSize);
  }
  if (isSmallPaper) {
    let fullText = '';
    const separator = '   ';
    const nutritionHeight = (!isBulkFood && labelData.nutritionImage) ? contentHeight * 0.33 : 0;
    const textAreaHeight = contentHeight - nutritionHeight;
    for (const field of fields) {
      if (labelData[field.key]) {
        if (fullText) {
          fullText += separator;
        }
        fullText += `${field.label}：${labelData[field.key]}`;
      }
    }
    // 预包装食品的额外字段
    if (!isBulkFood && labelData.extraFields && labelData.extraFields.length > 0) {
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
        lineGap: isBulkFood ? 1 : -1,
        paragraphGap: 0
      };
      const textHeight = doc.heightOfString(fullText, textOptions);
      if (textHeight > maxTextHeight) {
        doc.fontSize(baseFontSize * 0.9);
      }
      doc.font('Chinese').text(fullText, sideMargin, currentY, textOptions);
      currentY = topMargin + Math.min(textHeight, maxTextHeight);
    }
  } else {
    const lineGap = isBulkFood ? 3 : 2;
    for (const field of fields) {
      if (labelData[field.key]) {
        const text = `${field.label}：${labelData[field.key]}`;
        const lines = doc.heightOfString(text, { width: contentWidth });
        if (currentY + lines > height - bottomMargin) {
          break;
        }
        doc.font('Chinese').text(text, sideMargin, currentY, {
          width: contentWidth,
          align: 'left'
        });
        currentY += lines + lineGap;
      }
    }
    if (!isBulkFood && labelData.extraFields && labelData.extraFields.length > 0) {
      for (const field of labelData.extraFields) {
        if (field.label && field.value) {
          const text = `${field.label}：${field.value}`;
          const lines = doc.heightOfString(text, { width: contentWidth });
          if (currentY + lines > height - bottomMargin) {
            break;
          }
          doc.font('Chinese').text(text, sideMargin, currentY, {
            width: contentWidth,
            align: 'left'
          });
          currentY += lines + 2;
        }
      }
    }
  }
  if (!isBulkFood && labelData.nutritionImage) {
    try {
      let imageY, imageHeight;
      if (isSmallPaper) {
        // 使用actualPaperHeight而非height，确保60x80mm营养成分表位置正确
        const totalUsableHeight = actualPaperHeight - topMargin - bottomMargin;
        imageHeight = totalUsableHeight * 0.4;
        imageY = actualPaperHeight - bottomMargin - imageHeight;
        if (imageHeight > 15) {
          const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
          doc.image(imageBuffer, sideMargin, imageY, {
            width: contentWidth,
            height: imageHeight
          });
        }
      } else if (isMediumPaper) {
        const totalUsableHeight = height - topMargin - bottomMargin;
        imageHeight = totalUsableHeight * 0.3;
        imageY = height - bottomMargin - imageHeight;
        if (imageHeight > 10) {
          const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
          doc.image(imageBuffer, sideMargin, imageY, {
            width: contentWidth,
            height: imageHeight
          });
        }
      } else {
        const remainingHeight = height - bottomMargin - currentY;
        imageY = currentY + 5;
        imageHeight = Math.min(remainingHeight - 5, contentWidth * 0.8);
        if (imageHeight > 10) {
          const imageBuffer = Buffer.from(labelData.nutritionImage.split(',')[1], 'base64');
          doc.image(imageBuffer, sideMargin, imageY, {
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
ipcMain.handle('preview-pdf', async (event, pdfPath) => {
  shell.openPath(pdfPath);
  return true;
});
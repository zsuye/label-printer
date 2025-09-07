// 全局变量
let labels = [];
let currentLabel = null;
let inputHistory = {};
let currentPdfPath = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await loadLabels();
    await loadPrinters();
    loadInputHistory();
    setupEventListeners();
    setupInputMemory();
    
    // 设置今天的日期为默认生产日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('productionDate').value = today;
});

// 加载标签列表
async function loadLabels() {
    labels = await window.electronAPI.getAllLabels() || [];
    renderLabelList();
}

// 渲染标签列表
function renderLabelList() {
    const labelList = document.getElementById('labelList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    // 按品名排序
    const sortedLabels = [...labels].sort((a, b) => 
        (a.productName || '').localeCompare(b.productName || '', 'zh-CN')
    );
    
    // 过滤搜索结果
    const filteredLabels = sortedLabels.filter(label => 
        (label.productName || '').toLowerCase().includes(searchTerm)
    );
    
    labelList.innerHTML = '';
    
    filteredLabels.forEach((label, index) => {
        const item = document.createElement('div');
        item.className = 'label-item';
        item.dataset.id = label.id;
        
        if (currentLabel && currentLabel.id === label.id) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="label-item-name">${label.productName || '未命名标签'}</div>
            <div class="label-item-info">${label.manufacturer || ''} ${label.netContent || ''}</div>
        `;
        
        item.addEventListener('click', () => selectLabel(label));
        labelList.appendChild(item);
    });
}

// 选择标签
function selectLabel(label) {
    currentLabel = label;
    
    // 更新列表选中状态
    document.querySelectorAll('.label-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === label.id) {
            item.classList.add('active');
        }
    });
    
    // 显示编辑器视图
    document.getElementById('welcomeView').style.display = 'none';
    document.getElementById('editorView').style.display = 'flex';
    
    // 填充表单
    fillForm(label);
    
    // 加载该标签的打印设置
    loadLabelSettings(label.id);
    
    // 清空预览
    document.getElementById('previewContent').innerHTML = '<p>点击预览按钮查看标签效果</p>';
}

// 填充表单
function fillForm(label) {
    document.getElementById('productName').value = label.productName || '';
    document.getElementById('ingredients').value = label.ingredients || '';
    document.getElementById('standardNo').value = label.standardNo || '';
    document.getElementById('licenseNo').value = label.licenseNo || '';
    document.getElementById('netContent').value = label.netContent || '';
    document.getElementById('boxSpec').value = label.boxSpec || '';
    document.getElementById('origin').value = label.origin || '';
    document.getElementById('usage').value = label.usage || '';
    document.getElementById('manufacturer').value = label.manufacturer || '';
    document.getElementById('phone').value = label.phone || '';
    document.getElementById('address').value = label.address || '';
    document.getElementById('allergen').value = label.allergen || '';
    document.getElementById('tips').value = label.tips || '';
    
    // 保质期类型
    document.getElementById('shelfLifeType').value = label.shelfLifeType || 'normal';
    updateShelfLifeInputs();
    
    if (label.normalDays) {
        document.getElementById('normalDays').value = label.normalDays;
    }
    if (label.frozenDays) {
        document.getElementById('frozenDays').value = label.frozenDays;
    }
    
    // 营养成分表图片
    if (label.nutritionImage) {
        const preview = document.getElementById('nutritionPreview');
        preview.innerHTML = `<img src="${label.nutritionImage}" alt="营养成分表">`;
    } else {
        document.getElementById('nutritionPreview').innerHTML = '';
    }
    
    // 额外字段
    renderExtraFields(label.extraFields || []);
}

// 渲染额外字段
function renderExtraFields(fields) {
    const container = document.getElementById('extraFields');
    container.innerHTML = '';
    
    fields.forEach((field, index) => {
        const div = document.createElement('div');
        div.className = 'extra-field';
        div.innerHTML = `
            <input type="text" placeholder="字段名称" value="${field.label || ''}" data-field="label">
            <input type="text" placeholder="字段值" value="${field.value || ''}" data-field="value">
            <button type="button" class="btn btn-small" onclick="removeExtraField(${index})">删除</button>
        `;
        container.appendChild(div);
    });
}

// 添加额外字段
function addExtraField() {
    const container = document.getElementById('extraFields');
    const div = document.createElement('div');
    div.className = 'extra-field';
    div.innerHTML = `
        <input type="text" placeholder="字段名称" data-field="label">
        <input type="text" placeholder="字段值" data-field="value">
        <button type="button" class="btn btn-small" onclick="removeExtraField(this)">删除</button>
    `;
    container.appendChild(div);
}

// 删除额外字段
function removeExtraField(indexOrElement) {
    if (typeof indexOrElement === 'number') {
        renderExtraFields(getExtraFields().filter((_, i) => i !== indexOrElement));
    } else {
        indexOrElement.parentElement.remove();
    }
}

// 获取额外字段数据
function getExtraFields() {
    const fields = [];
    document.querySelectorAll('#extraFields .extra-field').forEach(field => {
        const label = field.querySelector('[data-field="label"]').value;
        const value = field.querySelector('[data-field="value"]').value;
        if (label || value) {
            fields.push({ label, value });
        }
    });
    return fields;
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索
    document.getElementById('searchInput').addEventListener('input', renderLabelList);
    
    // 新增标签
    document.getElementById('addLabelBtn').addEventListener('click', createNewLabel);
    
    // 导入导出
    document.getElementById('importBtn').addEventListener('click', importLabels);
    document.getElementById('exportBtn').addEventListener('click', exportLabels);
    
    // 保质期类型变化
    document.getElementById('shelfLifeType').addEventListener('change', updateShelfLifeInputs);
    
    // 纸张大小变化
    document.getElementById('paperSize').addEventListener('change', (e) => {
        const customInputs = document.getElementById('customSizeInputs');
        customInputs.style.display = e.target.value === 'custom' ? 'flex' : 'none';
    });
    
    // 营养成分表上传
    document.getElementById('nutritionImage').addEventListener('change', handleImageUpload);
    
    // 表单提交
    document.getElementById('labelForm').addEventListener('submit', saveLabel);
    
    // 删除标签
    document.getElementById('deleteLabelBtn').addEventListener('click', deleteCurrentLabel);
    
    // 添加额外字段
    document.getElementById('addExtraFieldBtn').addEventListener('click', addExtraField);
    
    // 预览和打印
    document.getElementById('previewBtn').addEventListener('click', previewLabel);
    document.getElementById('printBtn').addEventListener('click', printLabel);
    
    // 生产日期变化时更新保质期至
    document.getElementById('productionDate').addEventListener('change', updateExpiryDate);
}

// 更新保质期输入框
function updateShelfLifeInputs() {
    const type = document.getElementById('shelfLifeType').value;
    const normalDays = document.getElementById('normalDays');
    const frozenDays = document.getElementById('frozenDays');
    
    switch(type) {
        case 'dual':
            normalDays.style.display = 'block';
            frozenDays.style.display = 'block';
            normalDays.placeholder = '常温天数';
            break;
        case 'frozen':
            normalDays.style.display = 'none';
            frozenDays.style.display = 'block';
            frozenDays.placeholder = '冷冻天数';
            break;
        default:
            normalDays.style.display = 'block';
            frozenDays.style.display = 'none';
            normalDays.placeholder = '保质天数';
    }
}

// 处理图片上传
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const preview = document.getElementById('nutritionPreview');
        preview.innerHTML = `<img src="${event.target.result}" alt="营养成分表">`;
        
        // 保存到当前标签
        if (currentLabel) {
            currentLabel.nutritionImage = event.target.result;
        }
    };
    reader.readAsDataURL(file);
}

// 创建新标签
function createNewLabel() {
    const label = {
        id: Date.now().toString(),
        productName: '新标签',
        createdAt: new Date().toISOString()
    };
    
    labels.push(label);
    saveLabelsToStorage();
    renderLabelList();
    selectLabel(label);
}

// 保存标签
async function saveLabel(e) {
    e.preventDefault();
    
    if (!currentLabel) return;
    
    // 收集表单数据
    currentLabel.productName = document.getElementById('productName').value;
    currentLabel.ingredients = document.getElementById('ingredients').value;
    currentLabel.standardNo = document.getElementById('standardNo').value;
    currentLabel.licenseNo = document.getElementById('licenseNo').value;
    currentLabel.shelfLifeType = document.getElementById('shelfLifeType').value;
    currentLabel.normalDays = document.getElementById('normalDays').value;
    currentLabel.frozenDays = document.getElementById('frozenDays').value;
    currentLabel.netContent = document.getElementById('netContent').value;
    currentLabel.boxSpec = document.getElementById('boxSpec').value;
    currentLabel.origin = document.getElementById('origin').value;
    currentLabel.usage = document.getElementById('usage').value;
    currentLabel.manufacturer = document.getElementById('manufacturer').value;
    currentLabel.phone = document.getElementById('phone').value;
    currentLabel.address = document.getElementById('address').value;
    currentLabel.allergen = document.getElementById('allergen').value;
    currentLabel.tips = document.getElementById('tips').value;
    currentLabel.extraFields = getExtraFields();
    
    // 更新保质期和贮存条件文本
    currentLabel.shelfLife = generateShelfLifeText(currentLabel);
    currentLabel.storageCondition = generateStorageCondition(currentLabel);
    
    // 保存到存储
    saveLabelsToStorage();
    renderLabelList();
    
    // 保存输入历史
    saveInputHistory();
    
    alert('标签保存成功！');
}

// 生成保质期文本
function generateShelfLifeText(label) {
    const type = label.shelfLifeType;
    const normal = label.normalDays;
    const frozen = label.frozenDays;
    
    switch(type) {
        case 'normalWithCold':
            return `常温${normal}天，开封后需冷藏`;
        case 'normalWithFrozen':
            return `常温${normal}天，开封后需冷冻`;
        case 'frozen':
            return `冷冻${frozen}天`;
        case 'dual':
            return `常温${normal}天，冷冻${frozen}天`;
        default:
            return `${normal}天`;
    }
}

// 生成贮存条件
function generateStorageCondition(label) {
    const type = label.shelfLifeType;
    
    switch(type) {
        case 'normalWithCold':
            return '常温保存，开封后需冷藏';
        case 'normalWithFrozen':
            return '常温保存，开封后需冷冻';
        case 'frozen':
            return '冷冻保存（≤-18℃）';
        case 'dual':
            return '常温保存或冷冻保存（≤-18℃）';
        default:
            return '常温保存，避免阳光直射';
    }
}

// 删除当前标签
async function deleteCurrentLabel() {
    if (!currentLabel) return;
    
    if (!window.confirm(`确定要删除标签"${currentLabel.productName}"吗？`)) {
        return;
    }
    
    labels = labels.filter(l => l.id !== currentLabel.id);
    saveLabelsToStorage();
    
    currentLabel = null;
    document.getElementById('welcomeView').style.display = 'flex';
    document.getElementById('editorView').style.display = 'none';
    
    renderLabelList();
}

// 保存标签到存储
async function saveLabelsToStorage() {
    await window.electronAPI.saveData('labels', labels);
}

// 加载打印机列表
async function loadPrinters() {
    const printers = await window.electronAPI.getPrinters();
    const select = document.getElementById('printerSelect');
    
    select.innerHTML = '<option value="">选择打印机...</option>';
    printers.forEach(printer => {
        const option = document.createElement('option');
        option.value = printer.name;
        option.textContent = printer.displayName || printer.name;
        if (printer.isDefault) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// 加载标签设置
async function loadLabelSettings(labelId) {
    const settings = await window.electronAPI.getData(`labelSettings_${labelId}`) || {};
    
    if (settings.paperSize) {
        document.getElementById('paperSize').value = settings.paperSize;
        if (settings.paperSize === 'custom') {
            document.getElementById('customSizeInputs').style.display = 'flex';
            document.getElementById('customWidth').value = settings.customWidth || '';
            document.getElementById('customHeight').value = settings.customHeight || '';
        }
    }
    
    if (settings.showProductNameOnTop !== undefined) {
        document.getElementById('showProductNameOnTop').checked = settings.showProductNameOnTop;
    }
    
    // 加载上次的生产日期
    const lastProductionDate = await window.electronAPI.getData('lastProductionDate');
    if (lastProductionDate) {
        document.getElementById('productionDate').value = lastProductionDate;
    }
}

// 保存标签设置
async function saveLabelSettings() {
    if (!currentLabel) return;
    
    const settings = {
        paperSize: document.getElementById('paperSize').value,
        customWidth: document.getElementById('customWidth').value,
        customHeight: document.getElementById('customHeight').value,
        showProductNameOnTop: document.getElementById('showProductNameOnTop').checked
    };
    
    await window.electronAPI.saveData(`labelSettings_${currentLabel.id}`, settings);
    
    // 保存生产日期
    const productionDate = document.getElementById('productionDate').value;
    if (productionDate) {
        await window.electronAPI.saveData('lastProductionDate', productionDate);
    }
}

// 更新保质期至日期
function updateExpiryDate() {
    if (!currentLabel) return;
    
    const productionDate = document.getElementById('productionDate').value;
    if (!productionDate) return;
    
    const date = new Date(productionDate);
    let expiryText = '';
    
    const type = currentLabel.shelfLifeType;
    const normal = parseInt(currentLabel.normalDays);
    const frozen = parseInt(currentLabel.frozenDays);
    
    if (type === 'dual' && normal && frozen) {
        const normalExpiry = new Date(date);
        normalExpiry.setDate(normalExpiry.getDate() + normal);
        const frozenExpiry = new Date(date);
        frozenExpiry.setDate(frozenExpiry.getDate() + frozen);
        
        expiryText = `常温${formatDate(normalExpiry)}，冷冻${formatDate(frozenExpiry)}`;
    } else if (type === 'frozen' && frozen) {
        const expiry = new Date(date);
        expiry.setDate(expiry.getDate() + frozen);
        expiryText = formatDate(expiry);
    } else if (normal) {
        const expiry = new Date(date);
        expiry.setDate(expiry.getDate() + normal);
        expiryText = formatDate(expiry);
    }
    
    currentLabel.expiryDate = expiryText;
    return expiryText;
}

// 格式化日期
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
}

// 预览标签
async function previewLabel() {
    if (!currentLabel) {
        alert('请先选择一个标签');
        return;
    }
    
    const productionDate = document.getElementById('productionDate').value;
    if (!productionDate) {
        alert('请输入生产日期');
        return;
    }
    
    // 保存设置
    await saveLabelSettings();
    
    // 准备标签数据
    const labelData = {
        ...currentLabel,
        productionDate: formatDate(new Date(productionDate)),
        expiryDate: updateExpiryDate()
    };
    
    // 获取打印设置
    const settings = {
        paperSize: document.getElementById('paperSize').value,
        customWidth: document.getElementById('customWidth').value,
        customHeight: document.getElementById('customHeight').value,
        showProductNameOnTop: document.getElementById('showProductNameOnTop').checked
    };
    
    // 生成PDF
    currentPdfPath = await window.electronAPI.generatePDF(labelData, settings);
    
    // 显示预览内容
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = generatePreviewHTML(labelData, settings);
    
    // 可选：打开PDF预览
    // await window.electronAPI.previewPDF(currentPdfPath);
}

// 生成预览HTML
function generatePreviewHTML(labelData, settings) {
    let html = '';
    
    if (settings.showProductNameOnTop && labelData.productName) {
        html += `<div style="text-align:center;font-size:16px;font-weight:bold;margin-bottom:10px;">${labelData.productName}</div>`;
    }
    
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
    
    fields.forEach(field => {
        if (labelData[field.key]) {
            if (settings.showProductNameOnTop && field.key === 'productName') {
                return;
            }
            html += `<div><strong>${field.label}：</strong>${labelData[field.key]}</div>`;
        }
    });
    
    // 额外字段
    if (labelData.extraFields && labelData.extraFields.length > 0) {
        labelData.extraFields.forEach(field => {
            if (field.label && field.value) {
                html += `<div><strong>${field.label}：</strong>${field.value}</div>`;
            }
        });
    }
    
    // 营养成分表
    if (labelData.nutritionImage) {
        html += `<div style="margin-top:10px;"><img src="${labelData.nutritionImage}" style="max-width:100%;"></div>`;
    }
    
    return html;
}

// 打印标签
async function printLabel() {
    if (!currentLabel) {
        alert('请先选择一个标签');
        return;
    }
    
    const productionDate = document.getElementById('productionDate').value;
    if (!productionDate) {
        alert('请输入生产日期');
        return;
    }
    
    const printer = document.getElementById('printerSelect').value;
    if (!printer) {
        alert('请选择打印机');
        return;
    }
    
    const copies = parseInt(document.getElementById('printCopies').value) || 1;
    
    // 如果还没有生成PDF，先生成
    if (!currentPdfPath) {
        await previewLabel();
    }
    
    // 打印
    const result = await window.electronAPI.printPDF(currentPdfPath, printer, copies);
    
    if (result.success) {
        alert(`成功发送到打印机，共${copies}份`);
    } else {
        alert(`打印失败：${result.error || '未知错误'}`);
    }
}

// 导入标签
async function importLabels() {
    const imported = await window.electronAPI.importLabels();
    if (imported) {
        labels = imported;
        renderLabelList();
        alert('导入成功！');
    }
}

// 导出标签
async function exportLabels() {
    const success = await window.electronAPI.exportLabels();
    if (success) {
        alert('导出成功！');
    }
}

// 输入记忆功能
function setupInputMemory() {
    const inputs = document.querySelectorAll('input[type="text"], textarea');
    
    inputs.forEach(input => {
        // 获取输入历史
        input.addEventListener('focus', (e) => {
            showSuggestions(e.target);
        });
        
        // 更新输入历史
        input.addEventListener('blur', (e) => {
            updateInputHistory(e.target.id, e.target.value);
            hideSuggestions();
        });
        
        // 键盘导航
        input.addEventListener('keydown', (e) => {
            handleSuggestionNavigation(e);
        });
    });
}

// 显示建议列表
function showSuggestions(input) {
    const fieldId = input.id;
    const history = inputHistory[fieldId] || [];
    const currentValue = input.value.toLowerCase();
    
    const filtered = history.filter(item => 
        item.toLowerCase().includes(currentValue)
    );
    
    if (filtered.length === 0) return;
    
    const suggestionList = document.getElementById('suggestionList');
    suggestionList.innerHTML = '';
    
    filtered.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = item;
        div.dataset.index = index;
        
        div.addEventListener('click', () => {
            input.value = item;
            hideSuggestions();
        });
        
        suggestionList.appendChild(div);
    });
    
    // 定位建议列表
    const rect = input.getBoundingClientRect();
    suggestionList.style.left = rect.left + 'px';
    suggestionList.style.top = (rect.bottom + 2) + 'px';
    suggestionList.style.width = rect.width + 'px';
    suggestionList.style.display = 'block';
}

// 隐藏建议列表
function hideSuggestions() {
    setTimeout(() => {
        document.getElementById('suggestionList').style.display = 'none';
    }, 200);
}

// 处理建议列表键盘导航
function handleSuggestionNavigation(e) {
    const suggestionList = document.getElementById('suggestionList');
    if (suggestionList.style.display === 'none') return;
    
    const items = suggestionList.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    
    const selected = suggestionList.querySelector('.selected');
    let index = selected ? parseInt(selected.dataset.index) : -1;
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            index = (index + 1) % items.length;
            break;
        case 'ArrowUp':
            e.preventDefault();
            index = index <= 0 ? items.length - 1 : index - 1;
            break;
        case 'Enter':
            if (selected) {
                e.preventDefault();
                e.target.value = selected.textContent;
                hideSuggestions();
            }
            return;
        case 'Escape':
            hideSuggestions();
            return;
        default:
            return;
    }
    
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) {
        items[index].classList.add('selected');
    }
}

// 加载输入历史
async function loadInputHistory() {
    inputHistory = await window.electronAPI.getData('inputHistory') || {};
}

// 保存输入历史
async function saveInputHistory() {
    await window.electronAPI.saveData('inputHistory', inputHistory);
}

// 更新输入历史
function updateInputHistory(fieldId, value) {
    if (!value || !fieldId) return;
    
    if (!inputHistory[fieldId]) {
        inputHistory[fieldId] = [];
    }
    
    // 移除重复项
    inputHistory[fieldId] = inputHistory[fieldId].filter(item => item !== value);
    
    // 添加到开头
    inputHistory[fieldId].unshift(value);
    
    // 限制历史记录数量
    if (inputHistory[fieldId].length > 10) {
        inputHistory[fieldId] = inputHistory[fieldId].slice(0, 10);
    }
    
    saveInputHistory();
}
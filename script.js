let num_pages = -1;
let pc = document.getElementById('pagesContainer');
let r = document.querySelector(':root');
let pz;
let showAboutOnStart = false;

let customstorage = new CustomStorage(mokuro_base_storage_key);
let storageKey = getStorageBaseKey() + "_mokuro_state";

let defaultState = {
    page_idx: 0,
    page2_idx: -1,
    hasCover: false,
    r2l: false,
    singlePageView: true,
    displayOCR: true,
    fontSize: 14,
    defaultZoomMode: "fit to screen",
    toggleOCRTextBoxes: true,
    showAllTextBoxes: false,
    toggleTextBoxCreation: false,
    page_zindex: {},
    backgroundColor: '#C4C3D0',
    textBoxBgColor: '#363839e8',
    textBoxTextColor: '#e8e6e3',
    editingTextBox: false,
    lastCopiedTb: null,
    draggingTextBox: null,
};

let state = JSON.parse(JSON.stringify(defaultState));

let currentPageObjects = { currentPage: null, textboxList: [], textboxContentList: [] };
let currentTextBoxStyle = null;
let customInput = null;
// add custom input for color conversions
customInput = document.createElement("input");
customInput.id = "customInternalInput";
customInput.style.display = "none";
customInput = new JSColor(customInput, {});

function saveState() {
    state.draggingTextBox = null;
    customstorage.setItem(storageKey, JSON.stringify(state));
}

async function loadState() {
    let newState = await customstorage.getItem(storageKey)

    if (newState) {
        state = JSON.parse(newState);
    }

    updateUI();
    updateProperties();
}

function updateUI() {
    document.getElementById("menuR2l").checked = state.r2l;
    document.getElementById("menuDoublePageView").checked = !state.singlePageView;
    document.getElementById("menuHasCover").checked = state.hasCover;
    document.getElementById("menuDisplayOCR").checked = state.displayOCR;
    document.getElementById('menuFontSize').value = state.fontSize;
    document.getElementById('menuDefaultZoom').value = state.defaultZoomMode;
    document.getElementById('menuToggleOCRTextBoxes').checked = state.toggleOCRTextBoxes;
    document.getElementById('menuShowAllOCRTextBoxes').checked = state.showAllTextBoxes;
    document.getElementById('menuToggleTextBoxCreation').checked = state.toggleTextBoxCreation;
    document.getElementById('menuBackgroundColor').value = state.backgroundColor;
    document.getElementById('menuTextBoxBgColor').value = state.textBoxBgColor;
    document.getElementById('menuTextBoxTextColor').value = state.textBoxTextColor;
}

document.addEventListener('DOMContentLoaded', async function () {
    await customstorage.initStorage();
    await loadState();
    let transferingData = sessionStorage.getItem("transferingData");
    if (transferingData) {
        await transferTextBoxTextFromStorage();
    }
    currentPageObjects.currentPage = getCurrentPage();
    num_pages = document.getElementsByClassName("page").length;
    pz = panzoom(pc, {
        bounds: true,
        boundsPadding: 0.05,
        maxZoom: 10,
        minZoom: 0.1,
        zoomDoubleClickSpeed: 1,
        enableTextSelection: true,

        beforeMouseDown: function (e) {
            let shouldIgnore = disablePanzoomOnElement(e.target) ||
                (e.target.closest('.textBox') !== null)
            return shouldIgnore;
        },

        beforeWheel: function (e) {
            let shouldIgnore = disablePanzoomOnElement(e.target);
            return shouldIgnore;
        },

        onTouch: function (e) {
            if (disablePanzoomOnElement(e.target)) {
                e.stopPropagation();
                return false;
            }

            if (e.touches.length > 1) {
                return true;
            } else {
                return false;
            }
        }

    });

    await updatePage(state.page_idx);
    initTextBoxes();

    if (showAboutOnStart) {
        document.getElementById('popupAbout').style.display = 'block';
        document.getElementById('dimOverlay').style.display = 'initial';
        pz.pause();
    }
    // add hidden element to hold text selection
    document.getElementById("pagesContainer").innerHTML += `<p id="selectionContainer" style="display:none;"></p>`;

    await afterInitialLoadFinish();
}, false);

async function afterInitialLoadFinish() {
    let default_palette = '#FFFFFFFF,#000000FF,#e8e6e3,#363839e8,#616161,#A4C400,#60A917,#008A00,#00ABA9,#1BA1E2,#0050EF,#6A00FF,#AA00FF,#F472D0, #e2547c, #E91E63,#f7c3b8, #D80073,#A20025,#E51400,#FA6800,#F0A30A,#E3C800,#825A2C,#6D8764,#647687,#76608A,#A0522D,#c86e4c';
    let storage_palette = await customstorage.getItem(getStorageBaseKey()+"_jscolor_palette");
    jscolor.presets.default = {
        palette: storage_palette || default_palette,
        paletteCols: 10,
        paletteSpacing: 0,
        paletteHeight: 28
    };

    // add some custom inputs here
    let ids = [{id: "menuBackgroundColor", target: "state.backgroundColor"},
    {id: "menuTextBoxBgColor", target: "state.textBoxBgColor"}, 
    {id: "menuTextBoxTextColor", target: "state.textBoxTextColor"}];
    for(let i=0;i<ids.length;i++){
        let el = document.getElementById(ids[i].id);
        el.setAttribute("type", "text");
        el.setAttribute("onchange", `${ids[i].target}=this.value;saveState();handleMenuInputChange('${ids[i].target}');`);
        el.setAttribute("size", "8");
        let opts = {value: el.getAttribute("value")};
        new JSColor(el, opts);
    }
    jscolor.install();
    setAllTextBoxesFontSize();
    setAllTextBoxesBg();
    setAllTextBoxesTextColor();
}

function handleMenuInputChange(target){
    if(target === 'state.textBoxBgColor'){
        setAllTextBoxesBg();
    }
    if(target === 'state.textBoxTextColor'){
        setAllTextBoxesTextColor();
    }
}

function disablePanzoomOnElement(element) {
    return document.getElementById('topMenu').contains(element);
}

function removeNodeFromSelection(node) {
    let sel = window.getSelection();
    for (let i = 0; i < sel.rangeCount; i++) {
        let r = sel.getRangeAt(i);
        if (r.startContainer == node && r.endContainer == node) {
            sel.removeRange(r);
            break;
        }
    }
}

function selectNode(node) {
    let sel = window.getSelection();
    sel.removeAllRanges();
    let range = new Range();
    range.selectNode(node);
    sel.addRange(range);
}

function pushNotify(title, content) {
    new Notify({
        status: 'info',
        title: title,
        text: content,
        effect: 'fade',
        speed: 300,
        customClass: null,
        customIcon: null,
        showIcon: true,
        showCloseButton: true,
        autoclose: true,
        autotimeout: 2000,
        gap: 20,
        distance: 20,
        type: 'outline',
        position: 'right top'
    });
}

function copyTextBoxContent(textBox) {
    if (textBox !== state.lastCopiedTb) {
        if (navigator?.clipboard?.writeText) {
            let content = textBox.textContent.replace(/[\n\r]+/g, ' ');
            navigator.clipboard.writeText(content);
            pushNotify("Copied text", content);
            state.lastCopiedTb = textBox;
        }
    }
}


function getMouseCoordinates(e) {
    let scale = pz.getTransform().scale;
    // get canvas rectangle with absolute position of element
    let rect = pc.getBoundingClientRect();

    // subtract position from the global coordinates
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    return {
        x: x * (1 / scale),  // multiply with inverse zoom factor
        y: y * (1 / scale)
    };
}

document.addEventListener('keydown', function(e){
    if(!state.editingTextBox){
        if(e.key == "ArrowLeft"){
            inputLeft();
        }
        if(e.key == "ArrowRight"){
            inputRight();
        }
    }
})

document.addEventListener('mousedown', function (e){
    if (state.draggingTextBox) {
        state.draggingTextBox = null;
        saveCurrentPage();
    }
});

document.addEventListener('mousemove', function (e) {
    if (state.draggingTextBox) {
        let coords = getMouseCoordinates(e);
        state.draggingTextBox.style.left = coords.x - (state.draggingTextBox.getBoundingClientRect().width / 2);
        state.draggingTextBox.style.top = coords.y;
    }
});

function initTextBoxes() {
    console.log("initiating text boxes...")
    // Add event listeners for toggling ocr text boxes with the toggleOCRTextBoxes option.
    document.addEventListener('mouseup', function (e) {
        closest_div = e.target.closest('div');
        console.log('Clicked on: ', closest_div);
        if (closest_div && !closest_div.classList.contains("textBox-btn-container") && !e.target.classList?.contains("textBox-btn")) {
            let tb = closest_div.closest('.textBox');
            if (tb && tb.contains(closest_div)) {
                console.log("Clicked inside a textbox!");
                if (state.toggleOCRTextBoxes && !state.editingTextBox && !state.showAllTextBoxes && !tb.classList.contains('force-open')) {
                    if (tb.classList.contains("doubleHovered")) {
                        tb.classList.remove("doubleHovered");
                        window.getSelection().removeAllRanges();
                    }
                    else if (tb.classList.contains("hovered")) {
                        tb.classList.remove("hovered");
                        tb.classList.add("doubleHovered");
                        // select and copy contents
                        let contentNode = tb.querySelector('.textBoxContent');
                        selectNode(contentNode);
                        e.preventDefault();
                        //copyTextBoxContent(contentNode);
                    }
                    else {
                        tb.classList.add("hovered");
                    }
                } else if (state.toggleOCRTextBoxes && !state.editingTextBox && state.showAllTextBoxes && !tb.classList.contains('force-open')) {
                    // select and copy contents
                    let contentNode = tb.querySelector('.textBoxContent');
                    selectNode(contentNode);
                    // copyTextBoxContent(contentNode);
                }
            }
            else {
                if (closest_div.classList.contains("pageContainer")) {
                    if (state.toggleTextBoxCreation) {
                        console.log("adding empty textbox");
                        let div = createEmptyTextBox(state.page_idx, e);
                        closest_div.appendChild(div);
                        jscolor.install();
                    }
                }
            }
        }
    });
}

function createEmptyTextBox(page_idx, e){
    let fonts = [
        "Noto Sans JP",
        "East Sea Dokdo",
        "Yuji Boku",
        "Nanum Brush Script",
        "Nanum Pen Script",
        "Yomogi",
        "Over the rainbow",
        "Hi Melody",
        "Mochiy Pop P One",
        "Miltonian Tattoo"
    ];
    let font_picker_html = `<select class="btn btn-outline-light btn-sm m-1 font-family-input" onchange="setTextBoxFontFamily(this.closest('.textBox'), this.options[this.selectedIndex].value);">`;
    fonts.forEach((el) => {
        font_picker_html += `<option style="font-family:${el};">${el}</option>`;
    });
    font_picker_html += "</select>";

    let div = document.createElement("div");
    div.classList.add("textBox", "hovered");
    let id = randomIdGenerator();
    div.id = id;
    let zindex = state.page_zindex[page_idx.toString()] || 50;
    state.page_zindex[page_idx.toString()] = zindex + 1;
    let coords = {x: 0, y:0};
    if(e){
        coords = getMouseCoordinates(e);
    }
    let fontSize = state.fontSize;
    if(fontSize === 'auto'){
        fontSize = 14;
    }
    div.setAttribute('style', `left:${coords.x}px; top:${coords.y}px; height:50; width:100; z-index:${zindex}; font-size:32px;`);
    div.innerHTML = `\
        <div style="display:flex;width:100%;flex-direction:row;align-items:normal;justify-content:space-between;flex-wrap:wrap;">\
            <div style="display:inline-block;">\
                <span class="btn btn-outline-light btn-sm float-left m-1" onclick="removeTextBox(this.closest('.textBox'))">x</span>\
            </div>\
            <div style="display:inline-block;">\
                <span class="btn btn-outline-light btn-sm float-right m-1" onclick="dragTextBox(this.closest('.textBox'))">✥</span>\
            </div>\
            <div style="display:inline-block;">\
                <span class="btn btn-outline-light btn-sm m-1" onclick="toggleTextBoxControls(this.closest('.textBox'));">m</span>\
            </div>
        </div>\
        <div class="textBox-btn-container">\
            <div class="d-inline-block">
                <div class="btn btn-outline-light btn-sm m-1" onclick="editTextBox(this.closest('.textBox'))">✎</div><div class="btn btn-outline-light btn-sm m-1" onclick="toggleStroke(this.closest('.textBox').querySelector('.textBoxContent'))">st</div>
            </div>
            <div class="d-inline-block">
                <div class="btn btn-outline-light btn-sm m-1" onclick="this.closest('.textBox').querySelector('.textBoxContent').style.writingMode = 'horizontal-tb';">⇥</div><div class="btn btn-outline-light btn-sm m-1" onclick="this.closest('.textBox').querySelector('.textBoxContent').style.writingMode = 'vertical-rl';">⤓</div>
            </div>
            <div class="d-inline-block">
                <div class="btn btn-outline-light btn-sm m-1", onclick="copyTextBoxStyle(this.closest('.textBox'));">✂️</div><div class="btn btn-outline-light btn-sm m-1", onclick="pasteTextBoxStyle(this.closest('.textBox'));">📋</div>
            </div>
            <input type="text" class="btn btn-outline-light btn-sm m-1 bg-color-input" size="8" value="363839e8" data-jscolor="{}" onchange="setTextBoxBg(this.closest('.textBox'),this.value);"></input>\
            <input type="text" class="btn btn-outline-light btn-sm m-1 text-color-input" size="8" value="e8e6e3FF" data-jscolor="{}" onchange="setTextBoxTextColor(this.closest('.textBox'),this.value);"></input>\
            <input class="btn btn-outline-light btn-sm m-1 font-size-input" type="number" style="width:2.5rem;" min="8" value="${fontSize}" onchange="setTextBoxFontSize(this.closest('.textBox'), this.value);"></input>\
            ${font_picker_html}
        </div>\
        <div class="textBoxContent thin-black-stroke">\
            <p></p>\
        </div>\
    </div>`;

    return div;
}

function showAllTextBoxes() {
    console.log("Showing all text boxes")
    let textBoxes = currentPageObjects.textboxList;
    for (let i = 0; i < textBoxes.length; i++) {
        textBoxes[i].classList.add('hovered');
    }
}

function hideAllTextBoxes() {
    console.log("Hiding all text boxes...")
    let textBoxes = currentPageObjects.textboxList;
    for (let i = 0; i < textBoxes.length; i++) {
        textBoxes[i].classList.remove('hovered');
        textBoxes[i].classList.remove('doubleHovered');
    }
}

function setAllTextBoxesFontSize(){
    if(state.fontSize !== "auto"){
        let textboxes = pc.querySelectorAll('.textBox');
        for(let i=0;i<textboxes.length;i++){
            setTextBoxFontSize(textboxes[i], state.fontSize);
        }
    }
}

function isColorLight(color){
    const hex = color.replace('#', '');
    const c_r = parseInt(hex.substr(0, 2), 16);
    const c_g = parseInt(hex.substr(2, 2), 16);
    const c_b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((c_r * 299) + (c_g * 587) + (c_b * 114)) / 1000;
    return brightness > 155;
}

function setAllTextBoxesBg(){
    let textboxes = pc.querySelectorAll('.textBox');
    let newColor = state.textBoxBgColor;
    for(let i=0;i<textboxes.length;i++){
        setTextBoxBg(textboxes[i], newColor);
    }
}

function setAllTextBoxesTextColor(){
    let textboxes = pc.querySelectorAll('.textBox');
    for(let i=0;i<textboxes.length;i++){
        setTextBoxTextColor(textboxes[i],state.textBoxTextColor);
    }
}

function isVisible(e) {
    return !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
}

function gatherFullText() {
    let result = `<div class="textBoxContent">`;
    let id = "page" + state.page_idx + "_fullTranslationTextBox";
    let textBoxes = currentPageObjects.textboxContentList;
    for (let i = 0; i < textBoxes.length; i++) {
        if (isVisible(textBoxes[i]) && !textBoxes[i].id.includes("_fullTranslationTextBox")) {
            result += "<p>" + textBoxes[i].textContent + "</p>";
        }
    }
    // create dom element if not existing
    let container = document.getElementById(id);
    let page = currentPageObjects.currentPage
    if (!container) {
        page.innerHTML = `<div id="${id}" style="z-index: 30" class="textbox"></div>` + page.innerHTML;
        container = document.getElementById(id);
    }
    result += "</div>";
    container.innerHTML = result;
}

function updateCurrentPageImage(currentPage){
    if(customstorage.storageMode == "localforage"){
        let cp = currentPage.querySelector(".pageContainer");
        let localImagePath = cp.style.backgroundImage.match(/image_name=(.*)\"/i)[1];
        cp.style.backgroundImage = `url('${localImagePath}')`;
    }
}

function updateProperties() {
    let currentPage = getCurrentPage();
    updateCurrentPageImage(currentPage);
    if (currentPage !== currentPageObjects.currentPage) {
        currentPageObjects.currentPage = currentPage;
        currentPageObjects.textboxList = currentPageObjects.currentPage.querySelectorAll('.textBox');
        currentPageObjects.textboxContentList = currentPageObjects.currentPage.querySelectorAll('.textBoxContent');
    }

    if (state.displayOCR) {
        r.style.setProperty('--textBoxDisplay', 'flex');
    } else {
        r.style.setProperty('--textBoxDisplay', 'none');
    }

    if (state.backgroundColor) {
        r.style.setProperty('--colorBackground', state.backgroundColor)
    }

    if (state.showAllTextBoxes) {
        showAllTextBoxes();
    } else {
        hideAllTextBoxes();
    }
}

function saveCurrentPage() {
    console.log("Saving current page...");
    let page = getCurrentPage();
    let key = getStorageBaseKey() + "_" + page.id;
    customstorage.setItem(key, page.innerHTML);
    pushNotify('Saving page', 'Saved current page in storage');
}

function savePage(page_idx) {
    console.log("Saving page ", page_idx);
    let page = getPage(page_idx);
    let key = getStorageBaseKey() + "_" + page.id;
    customstorage.setItem(key, page.innerHTML);
}

document.getElementById('menuR2l').addEventListener('click', async function () {
    state.r2l = document.getElementById("menuR2l").checked;
    saveState();
    await updatePage(state.page_idx);
}, false);

document.getElementById('menuDoublePageView').addEventListener('click', async function () {
    state.singlePageView = !document.getElementById("menuDoublePageView").checked;
    saveState();
    await updatePage(state.page_idx);
}, false);

document.getElementById('menuHasCover').addEventListener('click', async function () {
    state.hasCover = document.getElementById("menuHasCover").checked;
    saveState();
    await updatePage(state.page_idx);
}, false);

document.getElementById('menuDisplayOCR').addEventListener('click', function () {
    state.displayOCR = document.getElementById("menuDisplayOCR").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuToggleOCRTextBoxes').addEventListener('click', function () {
    state.toggleOCRTextBoxes = document.getElementById("menuToggleOCRTextBoxes").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuShowAllOCRTextBoxes').addEventListener('click', function () {
    state.showAllTextBoxes = document.getElementById("menuShowAllOCRTextBoxes").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuToggleTextBoxCreation').addEventListener('click', function () {
    state.toggleTextBoxCreation = document.getElementById("menuToggleTextBoxCreation").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuOriginalSize').addEventListener('click', zoomOriginal, false);
document.getElementById('menuFitToWidth').addEventListener('click', zoomFitToWidth, false);
document.getElementById('menuFitToScreen').addEventListener('click', zoomFitToScreen, false);
document.getElementById('menuFullScreen').addEventListener('click', toggleFullScreen, false);

document.getElementById('menuAbout').addEventListener('click', function () {
    document.getElementById('popupAbout').style.display = 'block';
    document.getElementById('dimOverlay').style.display = 'initial';
    pz.pause();
}, false);

document.getElementById('menuReset').addEventListener('click', async function () {
    let page_idx = state.page_idx;
    state = JSON.parse(JSON.stringify(defaultState));
    updateUI();
    await updatePage(page_idx);
    updateProperties();
}, false);

document.getElementById('menuResetStorage').addEventListener('click', function () {
    resetcustomstorage();
}, false);

document.getElementById('menuResetCurrentPage').addEventListener('click', function () {
    customstorage.removeItem(getStorageBaseKey() + "_" + "page" + state.page_idx);
    window.location.reload();
}, false);

document.getElementById('menuTransferTextBoxText').addEventListener('click', function () {
    pushNotify('Replacing textbox text', "Getting textboxes' text from page storage and replacing the html. Page storage will be updated after this...");
    startTextTransferFromStorage();
}, false);

document.getElementById('menuSavePage').addEventListener('click', function () {
    saveCurrentPage();
}, false);

document.getElementById('menuSaveFile').addEventListener('click', function () {
    saveFile();
}, false);

document.getElementById('dimOverlay').addEventListener('click', function () {
    document.getElementById('popupAbout').style.display = 'none';
    document.getElementById('dimOverlay').style.display = 'none';
    pz.resume();
}, false);

document.getElementById('menuFontSize').addEventListener('change', (e) => {
    state.fontSize = e.target.value;
    if(state.fontSize !== 'auto'){
        setAllTextBoxesFontSize();
    }
    saveState();
    updateProperties();
});

document.getElementById('menuDefaultZoom').addEventListener('change', (e) => {
    state.defaultZoomMode = e.target.value;
    saveState();
});


document.getElementById('pageIdxInput').addEventListener('change', async (e) => {
    await updatePage(e.target.value - 1);
})

document.getElementById('buttonHideMenu').addEventListener('click', function () {
    // document.getElementById('topMenu').style.display = "none";
    document.getElementById('showMenuA').style.display = "inline-block";
    document.getElementById('topMenu').classList.add("hidden");
}, false);

document.getElementById('showMenuA').addEventListener('click', function () {
    // document.getElementById('topMenu').style.display = "initial";
    document.getElementById('showMenuA').style.display = "none";
    document.getElementById('topMenu').classList.remove("hidden");
}, false);

document.getElementById('buttonLeftLeft').addEventListener('click', inputLeftLeft, false);
document.getElementById('buttonLeft').addEventListener('click', inputLeft, false);
document.getElementById('buttonRight').addEventListener('click', inputRight, false);
document.getElementById('buttonRightRight').addEventListener('click', inputRightRight, false);
document.getElementById('leftAPage').addEventListener('click', inputLeft, false);
document.getElementById('leftAScreen').addEventListener('click', inputLeft, false);
document.getElementById('rightAPage').addEventListener('click', inputRight, false);
document.getElementById('rightAScreen').addEventListener('click', inputRight, false);

function isPageFirstOfPair(page_idx) {
    if (state.singlePageView) {
        return true;
    } else {
        if (state.hasCover) {
            return (page_idx === 0 || (page_idx % 2 === 1));
        } else {
            return page_idx % 2 === 0;
        }
    }
}

function getPage(page_idx) {
    return document.getElementById("page" + page_idx);
}

function getCurrentPage() {
    return getPage(state.page_idx);
}

function getOffsetLeft() {
    return 0;
}

function getOffsetTop() {
    let offset = 0;
    let menu = document.getElementById('topMenu');
    if (!menu.classList.contains("hidden")) {
        offset += menu.getBoundingClientRect().bottom + 10;
    }
    return offset;
}

function getOffsetRight() {
    return 0;
}

function getOffsetBottom() {
    return 0;
}

function getScreenWidth() {
    return window.innerWidth - getOffsetLeft() - getOffsetRight();
}

function getScreenHeight() {
    return window.innerHeight - getOffsetTop() - getOffsetBottom();
}

function panAlign(align_x, align_y) {
    let scale = pz.getTransform().scale;
    let x;
    let y;

    switch (align_x) {
        case "left":
            x = getOffsetLeft();
            break;
        case "center":
            x = getOffsetLeft() + (getScreenWidth() - pc.offsetWidth * scale) / 2;
            break;
        case "right":
            x = getOffsetLeft() + (getScreenWidth() - pc.offsetWidth * scale);
            break;
    }

    switch (align_y) {
        case "top":
            y = getOffsetTop();
            break;
        case "center":
            y = getOffsetTop() + (getScreenHeight() - pc.offsetHeight * scale) / 2;
            break;
        case "bottom":
            y = getOffsetTop() + (getScreenHeight() - pc.offsetHeight * scale);
            break;
    }

    pz.moveTo(x, y);
}


function zoomOriginal() {
    pz.moveTo(0, 0);
    pz.zoomTo(0, 0, 1 / pz.getTransform().scale);
    panAlign("center", "center");
}

function zoomFitToWidth() {
    let scale = (1 / pz.getTransform().scale) * (getScreenWidth() / pc.offsetWidth);
    pz.moveTo(0, 0);
    pz.zoomTo(0, 0, scale);
    panAlign("center", "top");
}

function zoomFitToScreen() {
    let scale_x = getScreenWidth() / pc.offsetWidth;
    let scale_y = getScreenHeight() / pc.offsetHeight;
    let scale = (1 / pz.getTransform().scale) * Math.min(scale_x, scale_y);
    pz.moveTo(0, 0);
    pz.zoomTo(0, 0, scale);
    panAlign("center", "center");
}

function zoomDefault() {
    switch (state.defaultZoomMode) {
        case "fit to screen":
            zoomFitToScreen();
            break;
        case "fit to width":
            zoomFitToWidth();
            break;
        case "original size":
            zoomOriginal();
            break;
    }
}

async function updatePage(new_page_idx) {
    new_page_idx = Math.min(Math.max(new_page_idx, 0), num_pages - 1);

    getCurrentPage().style.display = "none";

    if (state.page2_idx >= 0) {
        getPage(state.page2_idx).style.display = "none";
    }

    // update page idx
    if (isPageFirstOfPair(new_page_idx)) {
        state.page_idx = new_page_idx;
    } else {
        state.page_idx = new_page_idx - 1;
    }

    // update current page objects
    await loadPageFromStorage(new_page_idx);
    currentPageObjects.currentPage = getCurrentPage();
    currentPageObjects.textboxList = currentPageObjects.currentPage.querySelectorAll('.textBox');
    currentPageObjects.textboxContentList = currentPageObjects.currentPage.querySelectorAll('.textBoxContent');

    currentPageObjects.currentPage.style.display = "inline-block";
    currentPageObjects.currentPage.style.order = 2;

    if (!state.singlePageView && state.page_idx < num_pages - 1 && !isPageFirstOfPair(state.page_idx + 1)) {
        state.page2_idx = state.page_idx + 1;
        getPage(state.page2_idx).style.display = "inline-block";

        if (state.r2l) {
            getPage(state.page2_idx).style.order = 1;
        } else {
            getPage(state.page2_idx).style.order = 3;
        }

    } else {
        state.page2_idx = -1;
    }

    document.getElementById("pageIdxInput").value = state.page_idx + 1;

    page2_txt = (state.page2_idx >= 0) ? ',' + (state.page2_idx + 1) : "";
    document.getElementById("pageIdxDisplay").innerHTML = (state.page_idx + 1) + page2_txt + '/' + num_pages;

    saveState();
    updateProperties();
    zoomDefault();
}

async function firstPage() {
    await updatePage(0);
}

async function lastPage() {
    await updatePage(num_pages - 1);
}

async function prevPage() {
    await updatePage(state.page_idx - (state.singlePageView ? 1 : 2));
}

async function nextPage() {
    await updatePage(state.page_idx + (state.singlePageView ? 1 : 2));
}

async function inputLeftLeft() {
    if (state.r2l) {
        await lastPage();
    } else {
        await firstPage();
    }
}

async function inputLeft() {
    if (state.r2l) {
        await nextPage();
    } else {
        await prevPage();
    }
}

async function inputRight() {
    if (state.r2l) {
        await prevPage();
    } else {
        await nextPage();
    }
}

async function inputRightRight() {
    if (state.r2l) {
        await firstPage();
    } else {
        await lastPage();
    }
}

function toggleFullScreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}

document.addEventListener('copy', function (e) {
    var text = window.getSelection().anchorNode.closest('.textBox').querySelector('.textBoxContent').textContent.replace(/[\n\r]+/g, ' ');
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
});

function getStorageBaseKey(){
    let key = mokuro_base_storage_key || window.location.pathname.slice(window.location.pathname.indexOf("hentai"));
    return key;
}


async function loadPageFromStorage(page_idx) {
    let key = getStorageBaseKey() + "_" + "page" + page_idx;
    let value = await customstorage.getItem(key);
    if (value) {
        document.getElementById("page" + page_idx).innerHTML = value;
        jscolor.install();
        pushNotify("Loaded page from storage", "Loaded this page from storage");
    }
}

async function saveFile() {
    // deselect current page
    getCurrentPage().style.display = "none";
    let htmlContent = document.querySelector("html").outerHTML;
    let bl = new Blob([htmlContent]);
    let a = document.createElement("a");
    a.href = URL.createObjectURL(bl);
    a.download = "mokuro_modified.html";
    a.hidden = true;
    document.body.appendChild(a);
    a.innerHTML = "something random - nobody will see this, it doesn't matter what you put here";
    a.click();
    // select current page again
    getCurrentPage().style.display = "inline-block";
}

function moveElement(el, direction, amount) {
    if (direction == "left") {
        el.style.left = (parseInt(el.style.left) - amount) + 'px';
    } else if (direction == "up") {
        el.style.top = (parseInt(el.style.top) - amount) + 'px';
    } else if (direction == "right") {
        el.style.left = (parseInt(el.style.left) + amount) + 'px';
    } else if (direction == "down") {
        el.style.top = (parseInt(el.style.top) + amount) + 'px';
    }
}

function editTextBox(tb) {
    let container = tb.querySelector('.textBoxContent');
    if (container.querySelector('textarea')) {
        state.editingTextBox = false;
        tb.classList.remove('force-open');
        // save
        let content = container.querySelector('textarea').value;
        if (content.includes("<eng>")) {
            content = content.replace("<eng>", "");
            container.style.writingMode = "initial";
        } else if (content.includes("<jp>")) {
            content = content.replace("<jp>", "");
            container.style.writingMode = "vertical-rl";
        }
        container.innerHTML = `<p>${content}</p>`;
        tb.style.height = tb.getAttribute("data-height");
        tb.style.width = tb.getAttribute("data-width");
        toggleTextBoxControls(tb);
        saveCurrentPage();
    } else {
        state.editingTextBox = true;
        tb.classList.add("hovered");
        tb.classList.add('force-open');
        tb.setAttribute("data-height", tb.style.height);
        tb.setAttribute("data-width", tb.style.width);
        // get content
        let content = container.innerHTML.replace("<p>", "").replace("</p>", "").trim();
        let width = tb.style.width;
        let height = container.getBoundingClientRect().height;
        // update html with textarea
        let ta = `<textarea style="width:${width};height:${height};font-size:${tb.style.fontSize};resize:both;">${content}</textarea>`;
        container.innerHTML = ta;
        // select textarea
        let taEl = container.querySelector("textarea");
        taEl.scrollIntoView();
        taEl.focus();
        taEl.select();
    }
}

function toggleTextBoxControls(tb) {
    let el = tb.querySelector('.textBox-btn-container');
    if (el.style.display != "flex") {
        el.style.display = "flex";
        el.style.flexWrap = "wrap";
    }
    else {
        el.style.display = "none";
    }
}

async function startTextTransferFromStorage() {
    let start_transfer = false;
    let key_template = getStorageBaseKey() + "_" + "page";
    let keys = await customstorage.keys();
    for(let i=0;i<keys.length;i++){
        let key = keys[i];
        if(key.includes(key_template)){
            start_transfer = true;
            break;
        }
    }
    if (start_transfer) {
        sessionStorage.setItem("transferingData", "true");
        window.location.reload();
    } else {
        pushNotify("Transfer canceled", "Manga had no data in storage");
    }
}

async function transferTextBoxTextFromStorage() {
    sessionStorage.removeItem('transferingData');
    let page_keys = [];
    let key_template = getStorageBaseKey() + "_" + "page";
    let keys = await customstorage.keys();
    for(let i=0;i<keys.length;i++){
        let key = keys[i];
        if(key.includes(key_template)){
            page_keys.push(key);
        }
    }
    for(let i=0;i<page_keys.length;i++){
        console.log("Doing transfer for ", page_keys[i]);
        let storageData = await customstorage.getItem(page_keys[i]);
        if (storageData) {
            console.log("has storage");
            let page_key_aux = page_keys[i].split("_");
            let page_idx = page_key_aux[page_key_aux.length - 1].replace("page","");
            let data = {};
            let pageTextboxes = getPage(page_idx).querySelectorAll('.textBoxContent');
            for (let i = 0; i < pageTextboxes.length; i++) {
                data[pageTextboxes[i].id] = pageTextboxes[i];
            }
            let container = document.createElement("div");
            container.id = "transferDataTempContainer";
            container.innerHTML = storageData;
            jscolor.install();
            let storageTextboxes = container.querySelectorAll('.textBoxContent');
            console.log("Page textboxes: ", pageTextboxes);
            console.log("Storage textboxes: ", storageTextboxes);
            for (let i = 0; i < storageTextboxes.length; i++) {
                let tb = storageTextboxes[i];
                let storage_tb = tb.closest('.textBox');
                console.log("Storage tb: ", storage_tb);
                // textbox id exists both in storage and original html
                if (data[tb.id]) {
                    let target_tb = data[tb.id].closest('.textBox');
                    console.log("Target tb: ", target_tb);
                    replicateTextBox(storage_tb, target_tb);
                // it's a new textbox
                } else {
                    // create an empty textbox
                    let ntb = createEmptyTextBox(page_idx, null);
                    replicateTextBox(storage_tb, ntb);
                    // add to page
                    getPage(page_idx).querySelector(".pageContainer").appendChild(ntb);
                }
            }
            container.remove();
            savePage(page_idx);
        }
    }
}

/** Receives 2 TextBoxes, copies everything relevant from the original textbox to the new one. */
function replicateTextBox(og, target){
    // content
    original_content = og.querySelector('.textBoxContent');
    target_content = target.querySelector('.textBoxContent');
    target_content.innerHTML = original_content.innerHTML;
    target_content.style.writingMode = original_content.style.writingMode;
    // apply style
    copyTextBoxStyle(og);
    pasteTextBoxStyle(target);
    target.style.fontSize = og.style.fontSize;
    // position
    target.style.top = og.style.top;
    target.style.left = og.style.left;
    target.style.width = og.style.width;
    target.style.height = og.style.height;
}

function randomIdGenerator() {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return ("id" + S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function dragTextBox(tb) {
    state.draggingTextBox = tb;
}

async function resetcustomstorage(){
    let keys = [];
    let storageKeys = await customstorage.keys();
    for(let i=0;i<storageKeys.length;i++){
        let key = storageKeys[i];
        if(key.includes(getStorageBaseKey())){
            keys.push(key);
        }
    }
    for(let a=0;a<keys.length;a++){
        await customstorage.removeItem(keys[a]);
    }
    state = JSON.parse(JSON.stringify(defaultState));
    saveState();
    window.location.reload();
}

function toggleStroke(el){
    if (el.classList.contains("white-stroke")){
        el.classList.remove("white-stroke");
        el.classList.add("thin-black-stroke");
    }else{
        el.classList.remove("thin-black-stroke");
        el.classList.add("white-stroke");
    }
}

function removeTextBox(tb){
    tb.remove();
}

class TextBoxStyle{
    constructor(bg, textColor, fontFamilyIndex, fontSize){
        this.bg = bg;
        this.textColor = textColor;
        this.fontFamilyIndex = fontFamilyIndex;
        this.fontSize = fontSize;
    }
}

function copyTextBoxStyle(tb){
    let content = tb.querySelector('.textBoxContent');
    let bg = tb.style.background;
    if(!bg){
        bg = state.textBoxBgColor;
    }
    customInput.fromString(bg);
    bg = customInput.toHEXAString();
    let textColor = content.style.color;
    if(!textColor){
        textColor = state.textBoxTextColor;
    }
    customInput.fromString(textColor);
    textColor = customInput.toHEXAString();
    let font_family_input = tb.querySelector('.textBox-btn-container').querySelector('.font-family-input');
    let fontFamilyIndex = -1;
    if(font_family_input){
        fontFamilyIndex = font_family_input.selectedIndex;
    }
    let fontSize = tb.style.fontSize.replace("pt", "");
    if(!fontSize){
        fontSize = '14';
    }
    currentTextBoxStyle = new TextBoxStyle(bg, textColor, fontFamilyIndex, fontSize);
}

function pasteTextBoxStyle(tb){
    if(!currentTextBoxStyle){
        alert("You need to first copy a textbox style!");
    }
    else{
        let controls = tb.querySelector('.textBox-btn-container');
        let font_family_input = controls.querySelector('.font-family-input');
        if(font_family_input && currentTextBoxStyle.fontFamilyIndex != -1){
            font_family_input.selectedIndex = currentTextBoxStyle.fontFamilyIndex;
            let fontFamily = font_family_input.options[currentTextBoxStyle.fontFamilyIndex].value;
            setTextBoxFontFamily(tb, fontFamily);
        }
        setTextBoxBg(tb, currentTextBoxStyle.bg);
        setTextBoxTextColor(tb, currentTextBoxStyle.textColor);
        setTextBoxFontSize(tb, currentTextBoxStyle.fontSize);
        // update inputs
        let bg_input = controls.querySelector('.bg-color-input');
        let text_input = controls.querySelector('.text-color-input');
        if(!bg_input.jscolor){
            new JSColor(bg_input).fromString(currentTextBoxStyle.bg);
        }else{
            bg_input.jscolor.fromString(currentTextBoxStyle.bg);
        }
        if(!text_input.jscolor){
            new JSColor(text_input).fromString(currentTextBoxStyle.textColor);
        }else{
            text_input.jscolor.fromString(currentTextBoxStyle.textColor);
        }
    }
}

function setTextBoxFontSize(tb, fontSize){
    tb.style.fontSize = fontSize + 'pt';
    tb.querySelector('.textBox-btn-container').querySelector('.font-size-input').setAttribute("value", fontSize);
}

function setTextBoxBg(tb, color){
    tb.style.background = color;
    // change controls colors
    if(isColorLight(color)){
        tb.querySelectorAll('.btn').forEach(el => {
            el.classList.add("btn-outline-dark");
            el.classList.remove("btn-outline-light");
            el.color = "black";
        });
        tb.style.borderColor = "black";
    }else{
        tb.querySelectorAll('.btn').forEach(el => {
            el.classList.remove("btn-outline-dark");
            el.classList.add("btn-outline-light");
            el.color = "white";
        });
        tb.style.borderColor = "white";
    }
    tb.querySelector('.textBox-btn-container').querySelector('.bg-color-input').jscolor.fromString(color);
}

function setTextBoxTextColor(tb, color){
    let tbc = tb.querySelector('.textBoxContent');
    tbc.style.color = color;
    if(isColorLight(color)){
         tbc.classList.remove('white-stroke');
         tbc.classList.add('thin-black-stroke'); 
    }else{
        tbc.classList.add('white-stroke');
         tbc.classList.remove('thin-black-stroke'); 
    }
    tb.querySelector('.textBox-btn-container').querySelector('.text-color-input').jscolor.fromString(color);
}

function setTextBoxFontFamily(tb, value){
    tb.querySelector('.textBoxContent').style.fontFamily = value;
}

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
    });
  
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    result = {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    }
    return `rgb(${r},${g},${b})`;
  }
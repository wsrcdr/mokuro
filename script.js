let num_pages = -1;
let pc = document.getElementById('pagesContainer');
let r = document.querySelector(':root');
let pz;
let showAboutOnStart = false;

let storageKey = "mokuro_" + window.location.pathname;

let defaultState = {
    page_idx: 0,
    page2_idx: -1,
    hasCover: false,
    r2l: false,
    singlePageView: true,
    ctrlToPan: false,
    textBoxBorders: false,
    displayOCR: true,
    fontSize: "auto",
    eInkMode: false,
    defaultZoomMode: "fit to screen",
    toggleOCRTextBoxes: true,
    showAllTextBoxes: false,
    toggleFullTranslation: false,
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

function saveState() {
    state.draggingTextBox = null;
    localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
    let newState = localStorage.getItem(storageKey)

    if (newState !== null) {
        state = JSON.parse(newState);
    }

    updateUI();
    updateProperties();
}

function updateUI() {
    document.getElementById("menuR2l").checked = state.r2l;
    document.getElementById("menuCtrlToPan").checked = state.ctrlToPan;
    document.getElementById("menuDoublePageView").checked = !state.singlePageView;
    document.getElementById("menuHasCover").checked = state.hasCover;
    document.getElementById("menuTextBoxBorders").checked = state.textBoxBorders;
    document.getElementById("menuDisplayOCR").checked = state.displayOCR;
    document.getElementById('menuFontSize').value = state.fontSize;
    document.getElementById('menuEInkMode').checked = state.eInkMode;
    document.getElementById('menuDefaultZoom').value = state.defaultZoomMode;
    document.getElementById('menuToggleOCRTextBoxes').checked = state.toggleOCRTextBoxes;
    document.getElementById('menuShowAllOCRTextBoxes').checked = state.showAllTextBoxes;
    document.getElementById('menuToggleFullTranslation').checked = state.toggleFullTranslation;
    document.getElementById('menuToggleTextBoxCreation').checked = state.toggleTextBoxCreation;
    document.getElementById('menuBackgroundColor').value = state.backgroundColor;
    document.getElementById('menuTextBoxBgColor').value = state.textBoxBgColor;
    document.getElementById('menuTextBoxTextColor').value = state.textBoxTextColor;
}

document.addEventListener('DOMContentLoaded', function () {
    loadState();
    currentPageObjects.currentPage = getCurrentPage();
    let transferingData = sessionStorage.getItem("transferingData");
    if (transferingData) {
        transferTextBoxTextFromStorage();
    } else {
        loadPageFromStorage(state.page_idx);
    }
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
                (e.target.closest('.textBox') !== null) ||
                (state.ctrlToPan && !e.ctrlKey);
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

    updatePage(state.page_idx);
    initTextBoxes();

    if (showAboutOnStart) {
        document.getElementById('popupAbout').style.display = 'block';
        document.getElementById('dimOverlay').style.display = 'initial';
        pz.pause();
    }
    // add hidden element to hold text selection
    document.getElementById("pagesContainer").innerHTML += `<p id="selectionContainer" style="display:none;"></p>`;

    afterInitialLoadFinish();
}, false);

function afterInitialLoadFinish() {
    default_palette = '#F5F5F5,#212121,#e8e6e3,#363839e8,#616161,#A4C400,#60A917,#008A00,#00ABA9,#1BA1E2,#0050EF,#6A00FF,#AA00FF,#F472D0, #e2547c, #E91E63,#f7c3b8, #D80073,#A20025,#E51400,#FA6800,#F0A30A,#E3C800,#825A2C,#6D8764,#647687,#76608A,#A0522D,#c86e4c';
    storage_palette = localStorage.getItem(window.location.pathname+"_jscolor_palette");
    jscolor.presets.default = {
        palette: storage_palette || default_palette,
        paletteCols: 10,
        paletteSpacing: 0,
        paletteHeight: 28
    };
    jscolor.install();
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
                        copyTextBoxContent(contentNode);
                    }
                    else {
                        tb.classList.add("hovered");
                    }
                } else if (state.toggleOCRTextBoxes && !state.editingTextBox && state.showAllTextBoxes && !tb.classList.contains('force-open')) {
                    // select and copy contents
                    let contentNode = tb.querySelector('.textBoxContent');
                    selectNode(contentNode);
                    copyTextBoxContent(contentNode);
                }
            }
            else {
                if (closest_div.classList.contains("pageContainer")) {
                    if (state.toggleTextBoxCreation) {
                        console.log("adding empty textbox");
                        let div = document.createElement("div");
                        div.classList.add("textBox", "hovered");
                        let id = randomIdGenerator();
                        div.id = id;
                        let zindex = state.page_zindex[state.page_idx.toString()] || 50;
                        state.page_zindex[state.page_idx.toString()] = zindex + 1;
                        let coords = getMouseCoordinates(e);
                        div.setAttribute('style', `left:${coords.x}px; top:${coords.y}px; height:50; width:100; z-index:${zindex}; font-size:32px;`);
                        div.innerHTML = `\
                            <div style="display:flex;width:100%;flex-direction:row;align-items:normal;justify-content:space-between;flex-wrap:wrap;">\
                                <div style="display:inline-block;">\
                                    <span class="textBox-btn btn-close" onclick="this.closest('.textBox').remove();">x</span>\
                                </div>\
                                <div style="display:inline-block;">\
                                    <span class="textBox-btn float-right" onclick="toggleTextBoxControls(this.closest('.textBox').querySelector('.textBox-btn-container'));">m</span>\
                                </div>
                                <div class="textBox-btn-container" style="float:right;flex-direction:row;">\
                                    <span class="textBox-btn btn-move" onclick="this.closest('.textBox').querySelector('.textBoxContent').style.writingMode = 'horizontal-tb';">⇥</span>\
                                    <span class="textBox-btn btn-move" onclick="this.closest('.textBox').querySelector('.textBoxContent').style.writingMode = 'vertical-rl';">⤓</span>\
                                    <input type="text" class="textBox-btn btn-move" size="8" value="363839e8" data-jscolor="{}" onchange="this.closest(\'.textBox\').style.background=this.value;"></input>\
                                    <input type="text" class="textBox-btn btn-move" size="8" value="e8e6e3FF" data-jscolor="{}" onchange="this.closest(\'.textBox\').style.color=this.value;"></input>\
                                    <input class="textBox-btn btn-move" type="number" style="width:2em;" min="8" value="32" onchange="this.closest('.textBox').style.fontSize=this.value;"></input>\
                                    <span class="textBox-btn btn-move" onclick="editTextBox(this.closest('.textBox'))">✎</span>\
                                    <span class="textBox-btn btn-move", onclick=dragTextBox(this.closest('.textBox'))">✥</span>\
                                </div>\
                            </div>\
                            <div class="textBoxContent">\
                                <p></p>\
                            </div>\
                        </div>`
                        closest_div.appendChild(div);
                        jscolor.install();
                    }
                }
            }
        }
    });
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

function updateProperties() {
    let currentPage = getCurrentPage();
    if (currentPage !== currentPageObjects.currentPage) {
        currentPageObjects.currentPage = currentPage;
        currentPageObjects.textboxList = currentPageObjects.currentPage.querySelectorAll('.textBox');
        currentPageObjects.textboxContentList = currentPageObjects.currentPage.querySelectorAll('.textBoxContent');
    }
    if (state.textBoxBorders) {
        r.style.setProperty('--textBoxBorderHoverColor', 'rgba(237, 28, 36, 0.3)');
    } else {
        r.style.setProperty('--textBoxBorderHoverColor', 'rgba(0, 0, 0, 0)');
    }

    if (state.displayOCR) {
        r.style.setProperty('--textBoxDisplay', 'flex');
    } else {
        r.style.setProperty('--textBoxDisplay', 'none');
    }


    if (state.fontSize === 'auto') {
        pc.classList.remove('textBoxFontSizeOverride');
    } else {
        r.style.setProperty('--textBoxFontSize', state.fontSize + 'pt');
        pc.classList.add('textBoxFontSizeOverride');
    }

    if (state.eInkMode) {
        document.getElementById('topMenu').classList.add("notransition");
    } else {
        document.getElementById('topMenu').classList.remove("notransition");
    }

    if (state.backgroundColor) {
        r.style.setProperty('--colorBackground', state.backgroundColor)
    }

    if (state.textBoxBgColor) {
        r.style.setProperty('--textBoxBgColor', state.textBoxBgColor)
    }
    if (state.textBoxTextColor) {
        r.style.setProperty('--textBoxTextColor', state.textBoxTextColor)
    }

    if (state.showAllTextBoxes) {
        showAllTextBoxes();
    } else {
        hideAllTextBoxes();
    }

    let page_translation = document.getElementById("page" + state.page_idx + "_fullTranslationTextBox");
    if (page_translation) {
        if (state.toggleFullTranslation) {
            page_translation.classList.add("hovered");
        } else {
            page_translation.classList.remove("hovered");
        }
    }
}

function saveCurrentPage() {
    console.log("Saving current page...");
    let page = getCurrentPage();
    let key = window.location.pathname + "_" + page.id;
    localStorage.setItem(key, page.innerHTML);
    pushNotify('Saving page', 'Saved current page in storage');
}

document.getElementById('menuR2l').addEventListener('click', function () {
    state.r2l = document.getElementById("menuR2l").checked;
    saveState();
    updatePage(state.page_idx);
}, false);

document.getElementById('menuCtrlToPan').addEventListener('click', function () {
    state.ctrlToPan = document.getElementById("menuCtrlToPan").checked;
    saveState();
}, false);

document.getElementById('menuDoublePageView').addEventListener('click', function () {
    state.singlePageView = !document.getElementById("menuDoublePageView").checked;
    saveState();
    updatePage(state.page_idx);
}, false);

document.getElementById('menuHasCover').addEventListener('click', function () {
    state.hasCover = document.getElementById("menuHasCover").checked;
    saveState();
    updatePage(state.page_idx);
}, false);

document.getElementById('menuTextBoxBorders').addEventListener('click', function () {
    state.textBoxBorders = document.getElementById("menuTextBoxBorders").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuDisplayOCR').addEventListener('click', function () {
    state.displayOCR = document.getElementById("menuDisplayOCR").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuEInkMode').addEventListener('click', function () {
    state.eInkMode = document.getElementById("menuEInkMode").checked;
    saveState();
    updateProperties();
    if (state.eInkMode) {
        eInkRefresh();
    }
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

document.getElementById("menuToggleFullTranslation").addEventListener('click', function () {
    state.toggleFullTranslation = document.getElementById("menuToggleFullTranslation").checked;
    saveState();
    updateProperties();
}, false);

document.getElementById('menuToggleTextBoxCreation').addEventListener('click', function () {
    state.toggleTextBoxCreation = document.getElementById("menuToggleTextBoxCreation").checked;
    saveState();
    updateProperties();
}, false);


document.getElementById('menuBackgroundColor').addEventListener(
    'input',
    function (event) {
        state.backgroundColor = event.target.value;
        saveState();
        updateProperties();
    },
    false
);
document.getElementById('menuTextBoxBgColor').addEventListener(
    'input',
    function (event) {
        state.textBoxBgColor = event.target.value;
        saveState();
        updateProperties();
    },
    false
);
document.getElementById('menuTextBoxTextColor').addEventListener(
    'input',
    function (event) {
        state.textBoxTextColor = event.target.value;
        saveState();
        updateProperties();
    },
    false
);
document.getElementById('menuOriginalSize').addEventListener('click', zoomOriginal, false);
document.getElementById('menuFitToWidth').addEventListener('click', zoomFitToWidth, false);
document.getElementById('menuFitToScreen').addEventListener('click', zoomFitToScreen, false);
document.getElementById('menuFullScreen').addEventListener('click', toggleFullScreen, false);

document.getElementById('menuAbout').addEventListener('click', function () {
    document.getElementById('popupAbout').style.display = 'block';
    document.getElementById('dimOverlay').style.display = 'initial';
    pz.pause();
}, false);

document.getElementById('menuReset').addEventListener('click', function () {
    let page_idx = state.page_idx;
    state = JSON.parse(JSON.stringify(defaultState));
    updateUI();
    updatePage(page_idx);
    updateProperties();
}, false);

document.getElementById('menuResetStorage').addEventListener('click', function () {
    localStorage.clear();
    saveState();
    window.location.reload();
}, false);

document.getElementById('menuResetCurrentPage').addEventListener('click', function () {
    localStorage.removeItem(window.location.pathname + "_" + "page" + state.page_idx);
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
    saveState();
    updateProperties();
});

document.getElementById('menuDefaultZoom').addEventListener('change', (e) => {
    state.defaultZoomMode = e.target.value;
    saveState();
});


document.getElementById('pageIdxInput').addEventListener('change', (e) => {
    updatePage(e.target.value - 1);
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

function updatePage(new_page_idx) {
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
    loadPageFromStorage(new_page_idx);
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
    if (state.eInkMode) {
        eInkRefresh();
    }
}

function firstPage() {
    updatePage(0);
}

function lastPage() {
    updatePage(num_pages - 1);
}

function prevPage() {
    updatePage(state.page_idx - (state.singlePageView ? 1 : 2));
}

function nextPage() {
    updatePage(state.page_idx + (state.singlePageView ? 1 : 2));
}

function inputLeftLeft() {
    if (state.r2l) {
        lastPage();
    } else {
        firstPage();
    }
}

function inputLeft() {
    if (state.r2l) {
        nextPage();
    } else {
        prevPage();
    }
}

function inputRight() {
    if (state.r2l) {
        prevPage();
    } else {
        nextPage();
    }
}

function inputRightRight() {
    if (state.r2l) {
        firstPage();
    } else {
        lastPage();
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

function eInkRefresh() {
    pc.classList.add("inverted");
    document.body.style.backgroundColor = "black";
    setTimeout(function () {
        pc.classList.remove("inverted");
        document.body.style.backgroundColor = r.style.getPropertyValue("--colorBackground");
    }, 300);
}

document.addEventListener('copy', function (e) {
    var text = window.getSelection().toString().replace(/[\n\r]+/g, ' ');
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
});


function loadPageFromStorage(page_idx) {
    let key = window.location.pathname + "_" + "page" + page_idx;
    let value = localStorage.getItem(key);
    if (value) {
        document.getElementById("page" + page_idx).innerHTML = value;
        pushNotify("Loaded page from storage", "Loaded this page from storage");
    }
}

async function saveFile() {
    let handle = await window.showSaveFilePicker({
        suggestedName: 'mokuro-copy.html',
        types: [{
            description: 'HTML file',
            accept: { 'text/plain': ['.html'] },
        }],
    });

    const blob = new Blob([document.querySelector("html").outerHTML]);

    const writableStream = await handle.createWritable();
    await writableStream.write(blob);
    await writableStream.close();
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
        saveCurrentPage();
    } else {
        state.editingTextBox = true;
        tb.classList.add("hovered");
        tb.classList.add('force-open');
        // get content
        let content = container.innerHTML.replace("<p>", "").replace("</p>", "");
        // update html with textarea
        let ta = `<textarea style="width:100%;height:100%;font-size:${tb.style.fontSize};">${content}</textarea>`;
        container.innerHTML = ta;

    }
}

function toggleTextBoxControls(el) {
    if (el.style.display != "flex") {
        el.style.display = "flex";
        el.style.flexWrap = "wrap";
        el.parentNode.style.justifyContent = "start";
    }
    else {
        el.style.display = "none";
        el.parentNode.style.justifyContent = "space-between";
    }
}

function startTextTransferFromStorage() {
    let storageData = localStorage.getItem(window.location.pathname + "_" + "page" + state.page_idx);
    if (storageData) {
        sessionStorage.setItem("transferingData", "true");
        window.location.reload();
    } else {
        pushNotify("Transfer canceled", "Page had no data in storage");
    }
}

function transferTextBoxTextFromStorage() {
    sessionStorage.removeItem('transferingData');
    let storageData = localStorage.getItem(window.location.pathname + "_" + "page" + state.page_idx);
    if (storageData) {
        let data = {};
        let pageTextboxes = getCurrentPage().querySelectorAll('.textBoxContent');
        for (let i = 0; i < pageTextboxes.length; i++) {
            data[pageTextboxes[i].id] = pageTextboxes[i];
        }
        let container = document.createElement("div");
        container.id = "transferDataTempContainer";
        container.innerHTML = storageData;
        let storageTextboxes = container.querySelectorAll('.textBoxContent');
        for (let i = 0; i < storageTextboxes.length; i++) {
            let tb = storageTextboxes[i];
            if (data[tb.id]) {
                data[tb.id].innerHTML = tb.innerHTML;
                data[tb.id].setAttribute("style", tb.getAttribute("style"));
                data[tb.id].closest('.textBox').setAttribute("style", tb.closest('.textBox').getAttribute("style"));
            } else {
                getCurrentPage().querySelector(".pageContainer").appendChild(tb.closest('.textBox'));
            }
        }
        container.remove();
        saveCurrentPage()
    }
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
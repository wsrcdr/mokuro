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
    editableText: false,
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
    textBoxBgColor: '#131516',
    textBoxTextColor: '#e8e6e3',
};

let state = JSON.parse(JSON.stringify(defaultState));

function saveState() {
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
    document.getElementById("menuEditableText").checked = state.editableText;
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

}, false);

function disablePanzoomOnElement(element) {
    return document.getElementById('topMenu').contains(element);
}

function removeNodeFromSelection(node){
    let sel = window.getSelection();
    for (let i=0; i<sel.rangeCount; i++){
        let r = sel.getRangeAt(i);
        if(r.startContainer == node && r.endContainer == node){
            sel.removeRange(r);
            break;
        }
    }
}

function selectNode(node){
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
      autotimeout: 3000,
      gap: 20,
      distance: 20,
      type: 'outline',
      position: 'right top'
    });
  }

function copyTextBoxContent(textBox){
    if (navigator?.clipboard?.writeText) {
        let content = textBox.textContent.replace(/[\n\r]+/g, ' ');
        navigator.clipboard.writeText(content);
        pushNotify("Copied text", content);
    }
}


function getMouseCoordinates(e){
    let x = e.pageX;
	let y = e.pageY;
	let bounds = document.getElementById("pagesContainer").getBoundingClientRect();
    let pageBounds = document.body.getBoundingClientRect();
    if(x < bounds.x){
        x = 0;
    }
    else if (x > (bounds.x + bounds.width)){
        x = pageBounds.width;
    }else{
        let offset_x = x-bounds.x;
    let xratio = pageBounds.width / bounds.width;
    x = offset_x * xratio;
    }
    if(y < bounds.y){
        y = 0;
    }
    else if (y > bounds.y + bounds.height){
        y = pageBounds.height;
    }else{
        let offset_y = y-bounds.y;
        let yratio = pageBounds.height / bounds.height;
        y = offset_y * yratio;
    }
    return {x: x, y: y};
}

function initTextBoxes() {
    console.log("initiating text boxes...")
    // Add event listeners for toggling ocr text boxes with the toggleOCRTextBoxes option.
    document.addEventListener('mousedown', function(e){
        closest_div = e.target.closest('div');
        console.log('Clicked on: ', closest_div);
        if(closest_div && (closest_div.classList.contains('textBox') || closest_div.classList.contains('textBoxContent'))){
            if(closest_div.classList.contains("textBoxContent")){
                closest_div = closest_div.parentNode;
            }
            if(state.toggleOCRTextBoxes && !state.editableText){
                if(closest_div.classList.contains("doubleHovered")){
                    closest_div.classList.remove("doubleHovered");
                    window.getSelection().removeAllRanges();
                }
                else if(closest_div.classList.contains("hovered")){
                    closest_div.classList.remove("hovered");
                    closest_div.classList.add("doubleHovered");
                    // select and copy contents
                    let contentNode = closest_div.querySelector('.textBoxContent');
                    selectNode(contentNode);
                    e.preventDefault();
                    copyTextBoxContent(contentNode);
                }
                else {
                    closest_div.classList.add("hovered");
                }
            }
        }else{
            if(closest_div.classList.contains("pageContainer")){
                if(state.toggleTextBoxCreation){
                console.log("adding empty textbox");
                let div = document.createElement("div");
                div.classList.add("textBox", "hovered");
                let zindex = state.page_zindex[state.page_idx.toString()] || 50;
                state.page_zindex[state.page_idx.toString()] = zindex + 1;
                let coords = getMouseCoordinates(e);
                div.setAttribute('style', `left:${coords.x}px; top:${coords.y}px; height:50; width:100; z-index:${zindex}; font-size:32px;`);
                div.innerHTML = `<span class="btn-close" onclick="this.parentNode.remove();">x</span><div class="textBoxContent"><p>a</p></div>`
                closest_div.appendChild(div);
            }
        }
        }
    });
}

function showAllTextBoxes(){
    console.log("Showing all text boxes")
    let textBoxes = getCurrentPage().querySelectorAll('.textBox');
    for (let i = 0; i < textBoxes.length; i++) {
        textBoxes[i].classList.add('hovered');
    }
}

function hideAllTextBoxes(){
    console.log("Hiding all text boxes...")
    let textBoxes = getCurrentPage().querySelectorAll('.textBox');
    for (let i = 0; i < textBoxes.length; i++) {
        textBoxes[i].classList.remove('hovered');
    }
}

function isVisible(e) {
    return !!( e.offsetWidth || e.offsetHeight || e.getClientRects().length );
}

function gatherFullText(){
    let result = `<div class="textBoxContent">`;
    let id = "page"+state.page_idx + "_fullTranslationTextBox";
    let textBoxes = getCurrentPage().querySelectorAll('.textBoxContent');
    for (let i = 0; i < textBoxes.length; i++) {
        if(isVisible(textBoxes[i]) && !textBoxes[i].id.includes("_fullTranslationTextBox")){
            result += "<p>"+textBoxes[i].textContent + "</p>";
        }
    }
    // create dom element if not existing
    let container = document.getElementById(id);
    let page = getCurrentPage();
    if(!container){
        page.innerHTML = `<div id="${id}" style="z-index: 30" class="textbox"></div>` + page.innerHTML;
        container = document.getElementById(id);
    }
    result += "</div>";
    container.innerHTML = result;
}

function updateProperties() {
    if (state.textBoxBorders) {
        r.style.setProperty('--textBoxBorderHoverColor', 'rgba(237, 28, 36, 0.3)');
    } else {
        r.style.setProperty('--textBoxBorderHoverColor', 'rgba(0, 0, 0, 0)');
    }

    pc.contentEditable = state.editableText;

    if (state.displayOCR) {
        r.style.setProperty('--textBoxDisplay', 'initial');
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

    if(state.textBoxBgColor){
        r.style.setProperty('--textBoxBgColor', state.textBoxBgColor)
    }
    if(state.textBoxTextColor){
        r.style.setProperty('--textBoxTextColor', state.textBoxTextColor)
    }

    if (state.showAllTextBoxes){
        showAllTextBoxes();
    }else{
        hideAllTextBoxes();
    }

    let page_translation = document.getElementById("page"+state.page_idx+"_fullTranslationTextBox");
    if(page_translation){
        if(state.toggleFullTranslation){
            page_translation.classList.add("hovered");
        }else{
            page_translation.classList.remove("hovered");
        }
    }
}

function parse_textbox_changes(){
    let textboxes = getCurrentPage().querySelectorAll('.textBoxContent');
    for (let i = 0; i < textboxes.length; i++) {
        let content = textboxes[i].textContent;
        if (content.includes("<eng>")){
            content = content.replace("<eng>", "");
            textboxes[i].innerHTML = `<p>${content}</p>`;
            textboxes[i].style.writingMode = "initial";
        }else if(content.includes("<jp>")){
            content = content.replace("<jp>", "");
            textboxes[i].innerHTML = `<p>${content}</p>`;
            textboxes[i].style.writingMode = "vertical-rl";
        }
        // save current page in storage
        saveCurrentPage();
    }
}

function saveCurrentPage(){
    localStorage.setItem(getCurrentPage().id, getCurrentPage().innerHTML);
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

document.getElementById('menuEditableText').addEventListener('click', function () {
    // check for save
    previous_state = state.editableText;
    new_state = document.getElementById("menuEditableText").checked;
    if (new_state === false && previous_state != new_state){
        console.log("Deactivated edit text...");
        parse_textbox_changes();
    }
    state.editableText = new_state;
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

document.addEventListener("keydown", function onEvent(e) {
    switch (e.key) {
        case "PageUp":
            prevPage();
            break;

        case "PageDown":
            nextPage();
            break;

        case "Home":
            firstPage();
            break;

        case "End":
            lastPage();
            break;

        case " ":
            nextPage();
            break;

        case "0":
            zoomDefault();
            break;
    }
});

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

function getCurrentPage(){
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

    if (isPageFirstOfPair(new_page_idx)) {
        state.page_idx = new_page_idx;
    } else {
        state.page_idx = new_page_idx - 1;
    }

    getCurrentPage().style.display = "inline-block";
    getCurrentPage().style.order = 2;

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

    loadPageFromStorage();
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

document.addEventListener('copy', function(e){
    var text = window.getSelection().toString().replace(/[\n\r]+/g, ' ');
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  });


function loadPageFromStorage(){
    let value = localStorage.getItem(getCurrentPage().id);
    if(value){
        getCurrentPage().innerHTML = value;
    }
}

async function saveFile(){
    let handle = await window.showSaveFilePicker({
        suggestedName: 'mokuro-copy.html',
        types: [{
            description: 'HTML file',
            accept: {'text/plain': ['.html']},
        }],
    });
    
    const blob = new Blob([document.querySelector("html").outerHTML]);
    
    const writableStream = await handle.createWritable();
    await writableStream.write(blob);
    await writableStream.close();
}
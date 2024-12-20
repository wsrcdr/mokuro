import shutil
from pathlib import Path
from urllib.parse import quote

import numpy as np
from loguru import logger
from natsort import natsorted
from tqdm import tqdm
from yattag import Doc

from mokuro import __version__
from mokuro.env import ASSETS_PATH
from mokuro.manga_page_ocr import MangaPageOcr
from mokuro.utils import dump_json, load_json, get_manga_id
import os

SCRIPT_PATH = Path(__file__).parent / 'script.js'

STYLES_PATH = Path(__file__).parent / 'styles.css'
PANZOOM_PATH = ASSETS_PATH / 'panzoom.min.js'
JSCOLOR_PATH = ASSETS_PATH / 'jscolor.js'
BOOTSTRAP_JS_PATH = ASSETS_PATH / 'bootstrap.bundle.min.js'
BOOTSTRAP_CSS_PATH = ASSETS_PATH / 'bootstrap.min.css'
ICONS_PATH = ASSETS_PATH / 'icons'
LOCAL_FORAGE = ASSETS_PATH / 'localforage.min.js'
CUSTOM_STORAGE = ASSETS_PATH / 'customstorage.js'

ABOUT = f"""
<p>HTML overlay generated with <a href="https://github.com/kha-white/mokuro" target="_blank">mokuro</a> version {__version__}</p>
<p>Instructions:</p>
<ul>
<li>Navigate pages with:
    <ul>
    <li>menu buttons</li>
    <li>Page Up, Page Down, Home, End keys</li>
    <li>by clicking left/right edge of the screen</li>
    </ul>
<li>Click &#10005; button to hide the menu. To bring it back, clip top-left corner of the screen.</li>
<li>Select "editable boxes" option, to edit text recognized by OCR. Changes are not saved, it's only for ad-hoc fixes when using look-up dictionary.</li>
<li>E-ink mode turns off animations and simulates display refresh on each page turn.</li>
</ul>
"""

ABOUT_DEMO = ABOUT + """
<br/>
<p>This demo contains excerpt from <a href="http://www.manga109.org/en/download_s.html" target="_blank">Manga109-s dataset</a>.</p>
<p>うちの猫’ず日記 &copy; がぁさん</p>
"""
FONTS = [
    "Noto Sans JP",
    "Augie",
    "CC Astro City",
    "CC Wild Words Roman",
    "Chicken Scratch",
    "East Sea Dokdo",
    "Fighting Spirit",
    "Help Me",
    "Hi Melody",
    "Komika Axis",
    "Komika Boo",
    "Miltonian Tattoo",
    "Mochiy Pop P One",
    "Nanum Brush Script",
    "Nanum Pen Script",
    "Over the rainbow",
    "Pigae",
    "Yomogi",
    "Yuji Boku"
]

class OverlayGenerator:
    def __init__(self,
                 pretrained_model_name_or_path='kha-white/manga-ocr-base',
                 force_cpu=False,
                 disable_ocr=False,
                 **kwargs):
        self.pretrained_model_name_or_path = pretrained_model_name_or_path
        self.force_cpu = force_cpu
        self.kwargs = kwargs
        self.mpocr = None
        self.disable_ocr = disable_ocr

    def init_models(self):
        if self.mpocr is None:
            self.mpocr = MangaPageOcr(self.pretrained_model_name_or_path, self.force_cpu, disable_ocr=self.disable_ocr, **self.kwargs)

    def process_dir(self, path, as_one_file=True, is_demo=False, for_server=False):
        path = Path(path).expanduser().absolute()
        assert path.is_dir(), f'{path} must be a directory'
        if path.stem == '_ocr':
            logger.info(f'Skipping OCR directory: {path}')
            return
        out_dir = path

        results_dir = out_dir / '_ocr'
        results_dir.mkdir(parents=True, exist_ok=True)

        if not as_one_file:
            shutil.copy(SCRIPT_PATH, out_dir / 'script.js')
            shutil.copy(STYLES_PATH, out_dir / 'styles.css')
            shutil.copy(PANZOOM_PATH, out_dir / 'panzoom.min.js')
            shutil.copy(LOCAL_FORAGE, out_dir / 'localforage.min.js')
            shutil.copy(CUSTOM_STORAGE, out_dir / 'customstorage.js')
            shutil.copy(JSCOLOR_PATH, out_dir / 'jscolor.js')

        img_paths = [p for p in path.glob('*') if p.is_file() and p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')]
        img_paths = natsorted(img_paths)

        page_htmls = []
        manga_id = path.relative_to(path.parent.parent).as_posix().replace("/", "_").replace("\\", "_")
        
        for img_path in tqdm(img_paths, desc='Processing pages...'):
            json_path = (results_dir / img_path.relative_to(path)).with_suffix('.json')
            if json_path.is_file():
                result = load_json(json_path)
            else:
                self.init_models()
                try:
                    result = self.mpocr(img_path)
                except Exception as e:
                    logger.error(f'Failed OCR of file "{img_path}": {e}')
                    continue
                json_path.parent.mkdir(parents=True, exist_ok=True)
                dump_json(result, json_path)
            img_path = img_path.relative_to(out_dir).as_posix()
            if for_server:
                img_url = f"http://localhost:5000/manga/{manga_id}/images?image_name={img_path}"
                page_html = self.get_page_html(result, img_url, f"page{len(page_htmls)}")
            else:
                page_html = self.get_page_html(result, quote(img_path), f"page{len(page_htmls)}")
            page_htmls.append(page_html)

        if is_demo:
            title = f'mokuro {__version__} demo'
        else:
            title = f'{path.name} | mokuro'
        index_html = self.get_index_html(page_htmls, title, as_one_file, is_demo, for_server, manga_id)
        if for_server:
            (out_dir / 'mokuro_server.html').write_text(index_html, encoding='utf-8')
        else:
            (out_dir / 'mokuro.html').write_text(index_html, encoding='utf-8')

    def get_index_html(self, page_htmls, title, as_one_file=True, is_demo=False, for_server=False, manga_id=None):
        doc, tag, text = Doc().tagtext()

        with tag('html'):
            doc.asis('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/simple-notify@1.0.4/dist/simple-notify.css" />')
            doc.asis('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">')
            doc.asis('<link href="https://fonts.googleapis.com/css2?family=East+Sea+Dokdo&family=Nanum+Brush+Script&family=Nanum+Pen+Script&family=Yuji+Boku&family=Noto+Sans+JP&family=Hi+Melody&family=Miltonian+Tattoo&family=Mochiy+Pop+P+One&family=Over+the+Rainbow&family=Yomogi&display=swap" rel="stylesheet">')
            doc.asis('<meta content="text/html;charset=utf-8" http-equiv="Content-Type">')
            doc.asis('<meta content="utf-8" http-equiv="encoding">')
            doc.asis(
                '<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, user-scalable=no"/>')

            with tag('head'):
                with tag('title'):
                    text(title)

                if as_one_file:
                    with tag('style'):
                        doc.asis(STYLES_PATH.read_text())
                else:
                    with tag('link', rel='stylesheet', href='styles.css'):
                        pass

            with tag('body'):
                self.top_menu(doc, tag, text, len(page_htmls), for_server)

                with tag('div', id='dimOverlay'):
                    pass

                with tag('div', id='popupAbout', klass='popup'):
                    if is_demo:
                        doc.asis(ABOUT_DEMO)
                    else:
                        doc.asis(ABOUT)

                with tag('a', id='leftAScreen', href='#'):
                    pass

                with tag('a', id='rightAScreen', href='#'):
                    pass

                with tag('div', id='pagesContainer'):
                    for i, page_html in enumerate(page_htmls):
                        with tag('div', id=f'page{i}', klass='page'):
                            doc.asis(page_html)

                    with tag('a', id='leftAPage', href='#'):
                        pass

                    with tag('a', id='rightAPage', href='#'):
                        pass
                doc.asis('<script src="https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js" integrity="sha512-01CJ9/g7e8cUmY0DFTMcUw/ikS799FHiOA0eyHsUWfOetgbx/t6oV4otQ5zXKQyIrQGTHSmRVPIgrgLcZi/WMA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>')
                doc.asis('<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>')
                doc.asis('<script src="https://cdn.jsdelivr.net/npm/simple-notify@1.0.4/dist/simple-notify.min.js"></script>')
                if manga_id:
                    doc.asis(f'<script>var mokuro_base_storage_key="{manga_id}";var manga_id="{manga_id}";</script>')
                if as_one_file:
                    with tag('script'):
                        doc.asis(LOCAL_FORAGE.read_text())
                    with tag('script'):
                        doc.asis(CUSTOM_STORAGE.read_text())
                    with tag('script'):
                        doc.asis(JSCOLOR_PATH.read_text())
                    with tag('script'):
                        doc.asis(PANZOOM_PATH.read_text())
                    with tag('script'):
                        doc.asis(SCRIPT_PATH.read_text())
                else:
                    with tag('script', src='localforage.min.js'):
                        pass
                    with tag('script', src='customstorage.js'):
                        pass
                    with tag('script', src='jscolor.js'):
                        pass
                    with tag('script', src='panzoom.min.js'):
                        pass
                    with tag('script', src='script.js'):
                        pass

                    if is_demo:
                        with tag('script'):
                            doc.asis('showAboutOnStart=true;')
            
        html = doc.getvalue()
        return html

    def top_menu(self, doc, tag, text, num_pages, for_server=False):
        with tag('a', id='showMenuA', href='#'):
            pass

        with tag('div', id='topMenu'):
            with tag('button', id='buttonHideMenu', klass='menuButton'):
                doc.asis(self.get_icon('cross-svgrepo-com'))
            if for_server:
                with tag('a', href="http://localhost:5000/", id='buttonMangaEngine', klass='menuButton', target='_blank'):
                    text("ME")
            with tag('button', id='buttonLeftLeft', klass='menuButton'):
                doc.asis(self.get_icon('chevron-left-double-svgrepo-com'))

            with tag('button', id='buttonLeft', klass='menuButton'):
                doc.asis(self.get_icon('chevron-left-svgrepo-com'))

            with tag('button', id='buttonRight', klass='menuButton'):
                doc.asis(self.get_icon('chevron-right-svgrepo-com'))

            with tag('button', id='buttonRightRight', klass='menuButton'):
                doc.asis(self.get_icon('chevron-right-double-svgrepo-com'))

            with tag('input', 'required', type='number', id='pageIdxInput',
                     min=1, max=num_pages, value=1, size=3):
                pass

            with tag('span', id='pageIdxDisplay'):
                pass

            doc.asis('<button id="saveCurrentPageTopMenuButton" class="menuBUtton" onclick="saveCurrentPage();">💾</button>')

            # workaround for yomichan including the menu bar in the {sentence} field when mining for some reason
            with tag('span', style='color:rgba(255,255,255,0.1);font-size:1px;'):
                text('。')

            self.dropdown_menu(doc, tag, text)

            

    def dropdown_menu(self, doc, tag, text):
        def option_click(id_, text_content):
            with tag('a', href='#', klass='dropdown-option list-group-item', id=id_):
                text(text_content)

        def option_toggle(id_, text_content):
            with tag('label', klass='dropdown-option list-group-item'):
                text(text_content)

                with tag('input', type='checkbox', id=id_):
                    pass

        def option_select(id_, text_content, values):
            with tag('label', klass='dropdown-option list-group-item'):
                text(text_content)
                with tag('select', id=id_):
                    for value in values:
                        with tag('option', value=value):
                            text(value)

        def option_color(id_, text_content, value):
            with tag('label', klass='dropdown-option list-group-item'):
                text(text_content)
                with tag('input', type='color',  value=value, id=id_):
                    pass
        
        def option_collapse(target_id, text_content):
            doc.asis(f'<label class="dropdown-option"><button class="menuButton" type="button" data-bs-toggle="collapse" data-bs-target="#{target_id}">{text_content}</button></label>')

        with tag('div', klass='dropdown'):
            with tag('button', id='dropbtn', klass='menuButton'):
                doc.asis(self.get_icon('menu-hamburger-svgrepo-com'))

            with tag('div', klass='dropdown-content'):
                with tag('div', klass='buttonRow'):
                    with tag('button', id='menuFitToScreen', klass='menuButton'):
                        doc.asis(self.get_icon('expand-svgrepo-com'))
                    with tag('button', id='menuFitToWidth', klass='menuButton'):
                        doc.asis(self.get_icon('expand-width-svgrepo-com'))
                    with tag('button', id='menuOriginalSize', klass='menuButton'):
                        text('1:1')
                    with tag('button', id='menuFullScreen', klass='menuButton'):
                        doc.asis(self.get_icon('fullscreen-svgrepo-com'))

                option_select('menuDefaultZoom', 'on page turn: ', [
                    'fit to screen',
                    'fit to width',
                    'original size',
                    'keep zoom level',
                ])
                option_collapse('readerOptions', 'Reader options')
                with tag('div', klass='collapse', id='readerOptions'):
                    with tag('div', klass="card card-body"):
                        with tag('div', klass="list-group"):
                            option_toggle('menuReadingMode', 'reading mode')
                            option_toggle('menuR2l', 'right to left')
                            option_toggle('menuDoublePageView', 'display two pages ')
                            option_toggle('menuHasCover', 'first page is cover ')
                            option_color('menuBackgroundColor', 'background color', '#343341')
                option_collapse('ocrOptions', 'OCR options')
                with tag('div', klass="collapse", id="ocrOptions"):
                    with tag('div', klass="card card-body"):
                        with tag('div', klass="list-group"):
                            option_toggle('menuDisplayOCR', 'OCR enabled ')
                option_collapse('textboxOptions', 'Textbox options')
                with tag('div', klass='collapse', id='textboxOptions'):
                    with tag('div', klass="card card-body"):
                        with tag('div', klass="list-group"):
                            option_toggle('menuToggleOCRTextBoxes', 'toggle text boxes on click')
                            option_toggle('menuShowAllOCRTextBoxes', 'Show all text boxes')
                            option_toggle('menuToggleTextBoxCreation', 'Create textbox on click')
                            option_toggle('menuShowAllPaintBoxes', 'Show all paint boxes')
                            option_toggle('menuTogglePaintBoxCreation', 'Create paintbox on click')
                            option_select('menuFontSize', 'font size: ',
                                        ['auto', 9, 10, 11, 12, 14, 16, 18, 20, 24, 32, 40, 48, 60])
                            option_select('menuFontFamily', 'font family: ', FONTS)
                            option_color('menuTextBoxBgColor', 'textbox bg color', '#363839e8')
                            option_color('menuTextBoxTextColor', 'textbox text color', '#e8e6e3')
                option_collapse('resetOptions', 'Reset options')
                with tag('div', klass='collapse', id='resetOptions'):
                    with tag('div', klass="card card-body"):
                        with tag('div', klass="list-group"):
                            option_click('menuReset', 'reset settings')
                            option_click('menuResetStorage', 'reset local storage')
                            option_click('menuResetCurrentPage', 'reset current page')
                option_collapse('saveLoadOptions', 'Save and load options')
                with tag('div', klass='collapse', id='saveLoadOptions'):
                    with tag('div', klass="card card-body"):
                        with tag('div', klass="list-group"):
                            option_click('menuTransferTextBoxText', 'transfer text from page storage')
                            option_click('menuSavePage', 'save page in storage')
                            option_click('menuSaveFile', 'save file')
                option_click('menuAbout', 'about/help')

    def get_page_html(self, result, img_path, id):
        doc, tag, text = Doc().tagtext()

        # assign z-index ordering from largest to smallest boxes,
        # so that smaller boxes don't get hidden underneath larger ones
        if len(result['blocks']) > 0:
            boxes = np.array([b['box'] for b in result['blocks']])
            areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
            z_idxs = np.argsort(np.argsort(-areas)) + 10
        else:
            z_idxs = []

        with tag('div', klass='pageContainer', style=self.get_container_style(result, img_path)):
            block_count = 0
            for result_blk, z_index in zip(result['blocks'], z_idxs):
                block_count += 1
                box_style = self.get_box_style(result_blk, z_index, result['img_width'], result['img_height'])
                with tag('div', klass='textBox', style=box_style, id=f"{id}_box{block_count}"):
                    with tag('div', klass="textBox-top-bar"):
                        with tag('div', style="display:inline-block;"):
                            with tag('span', klass='btn btn-outline-light btn-sm float-left close-button', onclick='removeTextBox(this.closest(".textBox"));'):
                                text('x')
                        with tag('div', style="display:inline-block;"):
                            with tag('span', klass='btn btn-outline-light btn-sm float-right move-button', onclick=f"dragTextBox(this.closest('.textBox'));"):
                                text('✥')
                        with tag('div', style="display:inline-block;"):
                            with tag('span', klass='btn btn-outline-light btn-sm toggle-controls-button', onclick='toggleTextBoxControls(this.closest(".textBox"));'):
                                text('m')
                    with tag('div', klass="textBox-btn-container"):
                        with tag('div', klass="tb-btn-group"):
                            with tag('div', klass='btn btn-outline-light btn-sm', onclick=f"editTextBox(this.closest('.textBox'))"):
                                text('✎')
                        with tag('div', klass="tb-btn-group"):
                            with tag('div', klass='btn btn-outline-light btn-sm', style='text-decoration:underline;', onclick=f"toggleCssClass(this.closest('.textBox').querySelector('.textBoxContent'), 'fw-bold');"):
                                text('𝐁')
                            with tag('div', klass='btn btn-outline-light btn-sm', onclick=f"toggleCssClass(this.closest('.textBox').querySelector('.textBoxContent'), 'fst-italic');"):
                                text('𝐼')
                        with tag('div', klass="tb-btn-group"):
                            with tag('div', klass='btn btn-outline-light btn-sm', onclick=f"this.closest('.textBox').querySelector('.textBoxContent').style.writingMode = 'horizontal-tb';"):
                                text('⇥')
                            with tag('div', klass='btn btn-outline-light btn-sm', onclick=f"this.closest('.textBox').querySelector('.textBoxContent').style.writingMode = 'vertical-rl';"):
                                text('⤓')
                        with tag('div'):
                            with tag('div', klass='btn btn-outline-light btn-sm', onclick=f"copyTextBoxStyle(this.closest('.textBox'));"):
                                text('✂️')
                            with tag('div', klass='btn btn-outline-light btn-sm', onclick=f"pasteTextBoxStyle(this.closest('.textBox'));"):
                                text('📋')
                        with tag('div', style="flex-basis:100%;"):
                            doc.asis('<input type="text" class="btn btn-outline-light btn-sm bg-color-input" size="8" value="363839e8" data-jscolor="{}" onchange="setTextBoxBg(this.closest(\'.textBox\'),this.value);"></input>')
                            doc.asis('<input type="text" class="btn btn-outline-light btn-sm text-color-input" size="8" value="e8e6e3FF" data-jscolor="{}" onchange="setTextBoxTextColor(this.closest(\'.textBox\'),this.value);"></input>')
                        with tag('div'):
                            with tag('select', klass="btn btn-outline-light btn-sm font-family-input", onchange="handleFontFamilySelect(this);"):
                                for font in FONTS:
                                    doc.asis(f'<option style="font-family: {font};">{font}</option>')
                            with tag('input', klass="btn btn-outline-light btn-sm font-size-input", type="number", style="width:2.5rem;", min="8",value=str(np.clip(result_blk['font_size'], 8, 32)), onchange=f"setTextBoxFontSize(this.closest('.textBox'),this.value);"):
                                pass
                            with tag('div', style="font-family: 'Noto Sans JP';", klass='btn btn-outline-light btn-sm', onclick=f"appendText(this.closest('.textBox'), '♥', 'Noto Sans JP');"):
                                text('♥')
                        

                    content = "\n".join(result_blk['lines'])
                    contentStyle = ''
                    with tag('div', klass='textBoxContent thin-black-stroke', style=contentStyle, id=f"{id}_box{block_count}_content"):
                        with tag('p'):
                            text(content)
                        '''
                    for line in result_blk['lines']:
                        with tag('p'):
                            text(line)'''

        html = doc.getvalue()
        return html

    @staticmethod
    def get_box_style(result_blk, z_index, W, H, expand=0):
        xmin, ymin, xmax, ymax = result_blk['box']
        w = xmax - xmin
        h = ymax - ymin

        xmin = np.clip(xmin - int(w * expand / 2), 0, W)
        ymin = np.clip(ymin - int(h * expand / 2), 0, H)
        xmax = np.clip(xmax + int(w * expand / 2), 0, W)
        ymax = np.clip(ymax + int(h * expand / 2), 0, H)

        w = xmax - xmin
        h = ymax - ymin

        font_size = result_blk["font_size"]
        font_size = np.clip(font_size, 12, 32)

        box_style = {
            'left': xmin,
            'top': ymin,
            'width': w+20,
            'height': "fit-content",
            'font-size': f'{font_size}px',
            'z-index': z_index,
        }
        box_style = ' '.join(f'{k}:{v};' for k, v in box_style.items())
        return box_style

    @staticmethod
    def get_container_style(result, img_path):
        style = {
            'width': result['img_width'],
            'height': result['img_height'],
            'background-image': f'url("{img_path}")'
        }

        style = ' '.join(f'{k}:{v};' for k, v in style.items())
        return style

    @staticmethod
    def get_icon(name):
        return (ICONS_PATH / name).with_suffix('.svg').read_text()

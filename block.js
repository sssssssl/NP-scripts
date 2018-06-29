// ==UserScript==
// @name         North-Plus Block
// @namespace    https://github.com/sssssssl/NP-Scripts
// @version      0.1
// @description  为北+提供关键词屏蔽功能
// @author       sl
// @match        https://bbs.white-plus.net/thread.php?fid-*
// @grant GM_setValue
// @grant GM_getValue
// ==/UserScript==

(function() {
    'use strict';


    const STORE_BLOCK_MODE_KEY = 'blockEnabled';
    const STORE_BLOCK_WORDS_KEY = 'blockWords';

    const ID_BTN_BLOCK_SWITCH = 'np-block-switch';
    const ID_BTN_SHOW_LIST = 'np-block-btn-show-list';
    const ID_NP_BLOCK_LIST_CONTAINER = 'np-block-list-container';
    const ID_NP_BLOCK_LIST = 'np-block-list';

    const ID_BTN_ADD_WORD = 'np-block-list-add-btn';
    const ID_INPUT_WORD = 'np-block-list-add-input';
    const CLS_BTN_DEL_WORD = 'btn-delete-block-word';

    const CLS_MODE_DISABLED = 'np-block-disabled';
    const CLS_MODE_ENABLED = 'np-block-enabled';
    const CLS_LIST_UNFOLD = 'np-list-unfold';
    const CLS_LIST_FOLD = 'np-list-fold';
    const CLS_LIST_ITEM = 'block-list-item';

    const NP_BLOCK_HTML = `
        <div id="np-block">
            <div id="np-block-header">
                <span>屏蔽模式</span>
                <span id="${ID_BTN_BLOCK_SWITCH}" class="${CLS_MODE_DISABLED} np-clickable">关</span>
            </div>
            <div id="${ID_BTN_SHOW_LIST}" class="${CLS_MODE_DISABLED} np-clickable">屏蔽列表</div>
            <div id="${ID_NP_BLOCK_LIST_CONTAINER}" class="${CLS_LIST_FOLD}">
                <div id="${ID_NP_BLOCK_LIST}"> 
                </div>
                <div id="np-block-list-add" class="block-list-item">
                    <input id="np-block-list-add-input" type="text">
                    <span id="np-block-list-add-btn" class="np-clickable">加</span>
                </div>
            </div>
        </div>
    `;

    const NP_BLOCK_STYLE = `
        <style>
        #np-block {
            position: fixed;
            width: 140px;
            top: 10px;
            right: 10px;
            background-color: rgb(234, 237, 237);
        }

        #np-block > * {
            width: 90%;
            margin-left: auto;
            margin-right: auto;
            text-align: center;
            margin-top: 5px;
        }
        
        #${ID_BTN_BLOCK_SWITCH} {
            padding-left: 10px;
            padding-right: 10px;
            float: right;
            transition: all 0.5s;
        }
        
        #${ID_BTN_SHOW_LIST} {
            transition: all 0.5s;
        }
        
        .${CLS_MODE_DISABLED} {
            background-color: black;
            color: white;
        }
        
        .${CLS_MODE_ENABLED} {
            background-color: white;
            color: black;
        }
        
        #${ID_NP_BLOCK_LIST_CONTAINER} {
            overflow: hidden;
            transition: all 0.5s;
        }
        
        .${CLS_LIST_FOLD} {
            max-height: 0px;
        }
        
        .${CLS_LIST_UNFOLD} {
            max-height: 250px;
            margin-bottom: 5px;
        }
        
        #${ID_NP_BLOCK_LIST} {
            max-height: 200px;
            overflow-y: scroll;
        }
        
        #${ID_NP_BLOCK_LIST}::-webkit-scrollbar {
            display: none;
        }
        
        .${CLS_LIST_ITEM} {
            text-align: center;
            background-color: rgb(33, 47, 61);
            color: white;
            width: 90%;
            margin-left: auto;
            margin-right: auto;
            margin-top: 5px;
        }
        
        .${CLS_BTN_DEL_WORD} {
            float: right;
            background-color: red;
            padding-right: 10px;
            padding-left: 10px;
            transition: all 0.5s;
        }
        
        .${CLS_BTN_DEL_WORD}:hover {
            background-color: rgb(192, 57, 43);
        }
        
        #np-block-list-add {
            background-color: inherit;
        }
        
        #np-block-list-add-input {
            appearance: none;
            font-size: 1em;
            width: 60%;
            border: none;
            margin: auto auto;
            box-sizing: border-box;
        }
        
        #np-block-list-add-input:focus {
            outline: 0;
        }
        
        #np-block-list-add-btn {
            float: right;
            background-color: green;
            padding-right: 10px;
            padding-left: 10px;
            transition: all 0.5s;
        }
        
        #np-block-list-add-btn:hover {
            background-color: rgb(28, 40, 51);
        }

        .np-clickable {
            cursor: default;
        }

        .np-clickable:hover {
            cursor: pointer;
        }
        </style>
    `;

    // 2. CODE ENTRYPOINT.

    let blockModeEnabled = GM_getValue(STORE_BLOCK_MODE_KEY, false);
    let blockWords = GM_getValue(STORE_BLOCK_WORDS_KEY);
    if(!blockWords) {
        blockWords = [];
    }
    console.log(`block words: ${blockWords}`);

    // add panel & register callbacks.
    document.head.insertAdjacentHTML('beforeend', NP_BLOCK_STYLE);
    document.body.insertAdjacentHTML('beforeend', NP_BLOCK_HTML);

    let btnBlockSwitch = document.getElementById(ID_BTN_BLOCK_SWITCH)
    let btnShowlist = document.getElementById(ID_BTN_SHOW_LIST);
    let btnAddWord = document.getElementById(ID_BTN_ADD_WORD);
    let inputWord = document.getElementById(ID_INPUT_WORD);
    let npBlockListContainer = document.getElementById(ID_NP_BLOCK_LIST_CONTAINER);
    let npBlockList = document.getElementById(ID_NP_BLOCK_LIST);

    btnShowlist.onclick = () => {
        btnShowlist.classList.toggle(CLS_MODE_DISABLED);
        btnShowlist.classList.toggle(CLS_MODE_ENABLED);
        npBlockListContainer.classList.toggle(CLS_LIST_FOLD);
        npBlockListContainer.classList.toggle(CLS_LIST_UNFOLD);
    };

    btnBlockSwitch.onclick = () => {
        btnBlockSwitch.classList.toggle(CLS_MODE_DISABLED);
        btnBlockSwitch.classList.toggle(CLS_MODE_ENABLED);
        blockModeEnabled = !blockModeEnabled;
        btnBlockSwitch.textContent = blockModeEnabled ? '开' : '关';
        GM_setValue(STORE_BLOCK_MODE_KEY, blockModeEnabled);
    };

    btnAddWord.onclick = () => {
        let word = inputWord.value;
        if(word.length == 0) {
            return;
        }
        inputWord.value = '';
        blockWords.push(word);
        GM_setValue(STORE_BLOCK_WORDS_KEY, blockWords);
        renderBlockWord(word);
    }

    btnBlockSwitch.textContent = blockModeEnabled ? '开' : '关';
    if(blockModeEnabled && btnBlockSwitch.classList.contains(CLS_MODE_DISABLED)) {
        btnBlockSwitch.classList.toggle(CLS_MODE_DISABLED);
        btnBlockSwitch.classList.toggle(CLS_MODE_ENABLED);
    }

    blockWords.forEach(renderBlockWord);

    if(blockModeEnabled) {
        let titleList = parseThreadTitle();

    }

    function parseThreadTitle() {
        let titleList = [];
        let threads = document.querySelectorAll('.tr3.t_one');
        threads.forEach((elem) => {
            let title = elem.querySelector('h3 a').textContent;
            blockWords.forEach(word => {
                if(title.includes(word)) {
                    elem.remove();
                }
            });
        });
    }

    function addDeleteWordCallback(btn) {
        btn.onclick = () => {
            let word = btn.previousElementSibling.textContent;
            let idx = blockWords.indexOf(word);
            if(idx >= 0) {
                blockWords.splice(idx, 1);
                GM_setValue(STORE_BLOCK_WORDS_KEY, blockWords);
                btn.parentElement.remove();
            }
            else {
                console.log(`${word}, ${idx}`);
            }
        };
    }

    function renderBlockWord(word) {
        let wordHTML = `
            <div class="${CLS_LIST_ITEM}">
                <span class="block-word">${word}</span>
                <span class="${CLS_BTN_DEL_WORD} np-clickable">删</span>
            </div>
        `;
        npBlockList.insertAdjacentHTML('afterbegin', wordHTML);
        let newDelBtn = npBlockList.querySelector(`.${CLS_BTN_DEL_WORD}`);
        addDeleteWordCallback(newDelBtn);
    }

})();
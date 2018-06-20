// ==UserScript==
// @name         North-Plus SFW
// @namespace    https://github.com/sssssssl/NP-scripts
// @version      0.1
// @description  把这群丧尸的H头像换成安全头像，就可以在公共场合上北+啦
// @author       sl
// @match        https://bbs.white-plus.net/read.php?tid*
// @require      https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 1. CONSTANTS.

    const TIME_FADE_IN = 5;
    const TIME_FADE_OUT = 0.5;

    const CLS_AVATAR = 'img.pic';
    const BASE_URL = 'images/face';
    const SAFE_AVATARS = [
        'a3.gif', '7.gif', 'a10.gif', 'a14.gif', 'a8.gif',
        '4.gif', '0.gif', '3.gif', 'a12.gif', 'none.gif',
        'a4.gif', '5.gif', 'a11.gif', '8.gif', 'a6.gif',
        '2.gif', 'a15.gif', '9.png', 'a7.gif', 'a9.gif',
        'a16.gif', '6.gif', 'a5.gif', 'a13.gif', 'a2.gif',
    ];
    const N = SAFE_AVATARS.length;

    const CLS_IMG = '.f14 img';
    const CLS_IMG_BLOCKER = 'img-blocker';
    const CLS_BLOCKER_ENABLED = 'blocker-enabled';
    const BLOCKER_STYLE = `
    div.${CLS_BLOCKER_ENABLED} {
        position:absolute;
        background-color:#F2F3F4;
        opacity: 1;
        transition: opacity ${TIME_FADE_OUT}s;
    }
    div.${CLS_BLOCKER_ENABLED}:hover {
        opacity: 0;
        transition: opacity ${TIME_FADE_IN}s;
    }`;

    // 2. CODE ENTRYPOINT.

    Array.from(document.querySelectorAll(CLS_AVATAR)).forEach((im) => {
        im.src = getRandomAvatar();
        im.style.width = `150px`;
        im.style.height = `150px`;
    });

    const imgs = Array.from(document.querySelectorAll(CLS_IMG)).filter(
        (im) => {
            return (!im.src.includes('images/post'));
        });;

    if (imgs) {

        let blockerStyleTag = document.createElement('style');
        blockerStyleTag.textContent = BLOCKER_STYLE;
        document.head.append(blockerStyleTag);

        imgs.forEach((im) => {
            let blocker = document.createElement('div');
            blocker.classList.add(CLS_IMG_BLOCKER);
            blocker.classList.add(CLS_BLOCKER_ENABLED);
            blocker.style.height = `${im.height}px`;
            blocker.style.width = `${im.width}px`;
            let wrapper = document.createElement('div');
            im.parentElement.insertBefore(wrapper, im);
            wrapper.append(blocker, im);

            wrapper.addEventListener('click', (e) => {
                if (blocker.style.display) {
                    blocker.style.display = '';
                    event.stopImmediatePropagation();
                }
                else {
                    blocker.style.display = 'none';
                }
            }, true);
        });
    }

    function getRandomAvatar() {
        let index = Math.floor(Math.random() * N);
        return `${BASE_URL}/${SAFE_AVATARS[index]}`;
    }

})();
// ==UserScript==
// @name         North-Plus SFW Avatars
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

    // Your code here...
    var base_url = 'images/face/';
    var safe_avatars = [
        'a3.gif', '7.gif', 'a10.gif', 'a14.gif', 'a8.gif',
        '4.gif', '0.gif', '3.gif', 'a12.gif', 'none.gif',
        'a4.gif', '5.gif', 'a11.gif', '8.gif', 'a6.gif',
        '2.gif', 'a15.gif', '9.png', 'a7.gif', 'a9.gif',
        'a16.gif', '6.gif', 'a5.gif', 'a13.gif', 'a2.gif',
    ];
    var N = safe_avatars.length;

    function getRandomAvatar() {
        var index = Math.floor(Math.random() * N);
        var url = base_url + safe_avatars[index];
        return url;
    }

    $('img.pic').each(function () {
        $(this).attr('src', getRandomAvatar());
        $(this).attr('width', '150');
        $(this).attr('height', '150');
    });

})();
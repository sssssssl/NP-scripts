// ==UserScript==
// @name         North-Plus Auto Task
// @namespace    https://github.com/sssssssl
// @version      0.3
// @description  自动领取和完成北+日常和周常任务
// @author       sl
// @match        https://*.white-plus.net
// @match        https://*.white-plus.net/index.php
// @match        https://*.south-plus.net
// @match        https://*.white-plus.net/index.php
// @match        https://*.imoutolove.me
// @match        https://*.imoutolove.me/index.php
// @require      https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @grant GM_setValue
// @grant GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // Your code here...

    var taskBaseURL = 'plugin.php?H_name=tasks&action=ajax&actions=job&cid=';
    var rewardBaseURL = 'plugin.php?H_name=tasks&action=ajax&actions=job2&cid=';

    var taskDailyID = '15';
    var taskWeeklyID = '14';

    var taskDailyKey = 'lastTaskDaily';
    var taskWeeklyKey = 'lastTaskWeekly';

    var taskDailyInterval = 1000 * 60 * 60 * 24;
    var taskWeeklyInterval = taskDailyInterval * 7;

    function checkTask(now, taskID, taskKey, taskInterval) {
        var lastSignIn = GM_getValue(taskKey);
        if (lastSignIn === undefined || (now - lastSignIn) > taskInterval) {
            // 领取任务
            $.get(taskBaseURL + taskID, function (data, status) {
                console.log(data);
                console.log(status);

                setTimeout(function () {
                    // 等 1.5s，领取奖励
                    $.get(rewardBaseURL + taskID, function (data, status) {
                        console.log(data);
                        console.log(status);

                        GM_setValue(taskKey, now);
                    });
                }, 1500);

            });
        }
        else {
            // do nothing.
            var interval = (now - lastSignIn) / (1000);
            console.log('距离上次任务过了 ' + interval + ' 秒');
        }
    }

    var now = Date.now();
    checkTask(now, taskDailyID, taskDailyKey, taskDailyInterval);
    setTimeout(function () {
        checkTask(now, taskWeeklyID, taskWeeklyKey, taskWeeklyInterval);
    }, 1500);


})();
// ==UserScript==
// @name         North-Plus Notification
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  查看自己发的主题的回复
// @author       sl
// @match        https://*.white-plus.net/*
// @match        https://*.south-plus.net/*
// @match        https://*.imoutolove.me/*
// @require      https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
	'use strict';

	// 1. CONSTANTS

	var lastPullTimeKey = 'lastPullTime';
	var unACKTimeKey = 'lastUnACKTime';
	var unACKDataKey = 'unACKData';
	var mappingKey = 'tidCommentMap';
	var uidKey = 'uid';
	// this needs to be tested.
	var pullInterval = 1000 * 60 * 2;
	var maxUnACKAge = 1000 * 60 * 1;
	var checkInterval = 1000 * 5 * 1;
	var maxRetry = 5;

	// 2. GLOBAL STATE

	var debug = true;

	var g = {
		url : window.location.href,
		stopNofitication: false,
		firstSetUp: true,
		stopLoop: false,
		retry: 0,
		has_mypost_btn: false,
		checkInterval: checkInterval,
		pullInterval: pullInterval
	};

	var originalTitle = document.title;

	// 3. CODE ENTRYPOINT

	var lastPullTime = GM_getValue(lastPullTimeKey);
	// 第一次在用户机器上运行
	if (!lastPullTime) {
		getPostStatus(true);
	}

	grabUserInfo();
	addStopBlinkCallback();
	addSelfCommentCallback();
	mainLoop();

	function mainLoop() {
		app();
		setTimeout(function () {
			if (!g.stopLoop) {
				mainLoop();
			}
		}, g.checkInterval);
	}

	function app() {
		var unACKData = GM_getValue(unACKDataKey);
		if (unACKData) {
			log_debug(['存在未合并数据', unACKData]);

			g.stopNotification = false;
			sendNotification(unACKData);

			var lastUnACKTime = GM_getValue(unACKTimeKey);
			var now = Date.now()
			// 当未确认数据寿命达到允许的最大值，进行合并
			if (lastUnACKTime && (now - lastUnACKTime) > maxUnACKAge) {
				updateMapping(unACKData);
			}
		}
		else {
			getPostStatus(false);
		}
	}

	function getPostStatus(first = false) {

		function timeCheck() {
			var now = Date.now();
			var lastPullTime = GM_getValue(lastPullTimeKey);
			if (lastPullTime) {
				var dtime = (now - lastPullTime);
				log_debug('距离上次拉取评论 ' + (dtime / 1000) + ' 秒');
			}
			return !(lastPullTime && dtime < g.pullInterval);
		}

		var needUpdate = timeCheck();

		if (!needUpdate) {
			g.checkInterval = g.checkInterval + 1000 * 5;
			g.checkInterval = Math.min(g.checkInterval, 1000 * 20);
			g.pullInterval = g.pullInterval + 1000 * 60 * 1;
			if (g.pullInterval > 1000 * 60 * 4) {
				g.pullInterval = pullInterval;
			}
		}
		else {
			g.checkInterval = checkInterval;
			g.pullInterval = pullInterval;
		}

		if (needUpdate) {

			GM_setValue(lastPullTimeKey, Date.now());

			function getPostURL(debug) {
				return 'u.php?action-topic.html';
			}

			var myPostURL = getPostURL(debug);

			$.ajax({
				url: myPostURL,
				type: 'GET',
				success: function (data) {
					var diffInfo = compareMapping(data);
					if (diffInfo.nNewComment > 0) {
						if (first) {
							log_debug('首次执行.');
							updateMapping(diffInfo);
						}
						else {
							log_debug(['写入 unACKData:', diffInfo]);
							GM_setValue(unACKDataKey, diffInfo);
							GM_setValue(unACKTimeKey, Date.now());
							sendNotification(diffInfo);
						}
					}
					else {
						log_debug('评论数量没有变化.');
					}
				},
				error: function (data) {
					g.retry += 1;
					if (g.retry == maxRetry) {
						g.stopLoop = true;
						log_debug('网络似乎有问题，停止拉取评论');
					}
					log_debug([data]);
				}
			});

		}
	}


	// 4. DATA PROCESSING

	// 比较拉取到的评论数与本地保存的评论数的区别
	function compareMapping(data) {
		var mapping = GM_getValue(mappingKey);
		if (!mapping) {
			mapping = {};
		}

		var diffInfo = {
			nNewComment: 0,
			diffMap: {}
		};

		var pat = /read.php\?tid-(\d+).html.+?回复:(\d+)/g;
		var m;
		while (m = pat.exec(data)) {
			var tid = m[1];
			var num = parseInt(m[2]);
			if (!(tid in mapping) || (mapping[tid] < num)) {

				diffInfo.diffMap[tid] = num;
				// new post
				if (!(tid in mapping)) {
					diffInfo.nNewComment += num;
				}
				// old post, new comment
				else {
					diffInfo.nNewComment += num - mapping[tid];
				}
			}
		}
		// debug
		if (diffInfo.nNewComment > 0) {
			log_debug([
				'from compareMapping:',
				'有 ' + diffInfo.nNewComment + ' 条新评论.',
				diffInfo.diffMap,
			]);
		}
		return diffInfo;
	}

	function updateMapping(diffInfo) {
		var diffMap = diffInfo.diffMap;
		var mapping = GM_getValue(mappingKey);
		if (!mapping) {
			mapping = diffMap;
		}
		else {
			for (var t in diffMap) {
				mapping[t] = diffMap[t];
			}
		}
		GM_setValue(mappingKey, mapping);
		GM_setValue(unACKDataKey, null);
		GM_setValue(unACKTimeKey, null);

		log_debug([
			'from updateMapping',
			'写入 mapping:',
			mapping,
		]);
	}

	function grabUserInfo() {
		var uid = GM_getValue(uidKey);
		if(uid) {
			g.uid = uid;
			return;
		}
		log_debug('try to get uid from page...');
		var userInfo = $('span.user-infoWraptwo');
		if(!userInfo) {
			log_debug('no userinfo span, unable to get uid.');
			return;
		}
		var userData = $(userInfo).text();
		var uidPat =  /UID:\s(\d+)/;
		var m = uidPat.exec(userData);
		if(m && m.length) {
			uid = m[1];
			log_debug(`got uid: ${uid}.`);
			g.uid = uid;
			GM_setValue(uidKey, uid);
		}
	}

	// 自己发的评论不会导致回复数增加
	function addSelfCommentCallback() {
		var form = $('form[name=FORM]');
		if(!form) {
			log_debug('no form, no worries.');
			return;
		}
		var modifyPat = /post.php\?action-modify/;
		// 编辑回复页面，不增加回复数
		if(modifyPat.test(g.url)) {
			log_debug('modify page...');
			return;
		}
		$(form).on('submit', function() {
			var tid = $('form > input[name=tid]').attr('value');
			log_debug(`tid: ${tid}`);
			if(!tid) {
				log_debug('发帖页面，不是评论，无 tid');
				return;
			}
			// 评论
			var mapping = GM_getValue(mappingKey);
			if(!mapping) {
				mapping = {};
			}
			// 可能是自己刚刚发的帖子，也可能是别人的帖子
			// 给刚刚发的帖子评论就无视掉好了
			if(!(tid in mapping)) {
				// var newTidList = GM_getValue(newTIdListKey, []);
				// newTidList.push(tid);
				// GM_setValue(newTIdListKey, newTidList);
				log_debug(`对 tid=${tid} 的帖子评论.`);
			}
			else {
				mapping[tid] += 1;
				GM_setValue(mappingKey, mapping);
				log_debug('回复自己的帖子.')
			}
		});
	}


	// 5. UI

	// 给【我的主题】按钮添加停止闪烁的回调函数，每个页面只要做一次就行了
	function addStopBlinkCallback() {
		var myPostButton = $('#infobox').find('.link5')[0];
		// 有些页面没有这个按钮，不需要更新 UI。
		if (!myPostButton) {
			g.has_mypost_btn = false;
			return;
		}
		else {
			g.has_mypost_btn = true;
		}
		$(myPostButton).wrap('<span></span>');
		var span = $(myPostButton).parent()[0];
		addSpinEffect();
		// enforce event capture, disable event bubbling.
		span.addEventListener('click', function (e) {
			var unACKData = GM_getValue(unACKDataKey);
			if (unACKData) {
				updateMapping(unACKData);
			}
			g.stopNofitication = true;
		}, true);
	}

	function addSpinEffect() {
		$('head').append('<style>#btn-my-post ' +
			'{display: inline-block; font-weight:bold;' +
			'animation:myfirst 2s;animation-iteration-count:infinite;' +
			'-webkit-animation: myfirst 2s;-webkit-animation-iteration-count: infinite;}' +
			'@keyframes myfirst {' +
			'0% { transform: rotate(0deg) scale(1, 1);; }'+
			'25% { transform: rotate(45deg) scale(1.5, 1.5);; }'+
			'50% { transform: rotate(-45deg) scale(1.5, 1.5);; }'+
			'100% { transform: rotate(0deg) scale(1, 1);; }}'+
			'@-webkit-keyframes myfirst {' +
			'0% { transform: rotate(0deg) scale(1, 1);; }'+
			'25% { transform: rotate(45deg) scale(1.5, 1.5);; }'+
			'50% { transform: rotate(-45deg) scale(1.5, 1.5);; }'+
			'100% { transform: rotate(0deg) scale(1, 1);; }}'+
			'#btn-my-post > a {color:#FF0000}' +
			'</style>'
		);
	}

	function sendNotification(diffInfo) {

		if (!g.has_mypost_btn) {
			return;
		}

		log_debug([
			'from sendNotification',
			'stopNofitication:' + g.stopNofitication,
			'firstSetUp: ' + g.firstSetUp,
		]);

		var nNewComment = diffInfo.nNewComment;
		if (!nNewComment) {
			return;
		}

		var title_blk = "【新回复 x " + nNewComment + "】" + originalTitle;

		var title_list = [originalTitle, title_blk];
		var fw_list = ['normal', 'bold'];

		var myPostButton = $('#infobox').find('.link5')[0];
		$(myPostButton).text('我的主题( ' + nNewComment + ' 条新回复)');

		function updateStyle(index) {
			document.title = title_list[index];
		}

		var nl = {
			index: 0,
		};

		function blink() {
			setTimeout(function () {
				nl.index = 1 - nl.index;
				updateStyle(nl.index);
				if (g.stopNofitication) {
					updateStyle(0);
					$('#btn-my-post').attr('id', '');
				}
				else {
					blink();
				}
			}, 1000);
		};

		if (g.firstSetUp) {

			g.firstSetUp = false;
			blink();

			var span = $(myPostButton).parent()[0];
			$(span).attr('id', 'btn-my-post');
		}
	}

	function log_debug(sl) {
		if (debug) {
			if (sl.constructor === String) {
				console.log(sl);
			}
			else if (sl.constructor === Array) {
				sl.forEach(function (s) {
					console.log(s);
				});
			}
		}
	}

})();
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

	// Your code here...

	var lastPullTimeKey = 'lastPullTime';
	var unACKTimeKey = 'lastUnACKTime';
	var unACKDataKey = 'unACKData';
	var mappingKey = 'tidCommentMap';
	// this needs to be tested.
	var pullInterval = 1000 * 60 * 2;
	var maxUnACKAge = 1000 * 60 * 1;
	var checkInterval = 1000 * 5 * 1;
	var maxRetry = 5;

	var debug = true;

	var g = {
		stopNofitication: false,
		firstSetUp: true,
		stopLoop: false,
		retry: 0,
		has_mypost_btn: false,
		checkInterval: checkInterval,
		pullInterval: pullInterval
	};

	var originalTitle = document.title;

	var lastPullTime = GM_getValue(lastPullTimeKey);
	// 第一次在用户机器上运行
	if (!lastPullTime) {
		getPostStatus(true);
	}

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
				console.log('距离上次拉取评论 ' + (dtime / 1000) + ' 秒');
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
							console.log('首次执行.');
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
						console.log('评论数量没有变化.');
					}
				},
				error: function (data) {
					g.retry += 1;
					if (g.retry == maxRetry) {
						g.stopLoop = true;
						console.log('网络似乎有问题，停止拉取评论');
					}
					console.log(data);
				}
			});

		}
	}


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

	// 自己发的评论不会导致回复数增加
	function addSelfCommentCallback() {
		var form = $('form[name=FORM]');
		if(!form) {
			console.log('no form, no worries.');
			return;
		}
		$(form).on('submit', function() {
			var tid = $('form > input[name=tid]').attr('value');
			console.log(`tid: ${tid}`);
			var mapping = GM_getValue(mappingKey);
			if(!mapping) {
				mapping = {};
			}
			if(!(tid in mapping)) {
				mapping[tid] = 1;
			}
			else {
				mapping[tid] += 1;
			}
			GM_setValue(mappingKey, mapping);
			console.log('self comment done.')
		});
	}

	function addSpinEffect() {
		$('head').append('<style>#btn-my-post ' +
			'{display: inline-block; font-weight:bold;' +
			'animation:myfirst 2s;animation-iteration-count:infinite;' +
			'-webkit-animation: myfirst 2s;-webkit-animation-iteration-count: infinite;}' +
			'@keyframes myfirst {' +
			'0% { transform: rotate(0deg) scale(1, 1);; }'+
			'25% { transform: rotate(45deg) scale(2, 2);; }'+
			'50% { transform: rotate(-45deg) scale(2, 2);; }'+
			'100% { transform: rotate(0deg) scale(1, 1);; }}'+
			'@-webkit-keyframes myfirst {' +
			'0% { transform: rotate(0deg) scale(1, 1);; }'+
			'25% { transform: rotate(45deg) scale(2, 2);; }'+
			'50% { transform: rotate(-45deg) scale(2, 2);; }'+
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
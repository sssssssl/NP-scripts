// ==UserScript==
// @name         Notification Test
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        http://localhost:5000/
// @require  https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
	'use strict';

	// Your code here...

	var lastUpdateMappingTimeKey = 'lastUpdateMappingTime';
	var unACKTimeKey = 'lastUnACKTime';
	var unACKDataKey = 'unACKData';
	var mappingKey = 'tidCommentMap';
	// this needs to be tested.
	var pullInterval = 1000 * 60 * 0.25;
	var maxUnACKAge = 1000 * 10 * 1;
	var checkInterval = 1000 * 5 * 1;
	var maxRetry = 3;
	var debug = true;

	var g = {
		stopNofitication : false,
		initNotification : true,
		stopLoop : false,
		retry : 0
	};

	var originalTitle = document.title;
	// var stopLoop = false;
	// var retry = 0;
	// var stopNotification = true;
	// var initNotification = true;


	var lastPullTime = GM_getValue(lastUpdateMappingTimeKey);
	// 第一次在用户机器上运行
	if (!lastPullTime) {
		getPostStatus(true);
	}

	addStopBlinkCallback();
	mainLoop();

	function mainLoop() {
		setTimeout(function () {
			// 先等 5s
			if (!g.stopLoop) {
				app();
				mainLoop();
			}
		}, checkInterval);
	}

	function app() {
		var unACKData = GM_getValue(unACKDataKey);
		if (unACKData) {
			log_debug(['存在未合并数据', unACKData]);

			var lastUnACKTime = GM_getValue(unACKTimeKey);
			var now = Date.now()
			// 过了很久还不点确认，人家不想提醒你了！
			if (lastUnACKTime && (now - lastUnACKTime) > maxUnACKAge) {
				updateMapping(unACKData);
			}
			// 刚生成数据，提醒。
			else {
				g.stopNotification = false;
				sendNotification(unACKData);
			}
		}
		else {
			getPostStatus(false);
		}
	}

	function getPostStatus(first = false) {

		function timeCheck() {
			var now = Date.now();
			var lastPullTime = GM_getValue(lastUpdateMappingTimeKey);
			if (lastPullTime) {
				var dtime = (now - lastPullTime);
				console.log('距离上次拉取评论 ' + (dtime / 1000) + ' 秒');
			}
			return !(lastPullTime && dtime < pullInterval);
		}

		var needUpdate = timeCheck();

		if (needUpdate) {

			GM_setValue(lastUpdateMappingTimeKey, Date.now());

			function getPostURL(debug) {
				if (debug) {
					return 'posts';
				}
				else {
					return 'u.php?action-topic.html';
				}

			}

			var myPostURL = getPostURL(debug);

			$.ajax({
				url: myPostURL,
				type: 'GET',
				success: function (data) {
					var diffInfo = getCompareFunc(debug)(data);
					if (diffInfo.nNewComment > 0) {
						if (first) {
							console.log('首次执行.');
							updateMapping(diffInfo);
						}
						else {
							log_debug(['写入 unACKData:', diffInfo]);
							GM_setValue(unACKDataKey, diffInfo);
							GM_setValue(unACKTimeKey, Date.now());
							g.initNotification = true;
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

	function getCompareFunc(debug) {
		if (debug) {
			return testCompare;
		}
		else {
			return compareMapping;
		}
	}


	function testCompare(s) {
		var mapping = GM_getValue(mappingKey);
		if (!mapping) {
			mapping = {};
		}

		var diffInfo = {
			nNewComment: 0,
			diffMap: {}
		};

		var data = JSON.parse(s);
		for (var tid in data) {
			var num = parseInt(data[tid]);
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
		log_debug([
			'from updateMapping',
			'写入 mapping:',
			mapping,
		]);
		GM_setValue(mappingKey, mapping);
		GM_setValue(unACKDataKey, null);
		GM_setValue(unACKTimeKey, null);
	}

	// 给【我的主题】按钮添加停止闪烁的回调函数，每个页面只要做一次就行了
	function addStopBlinkCallback() {
		var myPostButton = $('#infobox').find('.link5')[0];
		$(myPostButton).wrap('<span></span>');
		var span = $(myPostButton).parent()[0];
		addSpinEffect();
		// enforce event capture, disable event bubbling.
		span.addEventListener('click', function (e) {
			var unACKData = GM_getValue(unACKDataKey);
			if(unACKData) {
				updateMapping(unACKData);
			}
			g.stopNofitication = true;
		}, true);
	}

	function addSpinEffect() {
		$('head').append('<style>#btn-my-post ' +
			'{display: inline-block;color:#BBBBBB;' +
			'animation:myfirst 2s;animation-iteration-count:infinite;}' +
			'-webkit-animation: myfirst 2s;-webkit-animation-iteration-count: infinite;' +
			'@keyframes myfirst' +
			'{from {color:#BBBBBB; transform: :rotate(0deg);}' +
			'to {color:#C70039;font-weight:bold; transform:rotate(360deg);}}' +
			'@-webkit-keyframes myfirst' +
			'{from {color:#BBBBBB; transform: :rotate(0deg);}' +
			'to {color:#C70039;font-weight:bold; transform:rotate(360deg);}}</style>'
		);
	}

	function sendNotification(diffInfo) {

		log_debug([
			'from sendNotification',
			'stopNofitication:' + g.stopNofitication,
			'initNotification: ' + g.initNotification,
		]);

		var nNewComment = diffInfo.nNewComment;
		if (!nNewComment) {
			return;
		}

		var title_blk = "【新回复 x " + nNewComment + "】" + originalTitle;

		var title_list = [originalTitle, title_blk];
		var color_list = ['#BBBBBB', '#FF5733'];
		var fw_list = ['normal', 'bold'];

		var myPostButton = $('#infobox').find('.link5')[0];
		$(myPostButton).text('我的主题( ' + nNewComment + ' 条新回复)');

		function updateStyle(index) {
			document.title = title_list[index];
			// $(myPostButton).css('color', color_list[index]);
			// $(myPostButton).css('font-weight', fw_list[index]);
		}

		var nl = {
			index : 0,
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

		if (g.initNotification) {

			g.initNotification = false;
			g.stopNofitication = false;
			blink();

			var myPostButton = $('#infobox').find('.link5')[0];
			var span = $(myPostButton).parent()[0];
			$(span).attr('id', 'btn-my-post');
		}
	}

	function clearData() {
		var keys = [
			lastUpdateMappingTimeKey,
			unACKTimeKey,
			unACKDataKey,
			mappingKey
		];
		keys.forEach(function (k) {
			GM_setValue(k, null);
		});
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
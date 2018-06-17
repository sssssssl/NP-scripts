var lastUpdateMappingTimeKey = 'lastUpdateMappingTime';
var unACKTimeKey = 'lastUnACKTime';
var unACKDataKey = 'unACKData';
var mappingKey = 'tidCommentMap';
// this needs to be tested.
var pullInterval = 1000 * 60 * 3;
var maxUnACKAge = 1000 * 10 * 1;
var checkInterval = 1000 * 5 * 1;

var debug = true;

var stopNotification = true;

var lastPullTime = GM_getValue(lastUpdateMappingTimeKey);
// 第一次在用户机器上运行
if (!lastPullTime) {
	getPostStatus(true);
}

mainLoop();

function mainLoop() {
	setTimeout(function () {
		// 先等 5s
		app();
		mainLoop();
	}, checkInterval);
}

function app() {
	var unACKData = GM_getValue(unACKDataKey);
	if (unACKData) {
		log_debug('存在未合并数据');

		var lastUnACKTime = GM_getValue(unACKTimeKey);
		var now = Date.now()
		// 过了很久还不点确认，人家不想提醒你了！
		if (lastUnACKTime && (now - lastUnACKTime) > maxUnACKAge) {
			updateMapping(unACKData.diffMap);
		}
		// 刚生成数据，提醒。
		else {
			if (stopNotification) {
				stopNotification = false;
				sendNotification(unACKData);
			}
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

		var myPostURL = 'u.php?action-topic.html';

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
	log_debug([
		'from updateMapping',
		'写入 mapping:',
		mapping,
	]);
	GM_setValue(mappingKey, mapping);
	GM_setValue(lastUpdateMappingTimeKey, Date.now());
	GM_setValue(unACKDataKey, null);
	GM_setValue(unACKTimeKey, null);
}

function sendNotification(diffInfo) {

	var nNewComment = diffInfo.nNewComment;
	if (!nNewComment) {
		return;
	}

	var title = document.title;
	var title_blk = "【新回复 x " + nNewComment + "】" + title;

	var title_list = [title, title_blk];
	var color_list = ['#BBBBBB', '#FF5733'];
	var fw_list = ['normal', 'bold'];

	var myPostButton = $('#infobox').find('.link5')[0];
	$(myPostButton).text('我的主题( ' + nNewComment + ' 条新回复)');
	$(myPostButton).wrap('<span></span>');

	var span = $(myPostButton).parent()[0];
	// enforce event capture, disable event bubbling.
	span.addEventListener('click', function (e) {
		updateMapping(diffInfo);
		stopNotification = true;
	}, true);

	var index = 0;

	function updateStyle(index) {
		document.title = title_list[index];
		$(myPostButton).css('color', color_list[index]);
		$(myPostButton).css('font-weight', fw_list[index]);
	}

	function blink() {
		setTimeout(function () {
			index = 1 - index;
			updateStyle(index);
			if (stopNotification) {
				updateStyle(0);
			}
			else {
				blink();
			}
		}, 1000);
	};

	blink();
}

function clearData() {
	var keys = [
		lastUpdateMappingTimeKey,
		unACKTimeKey,
		unACKDataKey,
		mappingKey
	];
	keys.forEach(function (k) {
		GM_deleteValue(k);
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
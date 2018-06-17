var lastPullTimeKey = 'lastPullTime';
var unACKTimeKey = 'lastUnACKTime';
var unACKDataKey = 'unACKData';
var mapKey = 'tidCommentMap';
var pullInterval = 1000 * 60 * 1;
var maxUnACKAge = 1000 * 60 * 0.5;

var debug = true;

var lastPullTime = GM_getValue(lastPullTimeKey);
// 第一次在用户机器上运行
if (!lastPullTime) {
	getPostStatus(true);
}

main_loop();

function main_loop() {
	setTimeout(function () {
		app();
		main_loop();
	}, pullInterval);
}

function app() {
	var unACKData = GM_getValue(unACKDataKey);
	if (unACKData) {
		var lastUnACKTime = GM_getValue(unACKTimeKey);
		var now = Date.now()
		// 过了很久还不点确认，人家不想提醒你了！
		if (lastUnACKTime && (now - lastUnACKTime) > maxUnACKAge) {
			updateMapping(unACKData.diffMap);
		}
		// 刚生成数据，提醒。
		else {
			notificate(unACKData);
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
		return !(lastPullTime && dtime < pullInterval);
	}

	var needUpdate = timeCheck();

	if (needUpdate) {

		GM_setValue(lastPullTimeKey, Date.now());

		var mapping = GM_getValue(mapKey);

		if (!mapping) {
			mapping = {};
		}

		// console.log(mapping);

		var myPostURL = 'u.php?action-topic.html';

		$.ajax({
			url: myPostURL,
			type: 'GET',
			success: function (data) {
				var diffInfo = compareMapping(mapping, data);
				if (diffInfo.nNewComment > 0) {
					if (first) {
						console.log('首次执行.');
						updateMapping(diffInfo);
					}
					else {
						if(debug) {
							console.log('写入 unACKData:');
							console.log(diffInfo);
						}
						GM_setValue(unACKDataKey, diffInfo);
						GM_setValue(unACKTimeKey, Date.now());
						notificate(diffInfo);
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
function compareMapping(mapping, data) {
	var diffInfo = {};
	diffInfo['nNewComment'] = 0;
	diffInfo['diffMap'] = {};

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
	if(diffInfo.nNewComment > 0 && debug) {
		console.log('from compareMapping:');
		console.log('有 ' + diffInfo.nNewComment + ' 条新评论.');
		console.log(diffInfo.diffMap);
	}
	return diffInfo;
}

function updateMapping(diffInfo) {
	var diffMap = diffInfo.diffMap;
	var mapping = GM_getValue(mapKey);
	if (!mapping) {
		mapping = diffMap;
	}
	else {
		for (var t in diffMap) {
			mapping[t] = diffMap[t];
		}
	}
	if(debug) {
		console.log('from updateMapping');
		console.log('写入 mapping:');
		console.log(mapping);
	}
	GM_setValue(mapKey, mapping);
	GM_setValue(unACKDataKey, null);
	GM_setValue(unACKTimeKey, null);
}

function notificate(diffInfo) {

	var nNewComment = diffInfo.nNewComment;
	if (!nNewComment) {
		return;
	}


	var title = document.title;
	var title_blk = "【新回复 x " + nNewComment + "】" + title;
	var title_list = [title, title_blk];

	var color_list = ['#FF5733', '#BBBBBB'];

	var myPostButton = $('#unACKInfobox').find('.link5')[0];
	$(myPostButton).text('我的主题( ' + nNewComment + ' 条新回复)');
	$(myPostButton).css('font-weight', 'bold');
	$(myPostButton).wrap('<span></span>');

	var span = $(myPostButton).parent()[0];
	span.addEventListener('click', function (e) {
		updateMapping(diffInfo);
		stop = true;
	}, true);

	var stop = true;
	var index = 0;

	function blink() {
		setTimeout(function () {
			index = 1 - index;
			document.title = title_list[index];
			$(myPostButton).css('color', color_list[index]);
			if (stop) {
				document.title = title;
				$(myPostButton).css('color', color_list[0]);
			}
			else {
				blink();
			}
		}, 1000);
	};

	blink();
}

function clearData() {
	var keys = [lastPullTimeKey, unACKTimeKey, unACKDataKey, mapKey];
	keys.forEach(function(k) {
		GM_setValue(k, null);
	});
}

'use strict';

var async = require('async');
var nconf = require('nconf');
var S = require('string');
var winston = require('winston');

var db = require('../database');
var user = require('../user');
var notifications = require('../notifications');
var privileges = require('../privileges');
var meta = require('../meta');
var emailer = require('../emailer');
var plugins = require('../plugins');

module.exports = function(Topics) {

	Topics.toggleFollow = function(tid, uid, callback) {
		callback = callback || function() {};
		var isFollowing;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				Topics.isFollowing([tid], uid, next);
			},
			function (_isFollowing, next) {
				isFollowing = _isFollowing[0];
				if (isFollowing) {
					Topics.unfollow(tid, uid, next);
				} else {
					Topics.follow(tid, uid, next);
				}
			},
			function(next) {
				next(null, !isFollowing);
			}
		], callback);
	};

	Topics.follow = function(tid, uid, callback) {
		setWatching(follow, unignore, 'action:topic.follow', tid, uid, callback);
	};

	Topics.unfollow = function(tid, uid, callback) {
		setWatching(unfollow, unignore, 'action:topic.unfollow', tid, uid, callback);
	};

	Topics.ignore = function(tid, uid, callback) {
		setWatching(ignore, unfollow, 'action:topic.ignore', tid, uid, callback);
	};

	function setWatching(method1, method2, hook, tid, uid, callback) {
		callback = callback || function() {};
		if (!parseInt(uid, 10)) {
			return callback();
		}
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				method1(tid, uid, next);
			},
			function (next) {
				method2(tid, uid, next);
			},
			async.apply(plugins.fireHook, hook, {uid: uid, tid: tid})
		], callback);
	}

	function follow(tid, uid, callback) {
		addToSets('tid:' + tid + ':followers', 'uid:' + uid + ':followed_tids', tid, uid, callback);
	}

	function unfollow(tid, uid, callback) {
		removeFromSets('tid:'+ tid + ':followers', 'uid:' + uid + ':followed_tids', tid, uid, callback);
	}

	function ignore(tid, uid, callback) {
		addToSets('tid:' + tid + ':ignorers', 'uid:' + uid + ':ignored_tids', tid, uid, callback);
	}

	function unignore(tid, uid, callback) {
		removeFromSets('tid:'+ tid + ':ignorers', 'uid:' + uid + ':ignored_tids', tid, uid, callback);
	}

	function addToSets(set1, set2, tid, uid, callback) {
		async.waterfall([
			function (next) {
				db.setAdd(set1, uid, next);
			},
			function(next) {
				db.sortedSetAdd(set2, Date.now(), tid, next);
			}
		], callback);
	}

	function removeFromSets(set1, set2, tid, uid, callback) {
		async.waterfall([
			function (next) {
				db.setRemove(set1, uid, next);
			},
			function(next) {
				db.sortedSetRemove(set2, tid, next);
			}
		], callback);
	}

	Topics.isFollowing = function(tids, uid, callback) {
		isIgnoringOrFollowing('followers', tids, uid, callback);
	};

	Topics.isIgnoring = function(tids, uid, callback) {
		isIgnoringOrFollowing('ignorers', tids, uid, callback);
	};

	function isIgnoringOrFollowing(set, tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return callback();
		}
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function() { return false; }));
		}
		var keys = tids.map(function(tid) {
			return 'tid:' + tid + ':' + set;
		});
		db.isMemberOfSets(keys, uid, callback);
	}

	Topics.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', callback);
	};

	Topics.getIgnorers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':ignorers', callback);
	};

	Topics.filterIgnoringUids = function(tid, uids, callback) {
		async.waterfall([
			function (next){
				db.isSetMembers('tid:' + tid + ':ignorers', uids, next);
			},
			function (isMembers, next){
				var readingUids = uids.filter(function(uid, index) {
					return uid && isMembers[index];
				});
				next(null, readingUids);
			}
		], callback);
	};

	Topics.notifyFollowers = function(postData, exceptUid, callback) {
		callback = callback || function() {};
		var followers;
		var title;
		var titleEscaped;

		async.waterfall([
			function (next) {
				Topics.getFollowers(postData.topic.tid, next);
			},
			function (followers, next) {
				if (!Array.isArray(followers) || !followers.length) {
					return callback();
				}
				var index = followers.indexOf(exceptUid.toString());
				if (index !== -1) {
					followers.splice(index, 1);
				}
				if (!followers.length) {
					return callback();
				}

				privileges.topics.filterUids('read', postData.topic.tid, followers, next);
			},
			function (_followers, next) {
				followers = _followers;
				if (!followers.length) {
					return callback();
				}
				title = postData.topic.title;

				if (title) {
					title = S(title).decodeHTMLEntities().s;
					titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
				}

				notifications.create({
					bodyShort: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + titleEscaped + ']]',
					bodyLong: postData.content,
					pid: postData.pid,
					path: '/post/' + postData.pid,
					nid: 'new_post:tid:' + postData.topic.tid + ':pid:' + postData.pid + ':uid:' + exceptUid,
					tid: postData.topic.tid,
					from: exceptUid,
					mergeId: 'notifications:user_posted_to|' + postData.topic.tid,
					topicTitle: title
				}, next);
			},
			function (notification, next) {
				if (notification) {
					notifications.push(notification, followers);
				}

				if (parseInt(meta.config.disableEmailSubscriptions, 10) === 1) {
					return next();
				}

				async.eachLimit(followers, 3, function(toUid, next) {
					async.parallel({
						userData: async.apply(user.getUserFields, toUid, ['username', 'userslug']),
						userSettings: async.apply(user.getSettings, toUid)
					}, function(err, data) {
						if (err) {
							return next(err);
						}
						if (data.userSettings.sendPostNotifications) {
							emailer.send('notif_post', toUid, {
								pid: postData.pid,
								subject: '[' + (meta.config.title || 'NodeBB') + '] ' + title,
								intro: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + titleEscaped + ']]',
								postBody: postData.content.replace(/"\/\//g, '"https://'),
								site_title: meta.config.title || 'NodeBB',
								username: data.userData.username,
								userslug: data.userData.userslug,
								url: nconf.get('url') + '/post/' + postData.pid,
								base_url: nconf.get('url')
							}, next);
						} else {
							winston.debug('[topics.notifyFollowers] uid ' + toUid + ' does not have post notifications enabled, skipping.');
							next();
						}
					});
				});
				next();
			}
		], callback);
	};
};

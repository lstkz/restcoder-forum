"use strict";

var posts = require('../posts');
var helpers = require('./helpers');
var db = require('../database');

var postsController = {};

postsController.redirectToPost = function(req, res, callback) {
	var pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return callback();
	}

	posts.generatePostPath(pid, req.uid, function(err, path) {
		if (err || !path) {
			return callback(err);
		}

		helpers.redirect(res, path);
	});
};

postsController.getRawPost = function(req, res, callback) {
	var pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return callback();
	}

	posts.getPostFields(pid, ['content', 'deleted'], function (err, post) {
		if (err || !post) {
			return callback(err);
		}

		res.json({
			content: post.content
		})
	});
};

postsController.getUnreadCount = function(req, res, callback) {

	db.sortedSetCard('uid:' + req.uid + ':chat:rooms:unread', function (err, result) {
		if (err) {
			return callback(err);
		}

		res.json({
			result
		});
	});
};


module.exports = postsController;

var express = require('express');
var async = require("async");
var request = require("request");
var Promise = require("bluebird");
var cheerio = require("cheerio");
var redis = require('redis');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
var client = redis.createClient();
var keywords = require("./keywords");

function initPage(keyword){
  async.waterfall([function(next){
    var options = {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36'
        },
        uri: "http://www.lightinthebox.com/",
        method: 'GET'
      }
    request(options, function(err, httpRes, body){
      if (!err && httpRes.statusCode == 200) {
        next(null, httpRes.headers['set-cookie'])
      }else{
        next(err)
      }
    })
  }, function(cookie, next){
    //first page
    search(keyword, cookie, 1).then(function(body){
      console.log("first page", keyword)
      var $ = cheerio.load(body)
      if(!$(".no-result-tips").length){
        next(null, cookie)
      }else{
        next(new Error("no result"))
      }
    }).catch(function(err){
      next(err)
    })
  }, function(cookie, next){
    async.each([1, 2, 3, 4, 5, 6], function(i, pass){
      setTimeout(function(){
        search(keyword, cookie, i).then(function(body){
          console.log("get", keyword, "page", i)
          var $ = cheerio.load(body)
          $(".search-list .item-new").each(function(i, e){
            var img = $(e).find(".img-box img").attr("src")
                link = $(e).find(".p-box.ctr-track").attr("href")
                console.log(img, link)
            client.saddAsync("lightinthebox", link)
            client.saddAsync("lightinthebox-tmp", link)
            client.hmsetAsync([link, "img", img])
          })
          pass(null)
        }).catch(function(err){
          pass(err)
        })
      }, 2000)
    }, function(err){
      if(err){
        next(err)
      }else{
        next(null)
      }
    })
  }], function(err){
    if(err){
      console.log(err)
    }
  })
}


function search(keyword, cookie, page){
  return new Promise(function (resolve, reject) {
      var params = {
            main_page: "advanced_search_result",
            inc_subcat: 1,
            search_in_description: 0,
            keyword: keyword,
            page: page
          },
          options = {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36'
            },
            'Cookie': cookie,
            uri: "http://www.lightinthebox.com/index.php",
            method: 'GET',
            qs: params
        }
        request(options, function(err, httpRes, body){
          if (!err && httpRes.statusCode == 200) {
            resolve(body)
          }else{
            reject(err)
          }
        })
    });
}

function main(){
  async.each(keywords, function(keyword, next){
    initPage(keyword)
  })
}

main()


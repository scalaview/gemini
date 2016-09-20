var express = require('express');
var async = require("async");
var request = require("request");
var Promise = require("bluebird");
var cheerio = require("cheerio");
var redis = require('redis');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
var client = redis.createClient();


function main(){
  new Promise(function (resolve, reject) {
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
        resolve(httpRes.headers['set-cookie'])
      }else{
        reject(err)
      }
    })
  }).then(function(cookie){
    setTimeout(function(){
      crawl(cookie)
    }, 2000)
  }).catch(function(err){
    console.log(err)
  })
}

function crawl(){
  var cookie = arguments[0] || [ 'first_visit_time='+ ((new Date()).getTime()/1000).toFixed(0) +'; expires=Wed, 20-Sep-2017 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'cookie_test=please_accept_for_session; expires=Thu, 20-Oct-2016 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'sid=u4u8dtaub2bpq55atbtrv7nqa1; expires=Thu, 20-Oct-2016 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'AKAMAI_FEO_TEST=B; expires=Thu, 20-Oct-2016 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_s_c=36; expires=Tue, 20-Sep-2016 08:44:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_v_c=36; expires=Tue, 20-Sep-2016 16:14:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_w_c=36; expires=Tue, 27-Sep-2016 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_s=57e0f001e33ac; expires=Tue, 20-Sep-2016 08:44:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_v=57e0f001e3b7b; expires=Tue, 20-Sep-2016 16:14:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_w=57e0f001e434b; expires=Tue, 27-Sep-2016 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_device=desktop; expires=Wed, 21-Sep-2016 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    'vela_is_first_visit=1; expires=Wed, 20-Sep-2017 08:14:57 GMT; path=/; domain=.lightinthebox.com',
    '__cust=AAAAAFfg8AFhmC7MCoRTAg==; expires=Wed, 20-Sep-17 08:14:58 GMT; domain=lightinthebox.com; path=/',
    'SRV=A_201609141051; Expires=Thu, 20-Oct-2016 01:13:54 GMT; path=/; domain=.lightinthebox.com' ]

  async.waterfall([function(next){
    client.spopAsync("lightinthebox-tmp").then(function(url){
      next(null, url)
    }).catch(function(err){
      next(err)
    })
  }, function(url, next){
    console.log("get", url)
    productDetail(url, cookie).then(function(body){
      var $ = cheerio.load(body),
          title = $(".prod-info-title h1").text().trim(),
          imgs = $(".infinite-carousel .viewport img").map(function(i, e){ return $(e).attr("src").replace("50x50", "384x384") }).get(),
          price = $(".sale-price ").text().trim(),
          specifications = $(".prod-description-specifications").html(),
          gallery = $(".prod-description-gallery").html()

      imgs.unshift("imgs|"+url)
      client.send_command("lpush", imgs, function(err, result){
        if(err){
          console.log(err)
        }
      });
      client.hmsetAsync([url, "title", title, "price", price, "specifications", specifications, "gallery", gallery])
      next(null)
    }).catch(function(err){
      next(err)
    })
  }], function(err){
    console.log(err)
    setTimeout(function(){
      crawl(cookie)
    }, 2000)
  })
}


function productDetail(url, cookie){
  return new Promise(function (resolve, reject) {
      var options = {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36'
            },
            'Cookie': cookie,
            uri: url,
            method: 'GET'
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

main()
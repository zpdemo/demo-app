/**
 * AntBridge
 * @author Longhao Luo
 * @version 1.1.1
 * @todo shake.clearWatch, networkchange, motion.watch, motion.clearWatch 未实现
 **/
;
(function (root, factory) {
    if (typeof module !== "undefined" && module.exports) {
        // 兼容 CommonJS
        module.exports = factory();
    } else if (typeof define === "function" && (define.amd || define.cmd)) {
        // 兼容 AMD / RequireJS / seaJS
        define(factory);
    } else {
        // 如果不使用模块加载器则自动生成全局变量
        root.ant = root.ZaloPay = root.ZaloPay || {};
        factory.call(root, root.ZaloPay);
    }
}(this, function (ZaloPay) {
    "use strict";
    ZaloPay = ZaloPay || {};
    /**
     * @name ua
     * @description 同集团统一UA规范
     * @memberOf ZaloPay
     * @readonly
     * @type {string}
     */
    ZaloPay.ua = navigator.userAgent;
    //antBridge版本号
    ZaloPay.version = "1.1.0";

    /**
     * @name isZaloPay
     * @description 是否在支付宝钱包内运行
     * @memberOf ZaloPay
     * @readonly
     * @type {string}
     */
    ZaloPay.isZaloPay = (function() {
        return (ZaloPay.ua.indexOf("ZaloPayClient") > -1);
    })();

    // 不是支付宝的话打印出报错信息
    if (!ZaloPay.isZaloPay) {
        console.warn('Run ZaloPayBridge.js in ZaloPayClient please!');
    }

    /**
     * @name alipayVersion
     * @description 支付宝钱包版本号
     * @memberOf ZaloPay
     * @readonly
     * @type {string}
     */
    ZaloPay.alipayVersion = (function () {
        if (ZaloPay.isZaloPay) {
            var version=ZaloPay.ua.match(/ZaloPayClient\/(.*)/);
            return (version && version.length) ? version[1] : "";
        }
    })();

    /**
     * @name appinfo
     * @description 同集团统一的应用信息标识，用于判断应用及版本
     * @property {string} engine 应用所使用的 Hybrid 容器名
     * @property {string} engineVer 应用所使用的 Hybrid 容器版本号
     * @property {string} name 应用名
     * @property {string} ver 应用版本号
     * @memberOf ZaloPay
     * @readonly
     * @type {Object}
     */
    ZaloPay.appinfo = {
        engine: "alipay",
        engineVer: ZaloPay.alipayVersion,
        name: "alipay",
        ver: ZaloPay.alipayVersion
    };

    /**
     * 绑定全局事件
     * @param {string} event 事件名称，多个事件可用空格分隔开
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     */
    ZaloPay.on = function (event, fn) {
        event.split(/\s+/g).forEach(function (eventName) {
            document.addEventListener(eventName, fn, false);
        });
    };

    /**
     * 通用接口，调用方式等同ZaloPayJSBridge.call;
     * Common interface, calling the same way ZaloPayJSBridge.call;
     *
     * 无需考虑接口的执行上下文，必定调用成功
     * Do not need to consider the implementation of the interface context, the call must be successful
     *
     * @memberOf ZaloPay
     */
    ZaloPay.call = function () {
        var args = [].slice.call(arguments);
        if (window.ZaloPayJSBridge && window.ZaloPayJSBridge.call) {
            //强制转为 name + object + function 形式的入参
            // Forced to name + object + function in the form of the delegate
            var name = args[0], opt = args[1] || {}, cb = args[2];
            if (!isStr(name)) {
                console.error('apiName error：', name);
                return;
            }
            if (cb === undefined && isFn(opt)) {
                cb = opt;
                opt = {};
            }
            if (!isObj(opt)) {
                console.error(name + ': options is not object');
                return;
            }

            var _callback = cb;
            cb = function (result) {
                result = checkError(result, name);
                _callback && _callback(result);
            };
            // 排除掉remoteLog自身的调用
            // Exclude the call to remoteLog itself
            "remoteLog" !== name && antLog('ZaloPayJSBridge.call:', name, opt, _callback);
            window.ZaloPayJSBridge.call(name, opt, cb);
        } else {
            ZaloPay._apiQueue = ZaloPay._apiQueue || [];
            ZaloPay._apiQueue.push(args);
        }
    };

    ZaloPay._ready = function (fn) {
        if (window.ZaloPayJSBridge && window.ZaloPayJSBridge.call) {
            fn && fn();
        } else {
            ZaloPay.on("ZaloPayJSBridgeReady", fn);
        }
    };

    ZaloPay.ready = ZaloPay.ready || ZaloPay._ready;

    /**
     * 弱提示
     * @param {(string|object)} opt 调用参数，可为对象或字符串（为显示内容）
     * @param {string} opt.text 文字内容
     * @param {string} opt.type  icon类型，分为 none / success / fail；默认为 none；暂时不支持该参数
     * @param {number} opt.duration 显示时长，单位为毫秒，默认为 2000；暂时不支持该参数
     * @param {function} opt.onShow 暂时不支持该参数
     * @param {function} opt.onHide 暂时不支持该参数
     * @param {function} fn 回调函数
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @todo 目前不支持 onShow，onHide
     * @example // 调用参数为对象
     * ZaloPay.toast({
     *     text: "test toast",
     *     type: "success"
     * }, function() {
     *     alert("end toast");
     * });
     * @example // 调用参数为字符串
     * ZaloPay.toast("test toast", function() {
     *     alert("end toast");
     * });
     */
    ZaloPay.toast = function (opt, fn) {
        if (isStr(opt) || isNumber(opt)) {
            opt = {
                text: opt + ""
            };
        }
        opt = opt || {};
        opt.content = opt.text;
        opt.duration = opt.duration || 2000;

        //todo android hack，为了解决android不是在消失后才回调的问题。
        if (!!fn && isNumber(opt.duration) && isAndroid()) {
            opt.duration = opt.duration < 2500 ? 2000 : 3000;
            ZaloPay.call("toast", opt);
            setTimeout(fn, opt.duration);
        } else {
            ZaloPay.call("toast", opt, fn);
        }
    };

    /**
     * 设置标题
     * @param {string|object} opt 调用参数，可为对象或字符串
     * @param {string} opt.text 文案
     * @param {string} opt.type title|subtitle
     * @param {string} opt.subtitle 副标题（仅在支付宝使用）
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.setTitle({
     *     text: "title",
     *     type: "title"
     * }, function() {
     *     alert("end setTitle");
     * });
     */
    ZaloPay.setTitle = function (opt, fn) {
        var def = {
            type: "title"
        };

        if (isStr(opt)) {
            opt = {
                title: opt
            };
        }

        opt.title = opt.title || opt.text;

        simpleExtend(def, opt);

        if (def.title === null) {
            console.error("setTitle: title is required！");
            return false;
        }

        ZaloPay.call("setTitle", def, fn);
    };

    /**
     * 显示标题栏
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.showTitle(function() {
     *     alert("end showTitle");
     * });
     */
    ZaloPay.showTitle = function (fn) {
        ZaloPay.call("showTitlebar", fn);
    };

    
    /**
     * 隐藏标题栏
     * @param  {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.hideTitle(function() {
     *     alert("end hideTitle");
     * });
     */
    ZaloPay.hideTitle = function (fn) {
        ZaloPay.call("hideTitlebar", fn);
    };

    /**
     * 显示loading
     * @param {string|object} opt 调用参数，可为对象或字符串
     * @param {string} opt.text 文本内容；若不指定，则显示为中间大菊花；如果指定，显示为小菊花右侧带文字
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.showLoading({
     *     text: "loading"
     * }, function() {
     *     alert("end showLoading");
     * });
     */

    ZaloPay.showLoading = function (opt, fn) {
        if (isStr(opt) || isNumber(opt)) {
            opt = {
                text: opt + ""
            };
        }
        opt = opt || {};
        opt.delay = opt.delay || 1000;
        // 修复ios delay导致的hideLoading不一定能成功阻止被delay的showLoading的bug
        if (isNumber(opt.delay) && isIOS()) {
            var delay = opt.delay;
            delete opt.delay;
            var st = setTimeout(function () {
                ZaloPay.call('showLoading', opt, fn);
            }, delay);
            ZaloPay._stLoadingQueue = ZaloPay._stLoadingQueue || [];
            ZaloPay._stLoadingQueue.push(st);
            return st;
        }
        ZaloPay.call("showLoading", opt, fn);
    };

    /**
     * 隐藏loading
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.hideLoading(function() {
     *     alert("end hideLoading");
     * });
     */
    ZaloPay.hideLoading = function (fn) {
        if ('array' === type(ZaloPay._stLoadingQueue)) {
            if (ZaloPay._stLoadingQueue.length) {
                antLog('clearLoadingCount: ' + ZaloPay._stLoadingQueue.length);
                while (ZaloPay._stLoadingQueue.length) {
                    clearTimeout(ZaloPay._stLoadingQueue.shift());
                }
            }
        }
        ZaloPay.call("hideLoading", fn);
    };

    /**
     * 开新窗口
     * @param {string|object} opt 调用参数，可为对象或字符串
     * @param {string} opt.url 要打开的url
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.pushWindow({
     *     url: "http://www.alipay.com"
     * }, function() {
     *     alert("end pushWindow");
     * });
     */
    ZaloPay.pushWindow = function (opt, fn) {
        if (isStr(opt)) {
            opt = {
                url: opt
            };
        }
        opt = opt || {};
        if (!opt.url) {
            console.error('ZaloPay.pushWindow: url is required！');
            return false;
        }
        if (opt.param && isAndroid() && (compareVersion("8.3") < 0)) {
            console.warn("ZaloPay.pushWindow: can not use \"param\" in android's client 8.3-");
        }

        ZaloPay.call("pushWindow", opt, fn);
    };

    /**
     * 关闭窗口
     * @param {object} opt 调用参数
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     * @example
     * ZaloPay.popWindow(function() {
     *     alert("end popWindow");
     * });
     */
    ZaloPay.popWindow = function (opt, fn) {
        ZaloPay.call('popWindow', opt, fn);
    };

    /**
     * 退回指定界面
     * @param {number|object} opt 调用参数，可为对象或数字
     * @param {number} opt.step 往前或往后移动的步数
     * @param {function} fn 回调函数
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @todo 参数差别较大
     * @example
     * ZaloPay.popTo({
     *     step: -1
     * }, function() {
     *     alert("end popTo");
     * });
     */
    ZaloPay.popTo = function (opt, fn) {
        if (isNumber(opt)) {
            opt = {
                step: opt
            };
        } else if (isStr(opt)) {
            opt = {
                urlPattern: opt
            };
        }
        opt.step !== undefined && (opt.index = opt.step);
        ZaloPay.call("popTo", opt, fn);
    };

    /**
     * 唤起钱包登录功能；
     * 调用login可以延续钱包的登录session, 一般会有免登，不会弹出钱包登录界面
     * @param {function} fn 回调函数；回调函数执行时，一定是登录已经成功
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @example
     * ZaloPay.login(function() {
     *     alert("end login");
     * });
     */
    ZaloPay.login = function (fn) {
        ZaloPay.call("login", fn);
    };

    /**
     * 快捷支付native接口，在支付宝和接入支付宝快捷支付SDK的应用中有效
     * @param {string|object} opt 调用参数，可为对象或字符串
     * @param {string} opt.tradeNO 交易号。多个用";"分隔
     * @param {string} opt.partnerID 商户id
     * @param {string} opt.bizType 交易类型，默认为 trade
     * @param {string} opt.bizSubType 交易子类型
     * @param {bool} opt.displayPayResult 是否显示支付结果页，默认为 true
     * @param {string} opt.bizContext 支付额外的参数，格式为JSON字符串
     * @param {string} opt.orderStr 完整的一个支付字符串
     * @param {function} fn 回调函数
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @example
     * ZaloPay.tradePay({
     *     tradeNO: "201209071234123221"
     * }, function() {
     *     alert("end tradePay");
     * });
     */
    ZaloPay.tradePay = function (opt, fn) {
        ZaloPay.call("tradePay", opt, fn);
    };

    /**
     * h5支付接口，弹出H5页面让用户支付
     * <br>支付宝不支持此接口，支付宝请使用 ZaloPay.tradePay
     * @param {object} opt 调用参数
     * @param {string} opt.signStr 服务端生成的加签支付字符串
     * @param {string} opt.alipayURL wap支付的地址,当极简支付无法支持的时候或者用户设置了不用新版支付，都会采用wap支付
     * @param {string} [opt.backURL] 表示成功后的跳转
     * @param {string} opt.unSuccessUrl 表示不成功后的跳转(可能失败，也有可能用户取消等等)后的url，
     *     这个url我们会在调用前加入支付宝返回的结果，格式如下<br>
     *     {
     *         "result" : "",
     *         "memo" : "用户中途取消",
     *         "ResultStatus" : "6001"
     *     }
     * @param {function} fn 回调函数
     * @memberOf ZaloPay
     */
    ZaloPay.h5TradePay = function (opt, fn) {
        console.error("alpayClient don't support ZaloPay.h5TradePay，please use ZaloPay.tradePay");
        fn && fn({
            errorCode: 1,
            errorMessage: "接口不存在"
        });
    };

    ZaloPay.geolocation = {};

    /**
     * 获取位置信息
     * @alias geolocation.getCurrentPosition
     * @param {object} opt 调用参数，可选
     * @param {number} opt.timeout 超时返回时间，单位ms，默认为 15000ms
     * @param {function} fn 回调函数
     * @param {double} fn.coords.latitude 纬度
     * @param {double} fn.coords.longitude 经度
     * @param {string} fn.city 城市
     * @param {string} fn.province 省份
     * @param {string} fn.cityCode 城市编码
     * @param {array} fn.address 地址
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @example
     * ZaloPay.geolocation.getCurrentPosition(function(result) {
     *     alert(JSON.stringify(result));
     * });
     */
    ZaloPay.geolocation.getCurrentPosition = function (opt, fn) {
        if (fn === undefined && isFn(opt)) {
            fn = opt;
            opt = null;
        }
        opt = opt || {timeout: 15000};

        var timer = setTimeout(function () {
            timer = null;
            console.error("geolocation.getCurrentPosition: timeout");

            var result = {
                errorCode: 5,
                errorMessage: "调用超时"
            };

            fn && fn(result);
        }, opt.timeout);

        ZaloPay.call("getLocation", function (result) {
            if (timer) {
                clearTimeout(timer);

                result.coords = {};
                result.coords.latitude = +result.latitude;
                result.coords.longitude = +result.longitude;

                result.city = result.city ? result.city : result.province;
                result.cityCode = result.citycode;

                result.address = result.pois;

                fn && fn(result);
            }
        });
    };

    ZaloPay.shake = {};

    /**
     * 摇一摇
     * @alias shake.watch
     * @param {object} opt 调用参数，可为对象或字符串
     * @param {function} opt.onShake
     * @param {function} fn 回调函数
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @todo 暂时不支持 opt 参数
     * @example
     * ZaloPay.shake.watch({
     *     onShake: function() {
     *         alert("onShake");
     *     }
     * }, function() {
     *     alert("end shake");
     * });
     */

    ZaloPay.shake.watch = function (opt, fn) {
        ZaloPay.call("watchShake", opt, fn);
    };

    ZaloPay.vibration = {};

    /**
     * 调用震动
     * @alias vibration.vibrate
     * @param {number|object} opt 调用参数，可为对象或数字
     * @param {number} opt.duration 震动时间
     * @param {function} fn 回调函数
     * @todo 暂时不支持 opt
     * @memberOf ZaloPay
     * @example
     * ZaloPay.vibration.vibrate({
     *     duration: 3000
     * }, function() {
     *     alert("end vibrate");
     * });
     */

    ZaloPay.vibration.vibrate = function (opt, fn) {
        if (isNumber(opt)) {
            opt = {
                duration: opt
            };
        }
        ZaloPay.call("vibrate", opt, fn);
    };

    ZaloPay.network = {};

    /**
     * 获取网络状态
     * @alias network.getType
     * @param {object} opt 调用参数，可选
     * @param {number} opt.timeout 超时返回时间，单位ms，默认为 15000ms
     * @param {function} fn 回调函数
     * @param {object} fn.result 包含各种网络状况的对象
     * @param {boolean} fn.result.is3G 是否在使用3G网络
     * @param {boolean} fn.result.is2G 是否在使用2G网络
     * @param {boolean} fn.result.isWifi 是否在使用 Wifi
     * @param {boolean} fn.result.isE 是否处于 E
     * @param {boolean} fn.result.isG 是否处于 G
     * @param {boolean} fn.result.isH 是否处于 H
     * @param {boolean} fn.result.isOnline 是否联网
     * @param {string} fn.result.type 网络类型
     * @param {boolean} fn.networkAvailable 网络是否连网可用
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @todo 目前仅支持判断是否 wifi 连接以及是否联网
     * @example
     * ZaloPay.network.getType(function(result, networkAvailable) {
     *     alert(JSON.stringify(result));
     * });
     */
    ZaloPay.network.getType = function (opt, fn) {
        if (fn === undefined && isFn(opt)) {
            fn = opt;
            opt = null;
        }
        opt = opt || {timeout: 15000};

        var timer = setTimeout(function () {
            timer = null;
            console.error("network.getType: timeout");

            var result = {
                errorCode: 5,
                errorMessage: "调用超时"
            };

            fn && fn(result);
        }, opt.timeout);

        ZaloPay.call("getNetworkType", function (result) {
            if (timer) {
                clearTimeout(timer);

                result.networkAvailable = result.networkType !== "fail";

                result.is3G = result.is2G = result.isE = result.isG = result.isH = false;

                result.isWifi = result.networkType === "wifi";
                result.isOnline = result.networkAvailable;

                result.type = result.networkType;

                fn && fn(result, result.networkAvailable);
            }
        });
    };

    ZaloPay.calendar = {};

    /**
     * 添加日历事件
     * 备注：frequency 和 recurrenceTimes 若有值，则都必须有值
     * @alias calendar.add
     * @param {object} opt 调用参数
     * @param {string} opt.title 日历标题，必选
     * @param {string} opt.location 事件发生地点，可选
     * @param {string} opt.startDate 开始时间，必选
     * @param {string} opt.endDate 结束时间，必选
     * @param {int} opt.alarmOffset 事件开始前多少分钟提醒，可选，默认值为 15
     * @param {int} opt.recurrenceTimes 循环发生次数，可选，默认值为 0（不循环）
     * @param {string} opt.frequency 循环频率(year/month/week/day)，可选，默认不循环
     * @param {string} opt.notes 事件内容，可选
     * @param {function} fn 回调函数
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @example
     * ZaloPay.calendar.add({
     *      title: "日历测试",
     *      startDate: "2014-07-09 14:20:00",
     *      endDate: "2014-07-09 14:40:00",
     *      location: "黄龙时代广场",
     *      notes: "日历事件内容日历事件内容日历事件内容",
     *      alarmOffset: 10,
     *      recurrenceTimes: 2,
     *      frequency: "day"
     * }, function(result) {
     *     alert(JSON.stringify(result));
     * });
     */
    ZaloPay.calendar.add = function (opt, fn) {
        if (compareVersion("8.3") < 0) {
            console.error("ZaloPay.calendar.add: 在 8.3 及以上版本使用");
            fn && fn({
                errorCode: 1,
                errorMessage: "接口不存在"
            });
        } else {
            ZaloPay.call("addEventCal", opt, fn);
        }
    };

    /**
     * 拍照/选择照片
     * @param {object} opt 调用参数，为对象
     * @param {string} opt.dataType 结果数据格式：dataurl|fileurl|remoteurl
     * @param {string} opt.cameraType 指定是前置摄像头还是后置摄像头，front(前置)，back(后置)
     * @param {boolean} opt.allowedEdit 是否允许编辑(框选). 为true时，拍照时会有一个方形的选框
     * @param {string} opt.src 图片来源：gallary|camera
     * @param {string} opt.maskImg 遮罩图片地址
     * @param {string} opt.maskWidth 遮罩宽度
     * @param {string} opt.maskHeight 遮罩高度
     * @param {number} opt.maxWidth 图片的最大宽度. 过大将被等比缩小
     * @param {number} opt.maxHeight 图片的最大高度. 过大将被等比缩小
     * @param {string} opt.format jpg|png
     * @param {number} opt.quality 图片质量, 取值1到100
     * @param {function} fn 回调函数
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @param {string} fn.photo 照片信息，为 dataUrl 或者 fileUrl
     * @memberOf ZaloPay
     * @todo 暂不支持 src, cameraType, maskImg, maskWidth, maskHeight
     * @todo dataType 不支持 remoteurl
     * @example
     * ZaloPay.photo({
     *     dataType: "dataurl",
     *     allowedEdit: true,
     *     src: "camera",
     *     format: "jpg",
     *     quality: 100
     * }, function() {
     *     alert("end photo");
     * });
     */
    ZaloPay.photo = function (opt, fn) {
        if (fn === undefined && isFn(opt)) {
            fn = opt;
            opt = {};
        }

        var def = {
            format: "jpg",
            dataType: "dataurl",
            quality: 50,
            allowEdit: false,
            src: undefined,
            cameraType: undefined,
            maskImg: undefined,
            maskWidth: undefined,
            maskHeight: undefined
        };

        simpleExtend(def, opt);

        def.imageFormat = def.format;

        if (def.dataType == "remoteurl") {
            def.dataType = "dataurl";
        }

        def.dataType = def.dataType.slice(0, -3) + def.dataType.slice(-3).toUpperCase();

        ZaloPay.call("photo", def, function (result) {
            if (result.dataURL) {
                result.dataURL = "data:image/" + def.imageFormat + ";base64," + result.dataURL;
            }

            result.photo = result.dataURL || result.fileURL;
            result.errorMessage = result.error == 10 ? "用户取消" : result.errorMessage;

            fn && fn(result);
        });
    };

    ZaloPay.contacts = {};

    /**
     * 调用本地通讯录
     * @alias contacts.get
     * @param {object} opt 调用参数，为对象，可选
     * @param {boolean} opt.multiple 是否多选，默认为 false
     * @param {function} fn 回调函数
     * @param {array} fn.results 联系人数组
     * @param {string} fn.results[i].name 联系人姓名
     * @param {string} fn.results[i].phoneNumber 联系人号码
     * @param {string} fn.results[i].email 联系人 email
     * @param {number} fn.errorCode 错误码
     * @param {string} fn.errorMessage 错误信息
     * @memberOf ZaloPay
     * @todo 暂时不支持 email
     * @todo 暂时不支持 multiple
     * @example
     * ZaloPay.contacts.get(function(result) {
     *     alert(JSON.stringify(result));
     * });
     */
    ZaloPay.contacts.get = function (opt, fn) {
        if (fn === undefined && isFn(opt)) {
            fn = opt;
            opt = null;
        }
        opt = opt || {};
        opt.multiple && console.error("仅支持单选");

        ZaloPay.call("contact", opt, function (result) {
            result.results = [];

            result.results[0] = {
                phoneNumber: result.mobile,
                email: undefined,
                name: result.name
            };

            switch (result.errorCode) {
                case 10:
                    result.errorMessage = "没有权限";
                    break;

                case 11:
                    result.errorMessage = "用户取消操作";
                    break;
            }

            fn && fn(result);
        });
    };

    /**
     * 调用native的分享接口，H5情况下请自行调用mui的分享组件
     *
     * @name share
     * @memberOf ZaloPay
     * @function
     *
     * @param {Object} opt 分享参数，可以使用原生的 { channels: [] } 格式
     * @param {string} opt.title 分享标题
     * @param {string} opt.text 分享内容
     * @param {string} opt.image 需要分享的图片地址
     * @param {string} opt.url 需要分享的URL
     * @param {boolean} [opt.captureScreen=false] 分享当前屏幕截图，无image时有效(只有支付宝支持)
     * @param {number} [opt.shareType=-1] 分享渠道，多渠道可以复合使用(a|b|c，支付宝)，推荐使用-1，淘客不支持
     * <br><br>
     * <ul>
     *    <li>-1: 用户选择</li>
     *    <li>1: 微信好友</li>
     *    <li>2: 微博</li>
     *    <li>4: 短信(支付宝)</li>
     *    <li>8: 来往好友</li>
     *    <li>16: 来往动态</li>
     *    <li>32: 微信朋友圈</li>
     *    <li>64: 复制链接(支付宝)</li>
     * </ul>
     * @param {Function} callback 分享调用的回调
     *
     * @example
     * ZaloPay.share({
     *     shareType: -1,
     *     title: '憨豆',
     *     text: '～憨豆～哈哈哈哈～',
     *     image: 'http://mingxing.wubaiyi.com/uploads/allimg/c110818/1313A1952W0-15029.jpg',
     *     url: 'http://mingxing.wubaiyi.com/uploads/allimg/c110818/1313A1952W0-15029.jpg'
     * }, function (result) {
     *     if (result.errorCode) {
     *         // 调用分享出错，这个时候可以调用mui的分享或者提示出错
     *     }
     * });
     */
    ZaloPay.share = function (opt, fn) {
        var shareTypes = {
            1: 'Weixin',
            2: 'Weibo',
            4: 'SMS',
            8: 'LaiwangContacts',
            16: 'LaiwangTimeline',
            32: 'WeixinTimeLine',
            64: 'CopyLink'
        };
        opt = opt || {};
        var data = opt;
        // 如果有 channels 参数就认为是原始的参数格式，否则认为是统一的参数格式
        if (!opt.channels || opt.channels.length === 0) {
            opt.title = opt.title || '';
            opt.content = opt.text;
            opt.imageUrl = opt.image;
            opt.captureScreen = !!opt.captureScreen;
            opt.url = opt.url || '';

            data = { channels: [] };
            if (typeof opt.shareType === 'undefined') {
                opt.shareType = -1;
            }
            for (var i in shareTypes) {
                if (Number(i) & opt.shareType) {
                    data.channels.push({
                        name: shareTypes[i],
                        param: opt
                    });
                }
            }
        } else if (isAndroid()) {
            // hack android QZoneChannel to QQZoneChannel
            opt.channels.forEach(function (channel) {
                if (channel.name.toLowerCase() === "qzone") {
                    channel.name = "QQZone";
                }
            });
        }
        ZaloPay.call('share', data, fn);
    };

    // ------------------
    // 以下接口暂时不支持

    /*ZaloPay.motion = {};
     ZaloPay.audio = {};
     ZaloPay.orientation = {};

     ZaloPay.network.watch = ZaloPay.network.clearWatch = ZaloPay.motion.watch = ZaloPay.motion.clearWatch =
     ZaloPay.audio.play = ZaloPay.audio.stop = ZaloPay.orientation.watch = ZaloPay.orientation.clearWatch =
     ZaloPay.geolocation.clearWatch = ZaloPay.network.watch = ZaloPay.network.clearWatch = function() {
     if (arguments.length > 0 && typeof arguments[arguments.length - 1] === "function") {
     var result = {
     errorCode: 3,
     errorMessage: "未知错误"
     };

     arguments[arguments.length - 1](result);
     }
     };*/

    // ------------------
    // 仅供支付宝钱包使用

    /**
     * @name debugEnabled
     * @DESCRIPTION 开启aliBridge的debug模式,调用jsapi时会在控制台打印日志
     */
    ZaloPay.debugEnabled = function (opt) {
        ZaloPay.debug = (opt === true) ? 2 : 1;
    };

    ZaloPay.getLaunchParams = function (fn) {
        ZaloPay._ready(function () {
            ZaloPay.launchParams = ZaloPayJSBridge.startupParams;
            fn && fn(ZaloPay.launchParams);
        });
    };

    ZaloPay.setOptionMenu = function (opt, fn) {
        if (isStr(opt)) {
            if ((/^http/i).test(opt)) {
                opt = {icon: opt};
            } else {
                opt = {title: opt};
            }
        }
        ZaloPay.call('setOptionMenu', opt, fn);
    };

    ZaloPay.alert = function (opt, fn) {
        if (isStr(opt) || isNumber(opt)) {
            opt = {message: opt + ""};
        }
        ZaloPay.call('alert', opt, fn);

    };
    ZaloPay.confirm = function (opt, fn) {
        if (isStr(opt) || isNumber(opt)) {
            opt = {message: opt + ""};
        }
        ZaloPay.call('confirm', opt, fn);
    };
    ZaloPay.openInBrowser = function (opt, fn) {
        if (isStr(opt)) {
            opt = {url: opt};
        }
        ZaloPay.call('openInBrowser', opt, fn);
    };

    ZaloPay.diagnose = function (opt) {
        if (!isIOS()) {
            console.warn('diagnose only in iOS');
            return false;
        }

        if (isObj(opt) || "array" === type(opt)) {
            opt = JSON.stringify(opt);
        } else if (!(isStr(opt) || isNumber(opt))) {
            console.error('diagnose must be string or json');
            return false;
        }
        opt = location.href + ": " + opt;
        opt = {
            type: 'diagnose',
            seedId: 'H5_DIAGNOSED_JSLOG',
            param1: opt
        };
        var args = ['remoteLog', opt];

        // 防止debug模式下的死循环
        if (window.ZaloPayJSBridge  && window.ZaloPayJSBridge.call) {
            window.ZaloPayJSBridge.call('remoteLog', opt);
        }
        else {
            ZaloPay._apiQueue = ZaloPay._apiQueue || [];
            ZaloPay._apiQueue.push(args);
        }
    };

    ZaloPay.requestAnimationFrame = function (cb) {
        var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
        if (raf) {
            return raf(cb);
        }
        else {
            console.error("Not support requestAnimationFrame!");
        }
    };

    ZaloPay.mtop = function(opt, fn) {
        // mtop接口在iOS9.3以下存在bug，当需要needWua时，需要同时传入needWua和isNeedWua为true，需要antBridge.js封装时自动增加一个isNeedWua的值
        if (typeof opt.needWua != 'undefined' && typeof opt.isNeedWua == 'undefined') {
            opt.isNeedWua = opt.needWua;
        }
        ZaloPay.call('mtop', opt, fn);
    };

    ZaloPay.actionSheet = function(opt, fn) {
        // Android上整个标题栏都不显示，界面不好看
        if (isAndroid()) {
            if (typeof opt.title == 'undefined' || opt.title === '') {
                opt.title = ' ';
            }
        }
        ZaloPay.call('actionSheet', opt, fn);
    };

    ZaloPay._ready(function () {
        antLog("ZaloPayJSBridgeReady");
        var apiQueue = ZaloPay._apiQueue || [];

        function next() {
            ZaloPay.requestAnimationFrame(function () {
                var args = apiQueue.shift();
                ZaloPay.call.apply(null, args);
                if (apiQueue.length) next();
            });
        }

        !!apiQueue.length && next();
    });

    ([
        "startApp",
        "showOptionMenu",
        "hideOptionMenu",
        "showToolbar",
        "hideToolbar",
        "closeWebview",
        "sendSMS",
        "scan",
        "getSessionData",
        "setSessionData",
        "checkJSAPI",
        "checkApp",
        "isInstalledApp",
        "deposit",
        "chooseContact",
        "alipayContact",
        "getConfig",
        "getCities",
        "rsa",
        "getWifiList",
        "connectWifi",
        "notifyWifiShared",
        "thirdPartyAuth",
        "getThirdPartyAuthcode",
        "setToolbarMenu",
        "exitApp",
        "hideBackButton",
        "startApp",
        "startPackage",
        "getSharedData",
        "setSharedData",
        "removeSharedData",
        "setClipboard",
        "startDownload",
        "stopDownload",
        "getDownloadInfo",
        "detectBeacons",
        "startBeaconsBeep",
        "stopBeaconsBeep",
        "startIndoorLocation",
        "stopIndoorLocation",
        "addEventCal",
        "startSpeech",
        "stopSpeech",
        "cancelSpeech",
        "getWifiInfo",
        "clearAllCookie",
        "getMtopToken",
        "getClientInfo",
        "sinasso",
        "getClipboard",
        "checkBLEAvalability",
        "scanBeacons",
        "isSpeechAvailable",
        "speechRecognizer",
        "contactSync",
        "setGestureBack",
        "remoteLog",
        "httpRequest",
        "rpc",
        "ping",
        "snapshot",
        "imageViewer",
        "upload",
        "networkAnalysis",
        "showTitleLoading",
        "hideTitleLoading",
        "getLocation"
    ]).forEach(function (methodName) {
            ZaloPay[methodName] = function () {
                var args = [].slice.call(arguments);

                ZaloPay.call.apply(null, ([methodName]).concat(args));
            };
        });

// ----------------

    function isAndroid() {
        return (/android/i).test(ZaloPay.ua);
    }

    function isIOS() {
        return (/iphone|ipad/i).test(ZaloPay.ua);
    }

    function isFn(fn) {
        return 'function' === type(fn);
    }

    function isStr(str) {
        return 'string' === type(str);
    }

    function isObj(o) {
        return 'object' === type(o);
    }

    function isNumber(num) {
        return "number" === type(num);
    }

    function type(obj) {
        return Object.prototype.toString.call(obj).replace(/\[object (\w+)\]/, '$1').toLowerCase();
    }

    function simpleExtend(target, source) {
        if (source) {
            for (var k in source) {
                target[k] = source[k];
            }
        }
        return target;
    }

    function antLog() {
        if (ZaloPay.debug > 0) {
            var time = (+new Date());
            var arg = [].slice.call(arguments);
            console.log(time, arg);
            if (ZaloPay.debug > 1) {
                ZaloPay.diagnose(time + "^" + JSON.stringify(arg));
            }
        }
    }

    function checkError(result, name) {
        result = result || {};
        result.errorCode = result.error || 0;
        //有些errorCode不代表异常，而是用户取消操作，不应该统一做报错日志。
        if (result.errorCode > 0 && result.errorCode < 10) {
            console.error(name + " error: " + "errorCode: " + result.errorCode + ", errorMessage: " + result.errorMessage);
        } else {
            antLog(name + ", callback:", result);
        }
        return result;
    }

//return 1代表目标比当前版本小，-1相反，相同为0
    function compareVersion(targetVersion) {
        var alipayVersion = ZaloPay.alipayVersion.split(".");
        targetVersion = targetVersion.split(".");

        for (var i = 0, n1, n2; i < alipayVersion.length; i++) {
            n1 = parseInt(targetVersion[i], 10) || 0;
            n2 = parseInt(alipayVersion[i], 10) || 0;

            if (n1 > n2) return -1;
            if (n1 < n2) return 1;
        }

        return 0;
    }

    return ZaloPay;
}));

//
//  Created by Mingliang Chen on 17/8/1.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//

const Logger = require('./node_core_logger');
const Https = require('https');
const NodeRtmpServer = require('./node_rtmp_server');
const NodeHttpServer = require('./node_http_server');
const NodeTransServer = require('./node_trans_server');
const NodeRelayServer = require('./node_relay_server');
const NodeIpcServer = require('./node_ipc_server');
const context = require('./node_core_ctx');
const Package = require("./package.json");

class NodeMediaServer {
  /**
   * 构造函数
   * @param {* 配置项} config 
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * 实例运行入口方法
   */
  run() {
    //配置日志级别
    Logger.setLogType(this.config.logType);
    Logger.log(`Node Media Server v${Package.version}`);
    //配置项rtmp
    if (this.config.rtmp) {
      this.nrs = new NodeRtmpServer(this.config);
      this.nrs.run();
    }

    //配置项http
    if (this.config.http) {
      this.nhs = new NodeHttpServer(this.config);
      this.nhs.run();
    }

    if (this.config.trans) {
      if (this.config.cluster) {
        Logger.log('NodeTransServer does not work in cluster mode');
      } else {
        this.nts = new NodeTransServer(this.config);
        this.nts.run();
      }
    }

    if (this.config.relay) {
      if (this.config.cluster) {
        Logger.log('NodeRelayServer does not work in cluster mode');
      } else {
        this.nls = new NodeRelayServer(this.config);
        this.nls.run();
      }
    }

    if (this.config.cluster) {
      this.nis = new NodeIpcServer(this.config);
      this.nis.run();
    }

    process.on('uncaughtException', function (err) {
      Logger.error('uncaughtException', err);
    });

    //客户端请求npmjs服务端，查询是否有更新版本
    Https.get("https://registry.npmjs.org/node-media-server", function (res) {
      let size = 0;
      let chunks = [];
      res.on('data', function (chunk) {
        size += chunk.length;
        chunks.push(chunk);
      });
      res.on('end', function () {
        let data = Buffer.concat(chunks, size);
        let jsonData = JSON.parse(data.toString());
        let latestVersion = jsonData['dist-tags']['latest'];
        let latestVersionNum = latestVersion.split('.')[0] << 16 | latestVersion.split('.')[1] << 8 | latestVersion.split('.')[2] & 0xff;
        let thisVersionNum = Package.version.split('.')[0] << 16 | Package.version.split('.')[1] << 8 | Package.version.split('.')[2] & 0xff
        if (thisVersionNum < latestVersionNum) {
          Logger.log(`There is a new version ${latestVersion} that can be updated`);
        }
      });
    }).on('error', function (e) {
    });
  }

  //事件挂接函数
  on(eventName, listener) {
    context.nodeEvent.on(eventName, listener);
  }

  //服务停止接口函数
  stop() {
    if (this.nrs) {
      this.nrs.stop();
    }
    if (this.nhs) {
      this.nhs.stop();
    }
    if (this.nls) {
      this.nls.stop();
    }
    if (this.nis) {
      this.nis.stop();
    }
  }

  getSession(id) {
    return context.sessions.get(id);
  }
}

module.exports = NodeMediaServer
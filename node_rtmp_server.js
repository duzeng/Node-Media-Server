//
//  Created by Mingliang Chen on 17/8/1.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const Net = require('net');
const NodeRtmpSession = require('./node_rtmp_session');
const NodeCoreUtils = require('./node_core_utils');

const context = require('./node_core_ctx');

const RTMP_PORT = 1935;

class NodeRtmpServer {
  constructor(config) {
    //短路操作 config.rtmp.port || RTMP_PORT
    config.rtmp.port = this.port = config.rtmp.port ? config.rtmp.port : RTMP_PORT;
    // TCP server
    this.tcpServer = Net.createServer((socket) => {
      //单个连接上后新建session
      let session = new NodeRtmpSession(config, socket);
      session.run();
    })
  }

  run() {
    this.tcpServer.listen(this.port, () => {
      Logger.log(`Node Media Rtmp Server started on port: ${this.port}`);
    });
    //建议将事件监听挪至listen之前
    this.tcpServer.on('error', (e) => {
      Logger.error(`Node Media Rtmp Server ${e}`);
    });

    this.tcpServer.on('close', () => {
      Logger.log('Node Media Rtmp Server Close.');
    });
  }

  stop() {
    this.tcpServer.close();
    context.sessions.forEach((session, id) => {
      if (session instanceof NodeRtmpSession) {
        session.socket.destroy();
        context.sessions.delete(id);
      }
    });
  }
}

module.exports = NodeRtmpServer

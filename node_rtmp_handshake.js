//
//  Created by Mingliang Chen on 17/8/1.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const Crypto = require('crypto');

/**
 * 简单握手
 */
const MESSAGE_FORMAT_0 = 0;
/**
 * 复杂握手的schema1 即 digest块在key块之前
 */
const MESSAGE_FORMAT_1 = 1;
/**
 * 复杂握手的schema0 即 key块在digest块之前
 */
const MESSAGE_FORMAT_2 = 2;

const RTMP_SIG_SIZE = 1536;
const SHA256DL = 32;

const RandomCrud = Buffer.from([
  0xf0, 0xee, 0xc2, 0x4a, 0x80, 0x68, 0xbe, 0xe8,
  0x2e, 0x00, 0xd0, 0xd1, 0x02, 0x9e, 0x7e, 0x57,
  0x6e, 0xec, 0x5d, 0x2d, 0x29, 0x80, 0x6f, 0xab,
  0x93, 0xb8, 0xe6, 0x36, 0xcf, 0xeb, 0x31, 0xae
])

const GenuineFMSConst = 'Genuine Adobe Flash Media Server 001';
const GenuineFMSConstCrud = Buffer.concat([Buffer.from(GenuineFMSConst, 'utf8'), RandomCrud]);

const GenuineFPConst = 'Genuine Adobe Flash Player 001';
const GenuineFPConstCrud = Buffer.concat([Buffer.from(GenuineFPConst, 'utf8'), RandomCrud]);

function calcHmac(data, key) {
  let hmac = Crypto.createHmac('sha256', key);
  hmac.update(data);
  return hmac.digest();
}

function GetClientGenuineConstDigestOffset(buf) {
  let offset = buf[0] + buf[1] + buf[2] + buf[3];
  offset = (offset % 728) + 12;
  return offset;
}

function GetServerGenuineConstDigestOffset(buf) {
  let offset = buf[0] + buf[1] + buf[2] + buf[3];
  offset = (offset % 728) + 776;
  return offset;
}

function detectClientMessageFormat(clientsig) {
  let computedSignature, msg, providedSignature, sdl;
  // schema0 digest 的offset?
  sdl = GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
  //C1 除了digest data (32 字节)外剩余拼接起来的
  msg = Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
  //C1 joined 加 FPKey (Genuine Adobe Flash Player 001) 计算
  computedSignature = calcHmac(msg, GenuineFPConst);
  providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
  if (computedSignature.equals(providedSignature)) {
    return MESSAGE_FORMAT_2;
  }
  // scheme1 digest offset
  sdl = GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
  //C1除了digest data掐头去尾的剩余字节
  msg = Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
  computedSignature = calcHmac(msg, GenuineFPConst);
  providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
  if (computedSignature.equals(providedSignature)) {
    return MESSAGE_FORMAT_1;
  }
  return MESSAGE_FORMAT_0;
}

function generateS1(messageFormat) {
  //生成加密强伪随机数据
  //生成除 time + version 的8字节 以外的随机字节缓冲
  let randomBytes = Crypto.randomBytes(RTMP_SIG_SIZE - 8);
  //拼接time+version
  let handshakeBytes = Buffer.concat([Buffer.from([0, 0, 0, 0, 1, 2, 3, 4]), randomBytes], RTMP_SIG_SIZE);

  let serverDigestOffset
  if (messageFormat === 1) {
    serverDigestOffset = GetClientGenuineConstDigestOffset(handshakeBytes.slice(8, 12));
  } else {
    serverDigestOffset = GetServerGenuineConstDigestOffset(handshakeBytes.slice(772, 776));
  }

  //S1 joined （即除去digest data掐头去尾的字节）
  msg = Buffer.concat([handshakeBytes.slice(0, serverDigestOffset), handshakeBytes.slice(serverDigestOffset + SHA256DL)], RTMP_SIG_SIZE - SHA256DL);
  // S1 joined 加 FMSKey (Genuine Adobe Flash Media Server 001) 计算 哈希
  hash = calcHmac(msg, GenuineFMSConst);
  //将计算出的hash即digest data 填充进相应位置()
  hash.copy(handshakeBytes, serverDigestOffset, 0, 32);
  return handshakeBytes;
}

function generateS2(messageFormat, clientsig, callback) {
  let randomBytes = Crypto.randomBytes(RTMP_SIG_SIZE - 32);
  let challengeKeyOffset;
  if (messageFormat === 1) {
    challengeKeyOffset = GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
  } else {
    challengeKeyOffset = GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
  }
  //计算C1的digest data 32字节
  let challengeKey = clientsig.slice(challengeKeyOffset, challengeKeyOffset + 32);
  //C1 digest data + FMSKey (68字节) 计算临时key
  let hash = calcHmac(challengeKey, GenuineFMSConstCrud);
  //S2的random dta+ 临时key 计算 S2的digestdata
  let signature = calcHmac(randomBytes, hash);
  let s2Bytes = Buffer.concat([randomBytes, signature], RTMP_SIG_SIZE);
  return s2Bytes
}

/**
 * 生成握手协议中的S0 S1 S2
 * @param {*} clientsig 
 */
function generateS0S1S2(clientsig) {
  //C0 固定为03 版本号
  let clientType = Buffer.alloc(1, 3);
  let messageFormat = detectClientMessageFormat(clientsig);
  let allBytes;
  //
  if (messageFormat === MESSAGE_FORMAT_0) {
    //    Logger.debug('[rtmp handshake] using simple handshake.');
    allBytes = Buffer.concat([clientType, clientsig, clientsig]);
  } else {
    //    Logger.debug('[rtmp handshake] using complex handshake.');
    //生成S2即是对C1的验证（1504 随机字节+ 32字节 signature)
    allBytes = Buffer.concat([clientType, generateS1(messageFormat), generateS2(messageFormat, clientsig)]);
  }
  return allBytes;
}

module.exports = { generateS0S1S2 };

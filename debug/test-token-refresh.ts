/**
 * Token 自动刷新能力测试
 *
 * 分三层验证：
 *   1. 基础重认证   - 直接调用 getAccount()，验证用 password 能取回新 token
 *   2. 端到端刷新   - 伪造无效 serviceToken，观察 HTTP 拦截器是否自动刷新
 *   3. 磁盘持久化   - 刷新后验证 .mi.json 是否同步写入
 */

import './load-env.js';
import { MiService } from '../src/service.js';
import { readJSON } from '../src/utils/io.js';
import { initMiService, loadAndValidateConfig, logger } from './local.js';

const FAKE_TOKEN = 'INVALID_TOKEN_FOR_REFRESH_TEST_12345';

async function testReauth(config: any) {
  logger.section('① 基础重认证：直接调用 getAccount()');

  const { getAccount } = await import('../src/mi/account.js');
  const mina = MiService.MiNA!;

  const freshAccount = await getAccount({
    userId: config.userId!,
    password: config.password!,
    passToken: config.passToken,
    sid: 'micoapi' as const,
    deviceId: mina.account.deviceId,
    did: mina.account.did,
  } as any);

  if (freshAccount?.serviceToken) {
    logger.success(`重认证成功，取回新 serviceToken：${freshAccount.serviceToken.slice(0, 20)}...`);
    return true;
  } else {
    logger.error('重认证失败 — 检查 userId / password 是否正确');
    return false;
  }
}

async function testEndToEndRefresh() {
  logger.section('② 端到端刷新：伪造无效 token → HTTP 拦截器自动刷新');

  const mina = MiService.MiNA!;
  const originalToken = mina.account.serviceToken;

  // 伪造无效 token
  mina.account.serviceToken = FAKE_TOKEN;
  logger.warning(`已将 serviceToken 替换为无效值：${FAKE_TOKEN}`);

  // 发起真实请求，预期触发 401 → 拦截器刷新 → 重试
  logger.info('发起 getConversations 请求...');
  const result = await mina.getConversations({ limit: 1 });

  const tokenAfter = mina.account.serviceToken;
  const refreshed = tokenAfter !== FAKE_TOKEN && !!tokenAfter;

  if (refreshed) {
    logger.success(`Token 已自动刷新：${tokenAfter!.slice(0, 20)}...`);
    if (result) {
      logger.success('重试请求也成功，获取到对话记录');
    } else {
      logger.warning('Token 刷新了，但 getConversations 返回空（可能无记录或接口格式问题）');
    }
    return { refreshed: true, newToken: tokenAfter };
  } else {
    // 服务器可能未返回 401，而是返回 200+错误码
    logger.warning('HTTP 拦截器未触发 — 小米服务器可能未返回 HTTP 401');
    logger.info('还原 token，不影响后续测试');
    mina.account.serviceToken = originalToken;
    return { refreshed: false, newToken: originalToken };
  }
}

async function testDiskPersistence(expectedToken: string | undefined) {
  logger.section('③ 磁盘持久化：验证 .mi.json 是否同步写入');

  const store = await readJSON<any>('.mi.json');
  const cachedToken = store?.mina?.serviceToken;

  if (!cachedToken) {
    logger.warning('.mi.json 中无 mina.serviceToken，可能文件不存在');
    return;
  }

  if (cachedToken === expectedToken) {
    logger.success(`.mi.json 已同步，重启后可直接复用 token`);
  } else {
    logger.warning(`.mi.json 与内存 token 不一致，重启后将重新登录（非严重问题）`);
    logger.info('内存 token', expectedToken?.slice(0, 20) + '...');
    logger.info('缓存 token', cachedToken?.slice(0, 20) + '...');
  }
}

async function main() {
  logger.title('Token 自动刷新能力测试');

  const cfgResult = loadAndValidateConfig();
  if (!cfgResult) return;
  const { config, deviceName } = cfgResult;

  if (!(await initMiService(config, deviceName))) return;

  // ① 基础重认证
  const reauthed = await testReauth(config);
  if (!reauthed) {
    logger.error('基础重认证失败，后续测试无意义，终止');
    return;
  }

  // ② 端到端刷新
  const { newToken } = await testEndToEndRefresh();

  // ③ 磁盘持久化
  await testDiskPersistence(newToken ?? MiService.MiNA?.account?.serviceToken);

  logger.title('测试完成');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('测试脚本异常', err);
    process.exit(1);
  });

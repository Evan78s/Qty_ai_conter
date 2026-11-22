/**
 * 首次创建平台总管理员：检测 users 表为空才执行，随机强密码只打印一次。
 * 用法：npm run bootstrap:admin -- --username admin [--name 总管理员] [--password xxx]
 */
import { db, schema, closeDb } from '../db';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { newId } from '../db/schema';

const args = process.argv.slice(2);
const username = args.includes('--username') ? args[args.indexOf('--username') + 1] : 'admin';
const displayName = args.includes('--name') ? args[args.indexOf('--name') + 1] : '总管理员';
let password = args.includes('--password') ? args[args.indexOf('--password') + 1] : '';
if (!password) password = randomBytes(9).toString('base64url');
const peppered = password + (process.env.PASSWORD_PEPPER || '');

async function main() {
  const count = (await db.select().from(schema.users)).length;
  if (count > 0) {
    console.error('[bootstrap] users 表非空，出于安全拒绝执行。如需重置请手动清库。');
    await closeDb();
    process.exit(1);
  }
  const hash = await bcrypt.hash(peppered, 12);
  const id = newId('usr');
  // 平台超管：tenantId = null
  await db.insert(schema.users).values({
    id, tenantId: null, username, displayName, passwordHash: hash, roleCode: 'super_admin',
    mustChangePassword: true, createdAt: Date.now(),
  });
  console.log('\n========== 平台总管理员已创建 ==========');
  console.log(`账号: ${username}`);
  console.log(`初始密码: ${password}`);
  console.log('请妥善保存，首次登录将强制修改。');
  console.log('========================================\n');
  await closeDb();
  process.exit(0);
}
main().catch(async (err) => {
  console.error('[bootstrap] 失败:', err?.message || err);
  await closeDb();
  process.exit(1);
});

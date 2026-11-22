/** 初始化种子数据：公司占位 + 4 个角色 + 3 家门店 + 5 个 AI 场景 + 品牌设置。可重复执行（幂等）。
 *  连锁店版部署：tenants 表仅保留一条内部占位记录（平滑升级，不删表），不对外暴露"租户"概念。 */
import { db, closeDb, schema } from './index';
import { newId } from './schema';
import { eq } from 'drizzle-orm';

/** 可被安装向导复用的种子函数；不在此处关闭连接。 */
export async function runSeed(): Promise<void> {
  const now = Date.now();
  const DEFAULT_TENANT_CODE = 'default';

  let tenant = (await db.select().from(schema.tenants).where(eq(schema.tenants.code, DEFAULT_TENANT_CODE)).limit(1))[0];
  if (!tenant) {
    const id = newId('ten');
    // 仅作为内部占位：这套系统只服务一家公司，tenants 表保留只为兼容已装好的库结构
    const row = { id, name: '本公司', code: DEFAULT_TENANT_CODE, contactName: '', phone: '', remark: null, plan: 'standard', status: 'active', createdAt: now };
    await db.insert(schema.tenants).values(row);
    tenant = row;
  }
  const tenantId = tenant.id;

  const roleDefs: Array<[string, string, Record<string, number>]> = [
    ['super_admin', '公司总管理员', { overview: 4, store: 4, reconcile: 4, ads: 4, service: 4, social: 4, system: 4 }],
    ['store_manager', '分店店长', { overview: 3, store: 3, reconcile: 3, ads: 1, service: 3, social: 3, system: 0 }],
    ['staff', '员工', { overview: 1, store: 1, reconcile: 2, ads: 0, service: 2, social: 2, system: 0 }],
    ['auditor', '只读审计', { overview: 1, store: 1, reconcile: 1, ads: 1, service: 1, social: 1, system: 1 }],
  ];
  for (const [code, name, perms] of roleDefs) {
    const found = (await db.select().from(schema.roles).where(eq(schema.roles.code, code)).limit(1))[0];
    if (!found) {
      await db.insert(schema.roles).values({ id: newId('rol'), code, name, permissions: JSON.stringify(perms), isSystem: true, createdAt: now });
    }
  }

  const storeDefs: Array<[string, string, string, number]> = [
    ['鵲太醫·总店', '静安区南京西路 1266 号', '张敏', 12],
    ['鵲太醫·静安店', '静安区愚园路 88 号', '李娜', 9],
    ['鵲太醫·浦东店', '浦东新区世纪大道 200 号', '王芳', 10],
  ];
  for (const [name, address, manager, staff] of storeDefs) {
    const found = (await db.select().from(schema.stores).where(eq(schema.stores.name, name)).limit(1))[0];
    if (!found) {
      await db.insert(schema.stores).values({ id: newId('sto'), tenantId, name, address, managerName: manager, staffCount: staff, status: 'active', createdAt: now });
    }
  }

  const scenes: Array<[string, string]> = [
    ['reconcile', '店铺对账核对'], ['ads', '投流数据分析'], ['social', '自媒体内容创作'],
    ['service', 'AI 客服回复'], ['video', '视频生成'],
  ];
  for (const [sceneCode, name] of scenes) {
    const found = (await db.select().from(schema.aiScenes).where(eq(schema.aiScenes.sceneCode, sceneCode)).limit(1))[0];
    if (!found) {
      await db.insert(schema.aiScenes).values({ id: newId('scn'), tenantId, sceneCode, name, temperature: sceneCode === 'social' ? '0.8' : '0.3', enabled: true, createdAt: now });
    }
  }

  const brandFound = (await db.select().from(schema.platformSettings).limit(1))[0];
  if (!brandFound) {
    await db.insert(schema.platformSettings).values({
      id: newId('set'), platformName: '鵲太醫', logoUrl: '/logo.ico', logoText: '鵲',
      subtitle: 'AI OPERATION HUB', updatedAt: now, createdAt: now,
    });
  }
}

/** 独立脚本入口：tsx src/db/seed.ts */
if (require.main === module) {
  runSeed().then(async () => {
    console.log('[seed] 完成');
    await closeDb();
  }).catch(async (err) => {
    console.error('[seed] 失败:', err?.message || err);
    await closeDb();
    process.exit(1);
  });
}

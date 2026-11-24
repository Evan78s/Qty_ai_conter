import {
  Controller, Get, Post, Req, UseGuards, ForbiddenException, ServiceUnavailableException,
} from '@nestjs/common';
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { PERM } from '../../common/constants';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';
import { AuditService } from '../../common/audit.service';

/**
 * 后台一键升级：只读状态/日志 + 仅超管触发。
 * 真正的 git pull / 构建 / 重启由 root 权限的 /usr/local/bin/qty-upgrade 脚本执行，
 * 本控制器只负责写初始状态、异步拉起脚本、把结果读给前端。
 */
@Controller('api/upgrade')
@UseGuards(AuthGuard)
export class UpgradeController {
  constructor(private audit: AuditService) {}

  private get appDir(): string {
    // 后端工作目录是 <app>/api，源码根目录是其上一级
    return path.resolve(process.cwd(), '..');
  }
  private get statusFile(): string {
    return path.join(this.appDir, 'api', 'data', 'upgrade-status.json');
  }
  private get logFile(): string {
    return path.join(this.appDir, 'api', 'data', 'upgrade.log');
  }
  private get versionFile(): string {
    return path.join(this.appDir, 'web', 'src', 'version.ts');
  }
  private get upgradeBin(): string { return '/usr/local/bin/qty-upgrade'; }

  private readJson(): any {
    try { return JSON.parse(fs.readFileSync(this.statusFile, 'utf8')); }
    catch { return { state: 'idle', stage: '', message: '', ok: true }; }
  }

  private currentVersion(): string {
    try {
      const src = fs.readFileSync(this.versionFile, 'utf8');
      const m = src.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      return m ? m[1] : 'unknown';
    } catch { return 'unknown'; }
  }
  private currentCommit(): string {
    try {
      return execFileSync('git', ['-C', this.appDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', timeout: 5000 }).trim();
    } catch { return ''; }
  }
  /** 获取远端最新提交号（不影响主流程，失败返回空）。 */
  private remoteCommit(): string {
    try {
      const out = execFileSync('git', ['-C', this.appDir, 'ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8', timeout: 8000 });
      return out.trim().split(/\s+/)[0]?.slice(0, 7) || '';
    } catch { return ''; }
  }

  /** 状态查询：前端轮询。 */
  @Get('status')
  async status() {
    const st = this.readJson();
    const local = this.currentCommit();
    const remote = this.remoteCommit();
    return {
      ok: true,
      version: this.currentVersion(),
      commit: st.commit || local,
      remoteCommit: remote,
      hasUpdate: !!(remote && local && remote !== local),
      state: st.state || 'idle',        // idle | running | success | error
      stage: st.stage || '',
      message: st.message || '',
      success: st.ok !== false,
      updatedAt: st.updatedAt || 0,
      upgradeAvailable: fs.existsSync(this.upgradeBin),
    };
  }

  /** 升级日志（末尾 200 行）。 */
  @Get('log')
  async log() {
    try {
      const text = fs.readFileSync(this.logFile, 'utf8');
      const lines = text.split('\n');
      return { ok: true, log: lines.slice(-200).join('\n') };
    } catch { return { ok: true, log: '暂无升级日志' }; }
  }

  /** 触发升级（仅超管）。异步 detached，立即返回，避免重启时挂住本次请求。 */
  @Post('trigger')
  @RequirePerm('system', PERM.EDIT)
  async trigger(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    if (!user?.isSuper) throw new ForbiddenException('仅公司总管理员可执行系统升级');
    if (!fs.existsSync(this.upgradeBin)) {
      throw new ServiceUnavailableException('服务器未安装升级组件，请用命令行升级（见文档）');
    }
    // 写初始状态，供前端立刻进入轮询态
    const dir = path.dirname(this.statusFile);
    fs.mkdirSync(dir, { recursive: true });
    const init = { state: 'running', stage: '启动', message: '升级任务已启动…', ok: true, updatedAt: Math.floor(Date.now() / 1000) };
    fs.writeFileSync(this.statusFile, JSON.stringify(init), { mode: 0o644 });

    // detached + unref：父进程（后端）返回响应后不等待子进程；子进程由 init 托管
    const child = spawn('sudo', ['-n', this.upgradeBin], {
      detached: true,
      stdio: 'ignore',
      cwd: this.appDir,
    });
    child.on('error', () => {
      // sudo 失败时回写错误状态，让前端能感知
      try {
        const d = this.readJson();
        fs.writeFileSync(this.statusFile, JSON.stringify({ ...d, state: 'error', message: '无法启动升级组件，请检查 sudo 配置', ok: false, updatedAt: Math.floor(Date.now() / 1000) }));
      } catch { /* ignore */ }
    });
    child.unref();

    await this.audit.log('触发系统升级', 'system', { userId: user.id, ip: req.ip });
    return { ok: true, message: '升级已启动，请等待完成提示' };
  }
}

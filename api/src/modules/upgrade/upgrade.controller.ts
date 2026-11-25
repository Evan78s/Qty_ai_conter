import {
  Controller, Get, Post, Req, Query, UseGuards, ForbiddenException, ServiceUnavailableException,
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
  /**
   * 本地提交号：优先直接读 .git 文件，不依赖 git 命令。
   * 后端进程以 www 运行，源码由 root 脚本操作后属主可能变 root，
   * 高版本 Git 会报 dubious ownership 并拒绝所有 git 命令——这是「本地提交 —」的根因。
   */
  private currentCommit(): string {
    try {
      const gitDir = path.join(this.appDir, '.git');
      const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
      const refMatch = head.match(/^ref:\s*(.+)$/);
      if (refMatch) {
        try {
          return fs.readFileSync(path.join(gitDir, refMatch[1]), 'utf8').trim().slice(0, 7);
        } catch {
          // 提交可能被打包进 packed-refs
          try {
            const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
            const line = packed.split('\n').find((l) => l.endsWith(` ${refMatch[1]}`));
            if (line) return line.split(' ')[0].slice(0, 7);
          } catch { /* ignore */ }
        }
      } else if (/^[0-9a-f]{40}$/i.test(head)) {
        return head.slice(0, 7);
      }
    } catch { /* ignore */ }
    try {
      return execFileSync('git', ['-c', 'safe.directory=*', '-C', this.appDir, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', timeout: 5000 }).trim();
    } catch { return ''; }
  }

  /** 远端检测结果带缓存：前端轮询时避免每次都打 GitHub。 */
  private remoteCache: { commit: string; error: string; at: number } = { commit: '', error: '', at: 0 };

  /** 获取远端最新提交号：优先 GitHub API（15 秒），失败退回 git ls-remote（20 秒）。 */
  private async remoteCommit(force = false): Promise<{ commit: string; error: string; at: number }> {
    const now = Date.now();
    if (!force && this.remoteCache.at && now - this.remoteCache.at < 3 * 60 * 1000) {
      return this.remoteCache;
    }
    let commit = '';
    let error = '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('https://api.github.com/repos/Evan78s/Qty_ai_conter/commits/master', {
        headers: { 'User-Agent': 'quetaiyi-upgrade-check', Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      } as any);
      if (res.ok) {
        const data: any = await res.json();
        commit = String(data?.sha || '').slice(0, 7);
      } else {
        error = `GitHub API 返回 ${res.status}`;
      }
    } catch (e: any) {
      error = e?.name === 'AbortError' ? '连接 GitHub 超时' : '无法连接 GitHub';
    } finally {
      clearTimeout(timer);
    }
    if (!commit) {
      try {
        const out = execFileSync('git', ['-c', 'safe.directory=*', '-C', this.appDir, 'ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8', timeout: 20000 });
        commit = out.trim().split(/\s+/)[0]?.slice(0, 7) || '';
        if (commit) error = '';
      } catch { /* 保留上面的错误信息 */ }
    }
    this.remoteCache = { commit, error, at: now };
    return this.remoteCache;
  }

  /** 状态查询：前端轮询。 */
  @Get('status')
  async status(@Query('force') force?: string) {
    const st = this.readJson();
    const local = this.currentCommit();
    const remote = await this.remoteCommit(force === '1');
    const hasUpdate = remote.commit && local ? remote.commit !== local : null;
    return {
      ok: true,
      version: this.currentVersion(),
      commit: st.commit || local,
      remoteCommit: remote.commit,
      checkError: remote.error,
      checkedAt: remote.at,
      hasUpdate,
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

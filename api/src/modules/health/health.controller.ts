import { Controller, Get } from '@nestjs/common';
import { pool } from '../../db';

@Controller('api/health')
export class HealthController {
  @Get()
  async health() {
    let dbStatus = 'ok';
    try { await pool.execute('SELECT 1'); }
    catch { dbStatus = 'error'; }
    return { status: 'ok', db: dbStatus, ts: Date.now() };
  }
}

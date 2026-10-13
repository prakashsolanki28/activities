import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/**
 * The whole refinery may share one egress IP, so per-employee traffic is keyed on the
 * attempt token when one is present; only token-less requests fall back to the IP.
 */
@Injectable()
export class AttemptAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const token = req.headers?.['x-attempt-token'];
    if (typeof token === 'string' && token.length > 10) {
      return `t:${createHash('sha256').update(token).digest('hex').slice(0, 24)}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  }
}

// Rate limiting utilities

const RATE_LIMIT_CONFIG = {
  uploads: {
    maxAttempts: 20,
    windowMs: 60 * 60 * 1000,
    cooldownMs: 60 * 1000,
  },
  edits: {
    maxAttempts: 20,
    windowMs: 60 * 60 * 1000,
    cooldownMs: 60 * 1000,
  },
  downloads: {
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000,
    cooldownMs: 6 * 1000,
  },
  auth: {
    maxAttempts: 5,
    windowMs: 30 * 60 * 1000,
    cooldownMs: 30 * 1000,
  },
};

export class ClientRateLimiter {
  constructor(userId, action = 'uploads') {
    this.userId = userId;
    this.action = action;
    this.config = RATE_LIMIT_CONFIG[action];
    this.storageKey = `ratelimit_${action}_${userId}`;
  }

  getRecentAttempts() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return [];
      
      const attempts = JSON.parse(data);
      const now = Date.now();
      
      return attempts.filter(
        timestamp => now - timestamp < this.config.windowMs
      );
    } catch (e) {
      console.error('Error reading rate limit data:', e);
      return [];
    }
  }

  recordAttempt() {
    try {
      const attempts = this.getRecentAttempts();
      attempts.push(Date.now());
      localStorage.setItem(this.storageKey, JSON.stringify(attempts));
    } catch (e) {
      console.error('Error recording rate limit:', e);
    }
  }

  checkLimit() {
    const attempts = this.getRecentAttempts();
    const now = Date.now();
    
    if (attempts.length > 0) {
      const lastAttempt = attempts[attempts.length - 1];
      const timeSinceLastAttempt = now - lastAttempt;
      
      if (timeSinceLastAttempt < this.config.cooldownMs) {
        const secondsRemaining = Math.ceil((this.config.cooldownMs - timeSinceLastAttempt) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetTime: secondsRemaining,
          attempts: attempts.length,
          maxAttempts: this.config.maxAttempts,
          reason: 'cooldown',
        };
      }
    }
    
    const allowed = attempts.length < this.config.maxAttempts;
    const remaining = Math.max(0, this.config.maxAttempts - attempts.length);
    
    let resetTime = 0;
    if (attempts.length > 0) {
      resetTime = attempts[0] + this.config.windowMs - now;
      resetTime = Math.max(0, Math.ceil(resetTime / 1000));
    }

    return {
      allowed,
      remaining,
      resetTime,
      attempts: attempts.length,
      maxAttempts: this.config.maxAttempts,
      reason: allowed ? null : 'hourly_limit',
    };
  }

  getLimitMessage() {
    const status = this.checkLimit();
    if (status.allowed) {
      return `You have ${status.remaining} ${this.action === 'uploads' ? 'upload' : 'edit'}(s) remaining this hour`;
    }
    
    if (status.reason === 'cooldown') {
      return `Please wait ${status.resetTime} second${status.resetTime !== 1 ? 's' : ''} before your next ${this.action === 'uploads' ? 'upload' : 'edit'}`;
    }
    
    const minutes = Math.ceil(status.resetTime / 60);
    return `Hourly limit exceeded. You've used all ${this.config.maxAttempts} ${this.action} this hour. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

}

export async function checkServerRateLimit(supabase, userId, action = 'uploads') {
  const config = RATE_LIMIT_CONFIG[action];
  const hourAgo = new Date(Date.now() - config.windowMs).toISOString();
  
  try {
    let query = supabase
      .from('blueprints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', hourAgo);
    
    const { count, error } = await query;
    
    if (error) {
      console.error('Error checking server rate limit:', error);
      return { allowed: true, error };
    }

    const attempts = count || 0;
    const allowed = attempts < config.maxAttempts;
    const remaining = Math.max(0, config.maxAttempts - attempts);

    return {
      allowed,
      remaining,
      attempts,
      maxAttempts: config.maxAttempts,
    };
  } catch (e) {
    console.error('Server rate limit check failed:', e);
    return { allowed: true, error: e.message };
  }
}

export function formatTimeRemaining(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}

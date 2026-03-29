const SYNC_ROUNDS = 5;
const SYNC_INTERVAL_MS = 30_000; // Re-sync every 30 seconds

interface SyncSample {
  offset: number; // serverTime - clientTime (ms)
  rtt: number; // round-trip time (ms)
}

/**
 * NTP-like time synchronization utility.
 *
 * Performs multiple sync exchanges with the server and computes a clock offset
 * using the NTP algorithm:
 *   RTT = (t4 - t1) - (t3 - t2)
 *   offset = ((t2 - t1) + (t3 - t4)) / 2
 *
 * The offset lets the client approximate server time:
 *   serverTime ≈ Date.now() + offset
 *
 * The buzz endpoint receives this adjusted timestamp so the server can order
 * buzzes by the estimated "true" time, compensating for network latency.
 */
export class TimeSync {
  private offset = 0;
  private rtt = Infinity;
  private synced = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Start periodic synchronization. */
  async start(): Promise<void> {
    await this.performSync();
    this.intervalId = setInterval(() => {
      this.performSync();
    }, SYNC_INTERVAL_MS);
  }

  /** Stop periodic synchronization. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Returns the current estimated clock offset in ms (serverTime - clientTime). */
  getOffset(): number {
    return this.offset;
  }

  /** Returns the current estimated round-trip time in ms. */
  getRTT(): number {
    return this.rtt;
  }

  /** Returns whether at least one successful sync has completed. */
  isSynced(): boolean {
    return this.synced;
  }

  /** Returns the estimated current server time in ms since epoch (integer). */
  getServerTime(): number {
    return Math.round(Date.now() + this.offset);
  }

  /** Perform a full sync cycle (multiple rounds, take median). */
  private async performSync(): Promise<void> {
    const samples: SyncSample[] = [];

    for (let i = 0; i < SYNC_ROUNDS; i++) {
      try {
        const sample = await this.singleSync();
        if (sample) samples.push(sample);
      } catch {
        // Individual sync failure is acceptable; continue with remaining rounds.
      }
    }

    if (samples.length === 0) return;

    // Sort by RTT and take the median – the sample with the lowest variance
    // in one-way delay is the most accurate estimate.
    samples.sort((a, b) => a.rtt - b.rtt);
    const median = samples[Math.floor(samples.length / 2)];
    this.offset = median.offset;
    this.rtt = median.rtt;
    this.synced = true;
  }

  /**
   * Perform a single NTP-like exchange:
   *   t1 = client send time
   *   t2 = server receive time  (from response)
   *   t3 = server send time     (from response)
   *   t4 = client receive time
   */
  private async singleSync(): Promise<SyncSample | null> {
    const t1 = Date.now();

    const response = await fetch("/api/buzzer/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSendTime: t1 }),
    });

    const t4 = Date.now();

    if (!response.ok) return null;

    const data = (await response.json()) as {
      clientSendTime: number;
      serverReceiveTime: number;
      serverSendTime: number;
    };

    const t2 = data.serverReceiveTime;
    const t3 = data.serverSendTime;

    const rtt = t4 - t1 - (t3 - t2);
    const offset = (t2 - t1 + (t3 - t4)) / 2;

    return { offset, rtt };
  }
}

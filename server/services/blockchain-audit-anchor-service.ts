import crypto from "crypto";

interface AuditEntry {
  id: string;
  action: string;
  saidPatientId?: string;
  appSource: string;
  requestId: string;
  timestamp: string;
}

interface AnchorResult {
  batchHash: string;
  batchSize: number;
  startId: string;
  endId: string;
  timestamp: string;
  previousAnchor: string | null;
}

class BlockchainAuditAnchorService {
  private batchBuffer: AuditEntry[] = [];
  private anchorChain: AnchorResult[] = [];
  private readonly BATCH_SIZE = 100;

  addEntry(entry: AuditEntry): AnchorResult | null {
    this.batchBuffer.push(entry);

    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      return this.createAnchor();
    }

    return null;
  }

  createAnchor(): AnchorResult {
    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    const batchData = batch
      .map((e) => `${e.id}|${e.action}|${e.saidPatientId || ""}|${e.appSource}|${e.requestId}|${e.timestamp}`)
      .join("\n");

    const previousAnchor =
      this.anchorChain.length > 0
        ? this.anchorChain[this.anchorChain.length - 1].batchHash
        : null;

    const hashInput = previousAnchor
      ? `${previousAnchor}\n${batchData}`
      : batchData;

    const batchHash = crypto
      .createHash("sha256")
      .update(hashInput)
      .digest("hex");

    const anchor: AnchorResult = {
      batchHash,
      batchSize: batch.length,
      startId: batch[0]?.id || "",
      endId: batch[batch.length - 1]?.id || "",
      timestamp: new Date().toISOString(),
      previousAnchor,
    };

    this.anchorChain.push(anchor);

    console.log(
      `[BlockchainAudit] Anchor created: ${batchHash.slice(0, 16)}... (${batch.length} entries, chain length: ${this.anchorChain.length})`
    );

    return anchor;
  }

  verifyChain(): { valid: boolean; chainLength: number; lastAnchor: string | null } {
    if (this.anchorChain.length === 0) {
      return { valid: true, chainLength: 0, lastAnchor: null };
    }

    for (let i = 1; i < this.anchorChain.length; i++) {
      if (this.anchorChain[i].previousAnchor !== this.anchorChain[i - 1].batchHash) {
        console.error(`[BlockchainAudit] Chain broken at position ${i}`);
        return {
          valid: false,
          chainLength: this.anchorChain.length,
          lastAnchor: this.anchorChain[this.anchorChain.length - 1].batchHash,
        };
      }
    }

    return {
      valid: true,
      chainLength: this.anchorChain.length,
      lastAnchor: this.anchorChain[this.anchorChain.length - 1].batchHash,
    };
  }

  getChainStatus(): {
    chainLength: number;
    pendingEntries: number;
    lastAnchorHash: string | null;
    lastAnchorTime: string | null;
    chainValid: boolean;
  } {
    const verification = this.verifyChain();
    return {
      chainLength: this.anchorChain.length,
      pendingEntries: this.batchBuffer.length,
      lastAnchorHash: verification.lastAnchor,
      lastAnchorTime:
        this.anchorChain.length > 0
          ? this.anchorChain[this.anchorChain.length - 1].timestamp
          : null,
      chainValid: verification.valid,
    };
  }
}

export const blockchainAuditAnchorService = new BlockchainAuditAnchorService();

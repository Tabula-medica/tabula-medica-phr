/**
 * In-Memory Summarization Queue
 * Provides bounded concurrency for async document summarization
 */

interface QueuedTask {
  id: string;
  fn: () => Promise<void>;
  createdAt: Date;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}

class SummarizationQueue {
  private queue: QueuedTask[] = [];
  private running: number = 0;
  private maxConcurrency: number;
  private maxQueueSize: number;
  
  constructor(maxConcurrency = 2, maxQueueSize = 50) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueueSize = maxQueueSize;
  }

  async enqueue(id: string, fn: () => Promise<void>): Promise<boolean> {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`[SummarizationQueue] Queue full (${this.maxQueueSize}), rejecting task ${id}`);
      return false;
    }

    const task: QueuedTask = {
      id,
      fn,
      createdAt: new Date(),
      status: "pending",
    };

    this.queue.push(task);
    console.log(`[SummarizationQueue] Enqueued task ${id}, queue size: ${this.queue.length}`);
    
    this.processNext();
    return true;
  }

  private async processNext(): Promise<void> {
    if (this.running >= this.maxConcurrency) {
      return;
    }

    const task = this.queue.find(t => t.status === "pending");
    if (!task) {
      return;
    }

    task.status = "running";
    this.running++;
    
    console.log(`[SummarizationQueue] Starting task ${task.id}, running: ${this.running}`);

    try {
      await task.fn();
      task.status = "completed";
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : "Unknown error";
      console.error(`[SummarizationQueue] Task ${task.id} failed:`, task.error);
    } finally {
      this.running--;
      
      const idx = this.queue.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        this.queue.splice(idx, 1);
      }
      
      this.processNext();
    }
  }

  getStatus(): { queueSize: number; running: number; pending: number } {
    return {
      queueSize: this.queue.length,
      running: this.running,
      pending: this.queue.filter(t => t.status === "pending").length,
    };
  }

  clear(): void {
    this.queue = this.queue.filter(t => t.status === "running");
    console.log(`[SummarizationQueue] Cleared pending tasks, ${this.running} still running`);
  }
}

export const summarizationQueue = new SummarizationQueue(2, 50);

export function enqueueSummarization(
  taskId: string,
  summarizeFn: () => Promise<void>
): Promise<boolean> {
  return summarizationQueue.enqueue(taskId, summarizeFn);
}

export function getQueueStatus() {
  return summarizationQueue.getStatus();
}

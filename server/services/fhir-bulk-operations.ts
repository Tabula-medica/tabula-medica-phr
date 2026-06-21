import { randomUUID } from "crypto";

export type BulkOperationType = "create" | "update" | "delete";
export type BulkOperationStatus = "pending" | "in_progress" | "completed" | "failed" | "partial";

export interface BulkOperationItem {
  id: string;
  resourceType: string;
  resourceId?: string;
  operation: BulkOperationType;
  targetSystem: string;
  payload?: Record<string, unknown>;
  status: "pending" | "success" | "failed";
  error?: string;
  processedAt?: string;
}

export interface BulkOperation {
  id: string;
  name: string;
  description?: string;
  operation: BulkOperationType;
  status: BulkOperationStatus;
  targetSystems: string[];
  items: BulkOperationItem[];
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  auditLog: Array<{
    timestamp: string;
    action: string;
    details: string;
    userId?: string;
  }>;
}

export interface BulkOperationRequest {
  name: string;
  description?: string;
  operation: BulkOperationType;
  targetSystems: string[];
  resources: Array<{
    resourceType: string;
    resourceId?: string;
    payload?: Record<string, unknown>;
  }>;
}

const SUPPORTED_SYSTEMS = [
  { id: "fastenhealth", name: "Fasten Health", status: "connected" },
  { id: "internal", name: "Tabula Medica", status: "connected" },
];

class FhirBulkOperationsService {
  private operations: Map<string, BulkOperation> = new Map();
  private processingQueue: string[] = [];
  private isProcessing = false;

  async createBulkOperation(request: BulkOperationRequest, userId: string): Promise<BulkOperation> {
    const operationId = randomUUID();
    const now = new Date().toISOString();

    const items: BulkOperationItem[] = [];
    for (const resource of request.resources) {
      for (const system of request.targetSystems) {
        items.push({
          id: randomUUID(),
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          operation: request.operation,
          targetSystem: system,
          payload: resource.payload,
          status: "pending",
        });
      }
    }

    const operation: BulkOperation = {
      id: operationId,
      name: request.name,
      description: request.description,
      operation: request.operation,
      status: "pending",
      targetSystems: request.targetSystems,
      items,
      totalItems: items.length,
      processedItems: 0,
      successCount: 0,
      failedCount: 0,
      createdAt: now,
      createdBy: userId,
      auditLog: [
        {
          timestamp: now,
          action: "OPERATION_CREATED",
          details: `Bulk ${request.operation} operation created with ${items.length} items`,
          userId,
        },
      ],
    };

    this.operations.set(operationId, operation);
    console.log(`[BulkOps] Created operation ${operationId} with ${items.length} items`);

    return operation;
  }

  async executeBulkOperation(operationId: string, userId: string): Promise<BulkOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error("Operation not found");
    }

    if (operation.status === "in_progress") {
      throw new Error("Operation is already in progress");
    }

    const now = new Date().toISOString();
    operation.status = "in_progress";
    operation.startedAt = now;
    operation.auditLog.push({
      timestamp: now,
      action: "OPERATION_STARTED",
      details: "Bulk operation execution started",
      userId,
    });

    this.processingQueue.push(operationId);
    this.processQueue();

    return operation;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const operationId = this.processingQueue.shift();
      if (operationId) {
        await this.processOperation(operationId);
      }
    }

    this.isProcessing = false;
  }

  private async processOperation(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    for (const item of operation.items) {
      if (item.status !== "pending") continue;

      try {
        await this.processItem(item, operation.operation);
        item.status = "success";
        item.processedAt = new Date().toISOString();
        operation.successCount++;
      } catch (error) {
        item.status = "failed";
        item.error = error instanceof Error ? error.message : "Unknown error";
        item.processedAt = new Date().toISOString();
        operation.failedCount++;
      }

      operation.processedItems++;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const now = new Date().toISOString();
    operation.completedAt = now;
    operation.status = operation.failedCount === 0 
      ? "completed" 
      : operation.successCount === 0 
        ? "failed" 
        : "partial";

    operation.auditLog.push({
      timestamp: now,
      action: "OPERATION_COMPLETED",
      details: `Completed: ${operation.successCount} success, ${operation.failedCount} failed`,
    });

    console.log(`[BulkOps] Operation ${operationId} completed: ${operation.status}`);
  }

  private async processItem(item: BulkOperationItem, operationType: BulkOperationType): Promise<void> {
    const system = SUPPORTED_SYSTEMS.find((s) => s.id === item.targetSystem);
    if (!system) {
      throw new Error(`Unknown target system: ${item.targetSystem}`);
    }

    if (system.status === "disconnected") {
      throw new Error(`System ${system.name} is disconnected`);
    }

    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));

    if (Math.random() < 0.05) {
      throw new Error("Simulated network timeout");
    }

    console.log(`[BulkOps] Processed ${operationType} for ${item.resourceType} on ${item.targetSystem}`);
  }

  async getOperation(operationId: string): Promise<BulkOperation | undefined> {
    return this.operations.get(operationId);
  }

  async listOperations(filters?: {
    status?: BulkOperationStatus;
    operation?: BulkOperationType;
    createdBy?: string;
  }): Promise<BulkOperation[]> {
    let operations = Array.from(this.operations.values());

    if (filters?.status) {
      operations = operations.filter((op) => op.status === filters.status);
    }
    if (filters?.operation) {
      operations = operations.filter((op) => op.operation === filters.operation);
    }
    if (filters?.createdBy) {
      operations = operations.filter((op) => op.createdBy === filters.createdBy);
    }

    return operations.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async cancelOperation(operationId: string, userId: string): Promise<BulkOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error("Operation not found");
    }

    if (operation.status === "completed" || operation.status === "failed") {
      throw new Error("Cannot cancel completed or failed operation");
    }

    const now = new Date().toISOString();
    operation.status = "failed";
    operation.completedAt = now;
    operation.auditLog.push({
      timestamp: now,
      action: "OPERATION_CANCELLED",
      details: "Operation cancelled by user",
      userId,
    });

    const queueIndex = this.processingQueue.indexOf(operationId);
    if (queueIndex > -1) {
      this.processingQueue.splice(queueIndex, 1);
    }

    return operation;
  }

  async retryFailedItems(operationId: string, userId: string): Promise<BulkOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error("Operation not found");
    }

    const failedItems = operation.items.filter((item) => item.status === "failed");
    if (failedItems.length === 0) {
      throw new Error("No failed items to retry");
    }

    for (const item of failedItems) {
      item.status = "pending";
      item.error = undefined;
      item.processedAt = undefined;
    }

    operation.failedCount = 0;
    operation.status = "pending";
    operation.auditLog.push({
      timestamp: new Date().toISOString(),
      action: "RETRY_INITIATED",
      details: `Retrying ${failedItems.length} failed items`,
      userId,
    });

    return this.executeBulkOperation(operationId, userId);
  }

  getSupportedSystems() {
    return SUPPORTED_SYSTEMS;
  }

  getOperationStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  } {
    const operations = Array.from(this.operations.values());
    return {
      total: operations.length,
      pending: operations.filter((op) => op.status === "pending").length,
      inProgress: operations.filter((op) => op.status === "in_progress").length,
      completed: operations.filter((op) => op.status === "completed").length,
      failed: operations.filter((op) => op.status === "failed" || op.status === "partial").length,
    };
  }
}

export const fhirBulkOperations = new FhirBulkOperationsService();

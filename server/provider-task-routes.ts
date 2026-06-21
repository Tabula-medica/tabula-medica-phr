import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  insertProviderTaskSchema,
  updateProviderTaskSchema,
  type ProviderTask,
  type ProviderTaskStatus,
} from "@shared/schema";

const router = Router();

const providerTasks = new Map<string, ProviderTask>();

function getUserId(req: Request): string {
  return (req as any).userId || (req as any).user?.id || "anonymous";
}

function getUserName(req: Request): string {
  return (req as any).user?.name || (req as any).userName || "Provider";
}

router.get("/", (req: Request, res: Response) => {
  try {
    const { status, priority, category, assignedTo, patientId, search } = req.query;

    let tasks = Array.from(providerTasks.values());

    if (status && typeof status === "string") {
      tasks = tasks.filter((t) => t.status === status);
    }
    if (priority && typeof priority === "string") {
      tasks = tasks.filter((t) => t.priority === priority);
    }
    if (category && typeof category === "string") {
      tasks = tasks.filter((t) => t.category === category);
    }
    if (assignedTo && typeof assignedTo === "string") {
      tasks = tasks.filter((t) => t.assignedTo === assignedTo);
    }
    if (patientId && typeof patientId === "string") {
      tasks = tasks.filter((t) => t.patientId === patientId);
    }
    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.patientName && t.patientName.toLowerCase().includes(q))
      );
    }

    const now = new Date();
    tasks = tasks.map((t) => {
      if (
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        new Date(t.dueDate) < now
      ) {
        return { ...t, status: "overdue" as ProviderTaskStatus };
      }
      return t;
    });

    tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = { overdue: 0, in_progress: 1, pending: 2, completed: 3, cancelled: 4 };
      const sComp = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
      if (sComp !== 0) return sComp;
      const pComp = (priorityOrder[a.priority] ?? 5) - (priorityOrder[b.priority] ?? 5);
      if (pComp !== 0) return pComp;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return res.json({ tasks });
  } catch (error) {
    console.error("[ProviderTasks] Error listing tasks:", error);
    return res.status(500).json({ error: "Failed to list tasks" });
  }
});

router.get("/stats", (_req: Request, res: Response) => {
  try {
    const tasks = Array.from(providerTasks.values());
    const now = new Date();

    const stats = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
      overdue: tasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          new Date(t.dueDate) < now
      ).length,
      dueSoon: tasks.filter((t) => {
        if (t.status === "completed" || t.status === "cancelled") return false;
        const due = new Date(t.dueDate);
        const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        return due >= now && due <= threeDays;
      }).length,
      byPriority: {
        urgent: tasks.filter((t) => t.priority === "urgent" && t.status !== "completed" && t.status !== "cancelled").length,
        high: tasks.filter((t) => t.priority === "high" && t.status !== "completed" && t.status !== "cancelled").length,
        medium: tasks.filter((t) => t.priority === "medium" && t.status !== "completed" && t.status !== "cancelled").length,
        low: tasks.filter((t) => t.priority === "low" && t.status !== "completed" && t.status !== "cancelled").length,
      },
    };

    return res.json({ stats });
  } catch (error) {
    console.error("[ProviderTasks] Error getting stats:", error);
    return res.status(500).json({ error: "Failed to get task stats" });
  }
});

router.get("/:taskId", (req: Request, res: Response) => {
  try {
    const task = providerTasks.get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    return res.json({ task });
  } catch (error) {
    console.error("[ProviderTasks] Error getting task:", error);
    return res.status(500).json({ error: "Failed to get task" });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const parsed = insertProviderTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid task data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = getUserId(req);
    const userName = getUserName(req);
    const now = new Date().toISOString();

    const task: ProviderTask = {
      id: randomUUID(),
      title: parsed.data.title,
      description: parsed.data.description || "",
      category: parsed.data.category,
      status: "pending",
      priority: parsed.data.priority || "medium",
      patientId: parsed.data.patientId,
      patientName: parsed.data.patientName,
      assignedTo: parsed.data.assignedTo,
      assignedToName: parsed.data.assignedToName,
      createdBy: userId,
      createdByName: userName,
      dueDate: parsed.data.dueDate,
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    providerTasks.set(task.id, task);
    console.log(`[ProviderTasks] Task created: ${task.id} - ${task.title}`);

    return res.status(201).json({ task });
  } catch (error) {
    console.error("[ProviderTasks] Error creating task:", error);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/:taskId", (req: Request, res: Response) => {
  try {
    const task = providerTasks.get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const parsed = updateProviderTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid update data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updates = parsed.data;
    const now = new Date().toISOString();

    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.category !== undefined) task.category = updates.category;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.assignedTo !== undefined) task.assignedTo = updates.assignedTo;
    if (updates.assignedToName !== undefined) task.assignedToName = updates.assignedToName;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;

    if (updates.status !== undefined) {
      task.status = updates.status;
      if (updates.status === "completed") {
        task.completedAt = now;
      }
    }

    if (updates.note) {
      task.notes.push(`[${now}] ${updates.note}`);
    }

    task.updatedAt = now;
    providerTasks.set(task.id, task);

    console.log(`[ProviderTasks] Task updated: ${task.id} - status: ${task.status}`);
    return res.json({ task });
  } catch (error) {
    console.error("[ProviderTasks] Error updating task:", error);
    return res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/:taskId", (req: Request, res: Response) => {
  try {
    const task = providerTasks.get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    providerTasks.delete(req.params.taskId);
    console.log(`[ProviderTasks] Task deleted: ${req.params.taskId}`);
    return res.json({ success: true });
  } catch (error) {
    console.error("[ProviderTasks] Error deleting task:", error);
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;

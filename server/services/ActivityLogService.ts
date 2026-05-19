import type { ActivityLevel, ActivityLogEntry } from "~/domain";

export interface ActivityLogInput {
  level: ActivityLevel;
  category: string;
  message: string;
  details?: string;
}

type ActivityListener = (entry: ActivityLogEntry) => void;

export class ActivityLogService {
  private readonly entries: ActivityLogEntry[] = [];
  private readonly listeners = new Set<ActivityListener>();
  private sequence = 0;

  constructor(private readonly maxEntries = 500) {}

  append(input: ActivityLogInput): ActivityLogEntry {
    const entry: ActivityLogEntry = {
      id: `${Date.now()}-${this.sequence += 1}`,
      timestamp: new Date().toISOString(),
      level: input.level,
      category: input.category,
      message: input.message,
      details: input.details,
    };

    this.entries.unshift(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }

    for (const listener of this.listeners) {
      listener(entry);
    }

    return entry;
  }

  list(limit = 200): ActivityLogEntry[] {
    return this.entries.slice(0, limit);
  }

  subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

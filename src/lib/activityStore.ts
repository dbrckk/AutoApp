export type ActivityEvent = {

id: string;

at: number;

type: "info" | "success" | "warning" | "error";

title: string;

message?: string;

};

const KEY = "autoapp.activity.v1";

export function readActivityEvents(): ActivityEvent[] {

try {

const raw = localStorage.getItem(KEY);

if (!raw) return [];

const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) return [];

return parsed.slice(0, 80);

} catch {

return [];

}

}

export function saveActivityEvents(events: ActivityEvent[]) {

try {

localStorage.setItem(KEY, JSON.stringify(events.slice(0, 80)));

return true;

} catch {

return false;

}

}

export function clearActivityStore() {

try {

localStorage.removeItem(KEY);

return true;

} catch {

return false;

}

}

export function createActivityEvent(input: {

type?: ActivityEvent["type"];

title: string;

message?: string;

}): ActivityEvent {

return {

id: crypto.randomUUID(),

at: Date.now(),

type: input.type || "info",

title: input.title,

message: input.message,

};

}

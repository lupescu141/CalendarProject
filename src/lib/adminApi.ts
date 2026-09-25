import Constants from "expo-constants";
import { Platform } from "react-native";

export interface UserRecord {
  id: number;
  firstname: string;
  surname: string;
  username: string;
  admin: boolean;
  facility: string;
  email: string;
}

export interface AssignmentInput {
  name: string;
  description: string;
  facility: string;
  end_date: string;
}

export interface AssignmentRecord {
  id: number;
  name: string;
  description: string;
  feedback: string | null;
  status: 0 | 1 | 2 | 3;
  facility: string;
  end_date: string;
  date_created: string;
  important: 0 | 1 | 2;
}

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  const debuggerHost = Constants.expoGoConfig?.debuggerHost;
  if (debuggerHost) {
    return `http://${debuggerHost.split(":")[0]}:3000`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return `http://${hostUri.split(":")[0]}:3000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(`Could not reach ${url}. Ensure npm run api is running and the device is on the same network.`);
  }
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `API request failed at ${url} with status ${response.status}`);
  }

  return body as T;
}

export function listUsers(): Promise<UserRecord[]> {
  return request<UserRecord[]>("/users");
}

export function listAssignments(facility: string): Promise<AssignmentRecord[]> {
  return request<AssignmentRecord[]>(`/assignments?facility=${encodeURIComponent(facility)}`);
}

export function updateAssignmentStatus(id: number, status: 0 | 1 | 2 | 3): Promise<AssignmentRecord> {
  return request<AssignmentRecord>(`/assignments/${id}/status`, {
    body: JSON.stringify({ status }),
    method: "PATCH",
  });
}

export function createAssignment(assignment: AssignmentInput) {
  return request("/assignments", {
    body: JSON.stringify(assignment),
    method: "POST",
  });
}

export function updateAssignmentFeedback(id: number, feedback: string): Promise<AssignmentRecord> {
  return request<AssignmentRecord>(`/assignments/${id}/feedback`, {
    body: JSON.stringify({ feedback }),
    method: "PATCH",
  });
}

export function updateAssignmentDetails(id: number, description: string, end_date: string): Promise<AssignmentRecord> {
  return request<AssignmentRecord>(`/assignments/${id}`, { body: JSON.stringify({ description, end_date }), method: "PATCH" });
}

export function notifyAssignment(id: number): Promise<AssignmentRecord> {
  return request<AssignmentRecord>(`/assignments/${id}/notify`, { method: "PATCH" });
}

export function acknowledgeAssignmentNotification(id: number): Promise<AssignmentRecord> {
  return request<AssignmentRecord>(`/assignments/${id}/acknowledge`, { method: "PATCH" });
}
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
  assigned_to_user_id: number;
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

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
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
  return apiRequest<UserRecord[]>("/users");
}

export function listAssignments(facility: string): Promise<AssignmentRecord[]> {
  return apiRequest<AssignmentRecord[]>(`/assignments?facility=${encodeURIComponent(facility)}`);
}

export function listUserAssignments(userId: number): Promise<AssignmentRecord[]> {
  return apiRequest<AssignmentRecord[]>(`/users/${userId}/assignments`);
}

export function listUserNotifications(userId: number): Promise<AssignmentRecord[]> {
  return apiRequest<AssignmentRecord[]>(`/users/${userId}/notifications`);
}

export function appendUserAssignmentMessage(userId: number, assignmentId: number, text: string): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/users/${userId}/assignments/${assignmentId}/messages`, {
    body: JSON.stringify({ text }),
    method: "POST",
  });
}

export function acknowledgeUserNotification(userId: number, assignmentId: number): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/users/${userId}/assignments/${assignmentId}/notification-seen`, {
    method: "PATCH",
  });
}

export function updateAssignmentStatus(id: number, status: 0 | 1 | 2 | 3): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/assignments/${id}/status`, {
    body: JSON.stringify({ status }),
    method: "PATCH",
  });
}

export function createAssignment(assignment: AssignmentInput) {
  return apiRequest("/assignments", {
    body: JSON.stringify(assignment),
    method: "POST",
  });
}

export function updateAssignmentFeedback(id: number, feedback: string): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/assignments/${id}/feedback`, {
    body: JSON.stringify({ feedback }),
    method: "PATCH",
  });
}

export function updateAssignmentDetails(id: number, description: string, end_date: string): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/assignments/${id}`, { body: JSON.stringify({ description, end_date }), method: "PATCH" });
}

export function notifyAssignment(id: number): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/assignments/${id}/notify`, { method: "PATCH" });
}

export function acknowledgeAssignmentNotification(id: number): Promise<AssignmentRecord> {
  return apiRequest<AssignmentRecord>(`/assignments/${id}/acknowledge`, { method: "PATCH" });
}

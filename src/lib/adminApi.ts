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
  user_id: number;
  facility: string;
  end_date: string;
}

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `API request failed with status ${response.status}`);
  }

  return body as T;
}

export function listUsers(): Promise<UserRecord[]> {
  return request<UserRecord[]>("/users");
}

export function createAssignment(assignment: AssignmentInput) {
  return request("/assignments", {
    body: JSON.stringify(assignment),
    method: "POST",
  });
}
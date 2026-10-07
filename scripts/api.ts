import { createServer } from "node:http";

import { acknowledgeAssignmentNotification, acknowledgeUserAssignmentNotification, appendUserAssignmentMessage, createAssignment, createAssignmentAttachment, createTables, getAssignmentAttachment, getAssignmentById, listAssignmentAttachments, listAssignments, listUserAssignments, listUserNotifications, listUsers, notifyAssignment, updateAssignmentDetails, updateAssignmentFeedback, updateAssignmentStatus, updateUserAssignmentStatus } from "../src/lib/mysql";
import { authenticateUser, createUser } from "../src/lib/passwordAuth";

const port = Number(process.env.API_PORT || 3000);
const maxAttachmentSize = 10 * 1024 * 1024;
const maxRequestSize = Math.ceil(maxAttachmentSize / 3) * 4 + 64 * 1024;

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request: import("node:http").IncomingMessage, maxBytes = maxRequestSize) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function attachmentPayload(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.filename !== "string" ||
    !body.filename.trim() ||
    body.filename.length > 255 ||
    typeof body.mime_type !== "string" ||
    body.mime_type.length > 150 ||
    (body.mime_type.trim() !== "" && !/^[\w.+-]+\/[\w.+-]+$/.test(body.mime_type.trim())) ||
    typeof body.base64 !== "string" ||
    !body.base64 ||
    (body.uploaded_by !== "ADMIN" && body.uploaded_by !== "USER")
  ) {
    return null;
  }

  const encodedFile = body.base64.replace(/^data:[^,]*;base64,/i, "");
  if (!encodedFile || !/^[A-Za-z0-9+/]*={0,2}$/.test(encodedFile)) return null;

  const fileData = Buffer.from(encodedFile, "base64");
  if (!fileData.length || fileData.length > maxAttachmentSize) return null;
  return {
    fileData,
    filename: body.filename.trim(),
    mimeType: body.mime_type.trim() || "application/octet-stream",
    uploadedBy: body.uploaded_by,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  try {
    if (request.method === "POST" && request.url === "/auth/sign-in") {
      const body = await readBody(request);
      if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email.trim() || !body.password) {
        sendJson(response, 400, { error: "email and password are required" });
        return;
      }

      const user = await authenticateUser(body.email.trim(), body.password);
      sendJson(response, user ? 200 : 401, user || { error: "Invalid email or password" });
      return;
    }

    if (request.method === "POST" && request.url === "/auth/sign-up") {
      const body = await readBody(request);
      const fields = [body.firstname, body.surname, body.username, body.password, body.facility, body.email];
      if (fields.some((value) => typeof value !== "string" || !value.trim()) || !/^\S+@\S+\.\S+$/.test(body.email)) {
        sendJson(response, 400, { error: "firstname, surname, username, password, facility, and a valid email are required" });
        return;
      }

      try {
        const user = await createUser({
          firstname: body.firstname.trim(),
          surname: body.surname.trim(),
          username: body.username.trim(),
          password: body.password,
          facility: body.facility.trim(),
          email: body.email.trim(),
          admin: false,
        });
        sendJson(response, 201, user);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ER_DUP_ENTRY") {
          sendJson(response, 409, { error: "That username or email is already registered" });
          return;
        }
        throw error;
      }
      return;
    }

    if (request.method === "GET" && request.url === "/users") {
      sendJson(response, 200, await listUsers());
      return;
    }

    const userAssignmentsMatch = request.url?.match(/^\/users\/(\d+)\/assignments$/);
    if (request.method === "GET" && userAssignmentsMatch) {
      sendJson(response, 200, await listUserAssignments(Number(userAssignmentsMatch[1])));
      return;
    }

    const userNotificationsMatch = request.url?.match(/^\/users\/(\d+)\/notifications$/);
    if (request.method === "GET" && userNotificationsMatch) {
      sendJson(response, 200, await listUserNotifications(Number(userNotificationsMatch[1])));
      return;
    }

    const userMessageMatch = request.url?.match(/^\/users\/(\d+)\/assignments\/(\d+)\/messages$/);
    if (request.method === "POST" && userMessageMatch) {
      const body = await readBody(request);
      if (typeof body.text !== "string" || !body.text.trim()) {
        sendJson(response, 400, { error: "message text is required" });
        return;
      }

      const assignment = await appendUserAssignmentMessage(
        Number(userMessageMatch[2]),
        Number(userMessageMatch[1]),
        body.text,
      );
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found for this user" });
      return;
    }

    const userAssignmentStatusMatch = request.url?.match(/^\/users\/(\d+)\/assignments\/(\d+)\/status$/);
    if (request.method === "PATCH" && userAssignmentStatusMatch) {
      const body = await readBody(request);
      if (!Number.isInteger(body.status) || body.status < 0 || body.status > 3) {
        sendJson(response, 400, { error: "status must be an integer from 0 to 3" });
        return;
      }

      const assignment = await updateUserAssignmentStatus(
        Number(userAssignmentStatusMatch[2]),
        Number(userAssignmentStatusMatch[1]),
        body.status,
      );
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found for this user" });
      return;
    }

    const userAttachmentMatch = request.url?.match(/^\/users\/(\d+)\/assignments\/(\d+)\/attachments(?:\/(\d+))?$/);
    if (userAttachmentMatch) {
      const userId = Number(userAttachmentMatch[1]);
      const assignmentId = Number(userAttachmentMatch[2]);
      const assignment = (await listUserAssignments(userId)).find((item) => item.id === assignmentId);
      if (!assignment) {
        sendJson(response, 404, { error: "Assignment not found for this user" });
        return;
      }
      const attachmentId = userAttachmentMatch[3] ? Number(userAttachmentMatch[3]) : null;

      if (request.method === "GET" && attachmentId === null) {
        sendJson(response, 200, await listAssignmentAttachments(assignmentId));
        return;
      }
      if (request.method === "GET" && attachmentId !== null) {
        const attachment = await getAssignmentAttachment(assignmentId, attachmentId);
        sendJson(response, attachment ? 200 : 404, attachment
          ? { ...attachment, file_data: undefined, base64: attachment.file_data.toString("base64") }
          : { error: "Attachment not found" });
        return;
      }
      if (request.method === "POST" && attachmentId === null) {
        const payload = attachmentPayload(await readBody(request));
        if (!payload || payload.uploadedBy !== "USER") {
          sendJson(response, 400, { error: "A valid user attachment under 10 MB is required" });
          return;
        }
        const attachment = await createAssignmentAttachment(assignmentId, payload.filename, payload.mimeType, "USER", payload.fileData);
        sendJson(response, attachment ? 201 : 500, attachment || { error: "Attachment could not be saved" });
        return;
      }
    }

    const userNotificationSeenMatch = request.url?.match(/^\/users\/(\d+)\/assignments\/(\d+)\/notification-seen$/);
    if (request.method === "PATCH" && userNotificationSeenMatch) {
      const assignment = await acknowledgeUserAssignmentNotification(
        Number(userNotificationSeenMatch[2]),
        Number(userNotificationSeenMatch[1]),
      );
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found for this user" });
      return;
    }

    if (request.method === "GET" && request.url?.startsWith("/assignments?")) {
      const facility = new URL(request.url, `http://localhost:${port}`).searchParams.get("facility");
      sendJson(response, 200, await listAssignments(facility || undefined));
      return;
    }

    const assignmentAttachmentMatch = request.url?.match(/^\/assignments\/(\d+)\/attachments(?:\/(\d+))?$/);
    if (assignmentAttachmentMatch) {
      const assignmentId = Number(assignmentAttachmentMatch[1]);
      if (!await getAssignmentById(assignmentId)) {
        sendJson(response, 404, { error: "Assignment not found" });
        return;
      }
      const attachmentId = assignmentAttachmentMatch[2] ? Number(assignmentAttachmentMatch[2]) : null;

      if (request.method === "GET" && attachmentId === null) {
        sendJson(response, 200, await listAssignmentAttachments(assignmentId));
        return;
      }
      if (request.method === "GET" && attachmentId !== null) {
        const attachment = await getAssignmentAttachment(assignmentId, attachmentId);
        sendJson(response, attachment ? 200 : 404, attachment
          ? { ...attachment, file_data: undefined, base64: attachment.file_data.toString("base64") }
          : { error: "Attachment not found" });
        return;
      }
      if (request.method === "POST" && attachmentId === null) {
        const payload = attachmentPayload(await readBody(request));
        if (!payload || payload.uploadedBy !== "ADMIN") {
          sendJson(response, 400, { error: "A valid admin attachment under 10 MB is required" });
          return;
        }
        const attachment = await createAssignmentAttachment(assignmentId, payload.filename, payload.mimeType, "ADMIN", payload.fileData);
        sendJson(response, attachment ? 201 : 500, attachment || { error: "Attachment could not be saved" });
        return;
      }
    }

    if (request.method === "POST" && request.url === "/assignments") {
      const assignment = await readBody(request);
      if (!assignment.name || !assignment.description || !assignment.facility || !assignment.end_date || !Number.isInteger(assignment.assigned_to_user_id)) {
        sendJson(response, 400, { error: "name, description, facility, end_date, and assigned_to_user_id are required" });
        return;
      }

      sendJson(response, 201, await createAssignment(assignment));
      return;
    }

    const statusMatch = request.url?.match(/^\/assignments\/(\d+)\/status$/);
    if (request.method === "PATCH" && statusMatch) {
      const body = await readBody(request);
      if (!Number.isInteger(body.status) || body.status < 0 || body.status > 3) {
        sendJson(response, 400, { error: "status must be an integer from 0 to 3" });
        return;
      }

      const assignment = await updateAssignmentStatus(Number(statusMatch[1]), body.status);
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found" });
      return;
    }

    const feedbackMatch = request.url?.match(/^\/assignments\/(\d+)\/feedback$/);
    if (request.method === "PATCH" && feedbackMatch) {
      const body = await readBody(request);
      if (typeof body.feedback !== "string" || !body.feedback.trim()) {
        sendJson(response, 400, { error: "feedback must be a non-empty string" });
        return;
      }

      const assignment = await updateAssignmentFeedback(Number(feedbackMatch[1]), body.feedback);
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found" });
      return;
    }

    const detailsMatch = request.url?.match(/^\/assignments\/(\d+)$/);
    if (request.method === "PATCH" && detailsMatch) {
      const body = await readBody(request);
      if (typeof body.description !== "string" || !body.description.trim() || typeof body.end_date !== "string" || !/^\d{4}-\d{2}-\d{2} 23:59:59$/.test(body.end_date)) {
        sendJson(response, 400, { error: "description and end_date are required" });
        return;
      }
      const assignment = await updateAssignmentDetails(Number(detailsMatch[1]), body.description.trim(), body.end_date);
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found" });
      return;
    }

    const notifyMatch = request.url?.match(/^\/assignments\/(\d+)\/notify$/);
    if (request.method === "PATCH" && notifyMatch) {
      const assignment = await notifyAssignment(Number(notifyMatch[1]));
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found" });
      return;
    }

    const acknowledgeMatch = request.url?.match(/^\/assignments\/(\d+)\/acknowledge$/);
    if (request.method === "PATCH" && acknowledgeMatch) {
      const assignment = await acknowledgeAssignmentNotification(Number(acknowledgeMatch[1]));
      sendJson(response, assignment ? 200 : 404, assignment || { error: "Assignment not found" });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, error instanceof Error && error.message === "Request body is too large" ? 413 : 500, {
      error: error instanceof Error && error.message === "Request body is too large"
        ? "Request body exceeds the 10 MB attachment limit"
        : "The database request failed",
    });
  }
});

createTables()
  .then(() => server.listen(port, "0.0.0.0", () => console.log(`API listening on http://0.0.0.0:${port}`)))
  .catch((error) => {
    console.error("Could not initialize the database:", error);
    process.exitCode = 1;
  });
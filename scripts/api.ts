import { createServer } from "node:http";

import { acknowledgeAssignmentNotification, createAssignment, createTables, listAssignments, listUsers, notifyAssignment, updateAssignmentDetails, updateAssignmentFeedback, updateAssignmentStatus } from "../src/lib/mysql";

const port = Number(process.env.API_PORT || 3000);

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/users") {
      sendJson(response, 200, await listUsers());
      return;
    }

    if (request.method === "GET" && request.url?.startsWith("/assignments?")) {
      const facility = new URL(request.url, `http://localhost:${port}`).searchParams.get("facility");
      sendJson(response, 200, await listAssignments(facility || undefined));
      return;
    }

    if (request.method === "POST" && request.url === "/assignments") {
      const assignment = await readBody(request);
      if (!assignment.name || !assignment.description || !assignment.facility || !assignment.end_date) {
        sendJson(response, 400, { error: "name, description, facility, and end_date are required" });
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
    sendJson(response, 500, { error: "The database request failed" });
  }
});

createTables()
  .then(() => server.listen(port, "0.0.0.0", () => console.log(`API listening on http://0.0.0.0:${port}`)))
  .catch((error) => {
    console.error("Could not initialize the database:", error);
    process.exitCode = 1;
  });
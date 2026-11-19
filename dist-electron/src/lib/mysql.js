"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.facilities = exports.assignments = exports.users = void 0;
exports.getPool = getPool;
exports.closeDatabase = closeDatabase;
exports.testConnection = testConnection;
exports.createTables = createTables;
exports.listUsers = listUsers;
exports.getUserById = getUserById;
exports.getUserByUsername = getUserByUsername;
exports.getUserByEmail = getUserByEmail;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.listAssignments = listAssignments;
exports.listUserAssignments = listUserAssignments;
exports.listUserNotifications = listUserNotifications;
exports.getAssignmentById = getAssignmentById;
exports.createAssignment = createAssignment;
exports.updateAssignment = updateAssignment;
exports.updateAssignmentStatus = updateAssignmentStatus;
exports.updateUserAssignmentStatus = updateUserAssignmentStatus;
exports.listAssignmentAttachments = listAssignmentAttachments;
exports.getAssignmentAttachment = getAssignmentAttachment;
exports.createAssignmentAttachment = createAssignmentAttachment;
exports.updateAssignmentFeedback = updateAssignmentFeedback;
exports.appendUserAssignmentMessage = appendUserAssignmentMessage;
exports.updateAssignmentDetails = updateAssignmentDetails;
exports.notifyAssignment = notifyAssignment;
exports.acknowledgeAssignmentNotification = acknowledgeAssignmentNotification;
exports.acknowledgeUserAssignmentNotification = acknowledgeUserAssignmentNotification;
exports.deleteAssignment = deleteAssignment;
exports.listFacilities = listFacilities;
exports.getFacilityById = getFacilityById;
exports.createFacility = createFacility;
exports.updateFacility = updateFacility;
exports.deleteFacility = deleteFacility;
const promise_1 = __importDefault(require("mysql2/promise"));
let pool;
function getPool() {
    if (!pool) {
        pool = promise_1.default.createPool({
            host: process.env.MYSQL_HOST || "db80761.public.databaseasp.net",
            port: Number(process.env.MYSQL_PORT || 3306),
            user: process.env.MYSQL_USER || "db80761",
            password: process.env.MYSQL_PASSWORD || "Ez3@7M?sG=p2",
            database: process.env.MYSQL_DATABASE || "db80761",
            waitForConnections: true,
            connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
            dateStrings: true,
        });
    }
    return pool;
}
async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = undefined;
    }
}
async function testConnection() {
    const connection = await getPool().getConnection();
    connection.release();
    return true;
}
async function createTables() {
    const database = getPool();
    await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      firstname VARCHAR(100) NOT NULL,
      surname VARCHAR(100) NOT NULL,
      password VARCHAR(255) NOT NULL,
      username VARCHAR(100) NOT NULL,
      admin BOOLEAN NOT NULL DEFAULT FALSE,
      facility VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username),
      UNIQUE KEY uq_users_email (email)
    )
  `);
    await database.execute(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      feedback TEXT,
      status INT NOT NULL DEFAULT 0,
      facility VARCHAR(150) NOT NULL,
      end_date DATETIME NOT NULL,
      date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      important TINYINT NOT NULL DEFAULT 0,
      assigned_to_user_id INT NULL,
      PRIMARY KEY (id)
    )
  `);
    await database.execute("ALTER TABLE assignments MODIFY important TINYINT NOT NULL DEFAULT 0");
    try {
        await database.execute("ALTER TABLE assignments ADD COLUMN assigned_to_user_id INT NULL");
    }
    catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME")
            throw error;
    }
    await database.execute(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )
  `);
    await database.execute(`
    CREATE TABLE IF NOT EXISTS assignment_attachments (
      id INT NOT NULL AUTO_INCREMENT,
      assignment_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(150) NOT NULL,
      file_size BIGINT NOT NULL,
      uploaded_by VARCHAR(20) NOT NULL,
      file_data LONGBLOB NOT NULL,
      date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_assignment_attachments_assignment (assignment_id)
    )
  `);
}
async function listUsers() {
    const [rows] = await getPool().execute("SELECT id, firstname, surname, username, admin, facility, email FROM users ORDER BY id DESC");
    return rows;
}
async function getUserById(id) {
    const [rows] = await getPool().execute("SELECT id, firstname, surname, username, admin, facility, email FROM users WHERE id = ?", [id]);
    const users = rows;
    return users[0] ?? null;
}
async function getUserByUsername(username) {
    const [rows] = await getPool().execute("SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE username = ?", [username]);
    const users = rows;
    return users[0] ?? null;
}
async function getUserByEmail(email) {
    const [rows] = await getPool().execute("SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE email = ?", [email]);
    const users = rows;
    return users[0] ?? null;
}
async function createUser(user) {
    const [result] = await getPool().execute(`INSERT INTO users
      (firstname, surname, password, username, admin, facility, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        user.firstname,
        user.surname,
        user.password,
        user.username,
        user.admin ?? false,
        user.facility,
        user.email,
    ]);
    return getUserById(result.insertId);
}
async function updateUser(id, user) {
    const [result] = await getPool().execute(`UPDATE users
      SET firstname = ?, surname = ?, password = ?, username = ?,
          admin = ?, facility = ?, email = ?
      WHERE id = ?`, [
        user.firstname,
        user.surname,
        user.password,
        user.username,
        user.admin ?? false,
        user.facility,
        user.email,
        id,
    ]);
    return result.affectedRows > 0 ? getUserById(id) : null;
}
async function deleteUser(id) {
    const [result] = await getPool().execute("DELETE FROM users WHERE id = ?", [id]);
    return result.affectedRows > 0;
}
async function listAssignments(facility) {
    const query = facility
        ? "SELECT * FROM assignments WHERE facility = ? ORDER BY end_date ASC"
        : "SELECT * FROM assignments ORDER BY end_date ASC";
    const [rows] = await getPool().execute(query, facility ? [facility] : []);
    return rows;
}
async function listUserAssignments(userId) {
    const [rows] = await getPool().execute("SELECT * FROM assignments WHERE assigned_to_user_id = ? ORDER BY end_date ASC", [userId]);
    return rows;
}
async function listUserNotifications(userId) {
    const [rows] = await getPool().execute("SELECT * FROM assignments WHERE assigned_to_user_id = ? AND important = 1 ORDER BY end_date ASC", [userId]);
    return rows;
}
async function getAssignmentById(id) {
    const [rows] = await getPool().execute("SELECT * FROM assignments WHERE id = ?", [id]);
    const assignments = rows;
    return assignments[0] ?? null;
}
async function createAssignment(assignment) {
    const [result] = await getPool().execute(`INSERT INTO assignments
      (name, description, feedback, status, facility, end_date, important, assigned_to_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        assignment.name,
        assignment.description,
        assignment.feedback ?? null,
        assignment.status ?? 0,
        assignment.facility,
        assignment.end_date,
        assignment.important ?? false,
        assignment.assigned_to_user_id,
    ]);
    return getAssignmentById(result.insertId);
}
async function updateAssignment(id, assignment) {
    const [result] = await getPool().execute(`UPDATE assignments
      SET name = ?, description = ?, feedback = ?, status = ?,
          facility = ?, end_date = ?, important = ?
      WHERE id = ?`, [
        assignment.name,
        assignment.description,
        assignment.feedback ?? null,
        assignment.status ?? 0,
        assignment.facility,
        assignment.end_date,
        assignment.important ?? false,
        id,
    ]);
    return result.affectedRows > 0 ? getAssignmentById(id) : null;
}
async function updateAssignmentStatus(id, status) {
    if (!Number.isInteger(status) || status < 0 || status > 3) {
        throw new Error("Assignment status must be an integer from 0 to 3");
    }
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment) {
        return null;
    }
    await getPool().execute("UPDATE assignments SET status = ? WHERE id = ?", [
        status,
        id,
    ]);
    return getAssignmentById(id);
}
async function updateUserAssignmentStatus(id, userId, status) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment || existingAssignment.assigned_to_user_id !== userId)
        return null;
    return updateAssignmentStatus(id, status);
}
async function listAssignmentAttachments(assignmentId) {
    const [rows] = await getPool().execute(`SELECT id, assignment_id, filename, mime_type, file_size, uploaded_by, date_created
      FROM assignment_attachments WHERE assignment_id = ? ORDER BY date_created ASC, id ASC`, [assignmentId]);
    return rows;
}
async function getAssignmentAttachment(assignmentId, attachmentId) {
    const [rows] = await getPool().execute(`SELECT id, assignment_id, filename, mime_type, file_size, uploaded_by, date_created, file_data
      FROM assignment_attachments WHERE assignment_id = ? AND id = ?`, [assignmentId, attachmentId]);
    return rows[0] ?? null;
}
async function createAssignmentAttachment(assignmentId, filename, mimeType, uploadedBy, fileData) {
    const [result] = await getPool().execute(`INSERT INTO assignment_attachments
      (assignment_id, filename, mime_type, file_size, uploaded_by, file_data)
      VALUES (?, ?, ?, ?, ?, ?)`, [assignmentId, filename, mimeType, fileData.length, uploadedBy, fileData]);
    const [rows] = await getPool().execute(`SELECT id, assignment_id, filename, mime_type, file_size, uploaded_by, date_created
      FROM assignment_attachments WHERE id = ?`, [result.insertId]);
    return rows[0] ?? null;
}
async function updateAssignmentFeedback(id, feedback) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment) {
        return null;
    }
    await getPool().execute("UPDATE assignments SET feedback = ? WHERE id = ?", [
        feedback,
        id,
    ]);
    return getAssignmentById(id);
}
async function appendUserAssignmentMessage(id, userId, message) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment || existingAssignment.assigned_to_user_id !== userId)
        return null;
    const formattedMessage = `<#USER#>${message.trim()}<(#USER#)>`;
    await getPool().execute(`UPDATE assignments
      SET feedback = CONCAT(COALESCE(NULLIF(feedback, ''), ''),
        CASE WHEN feedback IS NULL OR feedback = '' THEN '' ELSE '\\n' END, ?)
      WHERE id = ? AND assigned_to_user_id = ?`, [formattedMessage, id, userId]);
    return getAssignmentById(id);
}
async function updateAssignmentDetails(id, description, endDate) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment)
        return null;
    await getPool().execute("UPDATE assignments SET description = ?, end_date = ? WHERE id = ?", [description, endDate, id]);
    return getAssignmentById(id);
}
async function notifyAssignment(id) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment)
        return null;
    const notification = "<#NOTIFICATION#>Notification waiting for response<(#NOTIFICATION#)>";
    const feedback = existingAssignment.feedback?.trim();
    const nextFeedback = feedback?.includes(notification)
        ? feedback
        : `${feedback ? `${feedback}\n` : ""}${notification}`;
    await getPool().execute("UPDATE assignments SET feedback = ?, important = 1 WHERE id = ?", [nextFeedback, id]);
    return getAssignmentById(id);
}
async function acknowledgeAssignmentNotification(id) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment)
        return null;
    const feedback = existingAssignment.feedback?.replace(/<#NOTIFICATION#>Notification waiting for response<\(#NOTIFICATION#\)>/g, "<#NOTIFICATION#>Notification received<(#NOTIFICATION#)>");
    await getPool().execute("UPDATE assignments SET feedback = ?, important = 0 WHERE id = ?", [feedback ?? null, id]);
    return getAssignmentById(id);
}
async function acknowledgeUserAssignmentNotification(id, userId) {
    const existingAssignment = await getAssignmentById(id);
    if (!existingAssignment || existingAssignment.assigned_to_user_id !== userId)
        return null;
    await getPool().execute(`UPDATE assignments
      SET feedback = REPLACE(COALESCE(feedback, ''),
        '<#NOTIFICATION#>Notification waiting for response<(#NOTIFICATION#)>',
        '<#NOTIFICATION#>Notification received<(#NOTIFICATION#)>'), important = 0
      WHERE id = ? AND assigned_to_user_id = ?`, [id, userId]);
    return getAssignmentById(id);
}
async function deleteAssignment(id) {
    const [result] = await getPool().execute("DELETE FROM assignments WHERE id = ?", [id]);
    return result.affectedRows > 0;
}
async function listFacilities() {
    const [rows] = await getPool().execute("SELECT id, name, location FROM facilities ORDER BY name ASC");
    return rows;
}
async function getFacilityById(id) {
    const [rows] = await getPool().execute("SELECT id, name, location FROM facilities WHERE id = ?", [id]);
    const facilities = rows;
    return facilities[0] ?? null;
}
async function createFacility(facility) {
    const [result] = await getPool().execute("INSERT INTO facilities (name, location) VALUES (?, ?)", [facility.name, facility.location]);
    return getFacilityById(result.insertId);
}
async function updateFacility(id, facility) {
    const [result] = await getPool().execute("UPDATE facilities SET name = ?, location = ? WHERE id = ?", [facility.name, facility.location, id]);
    return result.affectedRows > 0 ? getFacilityById(id) : null;
}
async function deleteFacility(id) {
    const [result] = await getPool().execute("DELETE FROM facilities WHERE id = ?", [id]);
    return result.affectedRows > 0;
}
exports.users = {
    list: listUsers,
    getById: getUserById,
    getByUsername: getUserByUsername,
    getByEmail: getUserByEmail,
    create: createUser,
    update: updateUser,
    remove: deleteUser,
};
exports.assignments = {
    list: listAssignments,
    getById: getAssignmentById,
    create: createAssignment,
    update: updateAssignment,
    updateStatus: updateAssignmentStatus,
    updateFeedback: updateAssignmentFeedback,
    remove: deleteAssignment,
};
exports.facilities = {
    list: listFacilities,
    getById: getFacilityById,
    create: createFacility,
    update: updateFacility,
    remove: deleteFacility,
};

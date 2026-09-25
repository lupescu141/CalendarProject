import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export interface UserRecord extends RowDataPacket {
  id: number;
  firstname: string;
  surname: string;
  username: string;
  admin: boolean;
  facility: string;
  email: string;
  password?: string;
}

export interface AssignmentRecord extends RowDataPacket {
  id: number;
  name: string;
  description: string;
  feedback: string | null;
  status: number;
  facility: string;
  end_date: string;
  date_created: string;
  important: 0 | 1 | 2;
}

export interface FacilityRecord extends RowDataPacket {
  id: number;
  name: string;
  location: string;
}

export interface UserInput {
  firstname: string;
  surname: string;
  password: string;
  username: string;
  admin?: boolean;
  facility: string;
  email: string;
}

export interface AssignmentInput {
  name: string;
  description: string;
  feedback?: string | null;
  status?: number;
  facility: string;
  end_date: string;
  important?: 0 | 1 | 2;
}

export interface FacilityInput {
  name: string;
  location: string;
}

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "Qwerty",
      database: process.env.MYSQL_DATABASE || "Calendar",
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      dateStrings: true,
    });
  }

  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function testConnection(): Promise<boolean> {
  const connection = await getPool().getConnection();
  connection.release();
  return true;
}

export async function createTables(): Promise<void> {
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
      PRIMARY KEY (id)
    )
  `);

  await database.execute("ALTER TABLE assignments MODIFY important TINYINT NOT NULL DEFAULT 0");

  await database.execute(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )
  `);
}

export async function listUsers(): Promise<UserRecord[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, firstname, surname, username, admin, facility, email FROM users ORDER BY id DESC",
  );

  return rows as UserRecord[];
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE id = ?",
    [id],
  );

  const users = rows as UserRecord[];
  return users[0] ?? null;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE username = ?",
    [username],
  );

  const users = rows as UserRecord[];
  return users[0] ?? null;
}

export async function createUser(user: UserInput): Promise<UserRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users
      (firstname, surname, password, username, admin, facility, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.firstname,
      user.surname,
      user.password,
      user.username,
      user.admin ?? false,
      user.facility,
      user.email,
    ],
  );

  return getUserById(result.insertId);
}

export async function updateUser(id: number, user: UserInput): Promise<UserRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE users
      SET firstname = ?, surname = ?, password = ?, username = ?,
          admin = ?, facility = ?, email = ?
      WHERE id = ?`,
    [
      user.firstname,
      user.surname,
      user.password,
      user.username,
      user.admin ?? false,
      user.facility,
      user.email,
      id,
    ],
  );

  return result.affectedRows > 0 ? getUserById(id) : null;
}

export async function deleteUser(id: number): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM users WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

export async function listAssignments(facility?: string): Promise<AssignmentRecord[]> {
  const query = facility
    ? "SELECT * FROM assignments WHERE facility = ? ORDER BY end_date ASC"
    : "SELECT * FROM assignments ORDER BY end_date ASC";

  const [rows] = await getPool().execute<RowDataPacket[]>(query, facility ? [facility] : []);
  return rows as AssignmentRecord[];
}

export async function getAssignmentById(id: number): Promise<AssignmentRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT * FROM assignments WHERE id = ?",
    [id],
  );

  const assignments = rows as AssignmentRecord[];
  return assignments[0] ?? null;
}

export async function createAssignment(assignment: AssignmentInput): Promise<AssignmentRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO assignments
      (name, description, feedback, status, facility, end_date, important)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      assignment.name,
      assignment.description,
      assignment.feedback ?? null,
      assignment.status ?? 0,
      assignment.facility,
      assignment.end_date,
      assignment.important ?? false,
    ],
  );

  return getAssignmentById(result.insertId);
}

export async function updateAssignment(
  id: number,
  assignment: AssignmentInput,
): Promise<AssignmentRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE assignments
      SET name = ?, description = ?, feedback = ?, status = ?,
          facility = ?, end_date = ?, important = ?
      WHERE id = ?`,
    [
      assignment.name,
      assignment.description,
      assignment.feedback ?? null,
      assignment.status ?? 0,
      assignment.facility,
      assignment.end_date,
      assignment.important ?? false,
      id,
    ],
  );

  return result.affectedRows > 0 ? getAssignmentById(id) : null;
}

export async function updateAssignmentStatus(id: number, status: number): Promise<AssignmentRecord | null> {
  if (!Number.isInteger(status) || status < 0 || status > 3) {
    throw new Error("Assignment status must be an integer from 0 to 3");
  }

  const existingAssignment = await getAssignmentById(id);
  if (!existingAssignment) {
    return null;
  }

  await getPool().execute(
    "UPDATE assignments SET status = ? WHERE id = ?",
    [status, id],
  );

  return getAssignmentById(id);
}

export async function updateAssignmentFeedback(id: number, feedback: string): Promise<AssignmentRecord | null> {
  const existingAssignment = await getAssignmentById(id);
  if (!existingAssignment) {
    return null;
  }

  await getPool().execute(
    "UPDATE assignments SET feedback = ? WHERE id = ?",
    [feedback, id],
  );

  return getAssignmentById(id);
}

export async function updateAssignmentDetails(id: number, description: string, endDate: string): Promise<AssignmentRecord | null> {
  const existingAssignment = await getAssignmentById(id);
  if (!existingAssignment) return null;
  await getPool().execute("UPDATE assignments SET description = ?, end_date = ? WHERE id = ?", [description, endDate, id]);
  return getAssignmentById(id);
}

export async function notifyAssignment(id: number): Promise<AssignmentRecord | null> {
  const existingAssignment = await getAssignmentById(id);
  if (!existingAssignment) return null;
  const notification = "<#NOTIFICATION#>Notification waiting for response<(#NOTIFICATION#)>";
  const feedback = existingAssignment.feedback?.trim();
  const nextFeedback = feedback?.includes(notification) ? feedback : `${feedback ? `${feedback}\n` : ""}${notification}`;
  await getPool().execute("UPDATE assignments SET feedback = ?, important = 1 WHERE id = ?", [nextFeedback, id]);
  return getAssignmentById(id);
}

export async function acknowledgeAssignmentNotification(id: number): Promise<AssignmentRecord | null> {
  const existingAssignment = await getAssignmentById(id);
  if (!existingAssignment) return null;
  const feedback = existingAssignment.feedback?.replace(
    /<#NOTIFICATION#>Notification waiting for response<\(#NOTIFICATION#\)>/g,
    "<#NOTIFICATION#>Notification received<(#NOTIFICATION#)>",
  );
  await getPool().execute("UPDATE assignments SET feedback = ?, important = 0 WHERE id = ?", [feedback ?? null, id]);
  return getAssignmentById(id);
}

export async function deleteAssignment(id: number): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM assignments WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

export async function listFacilities(): Promise<FacilityRecord[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, location FROM facilities ORDER BY name ASC",
  );

  return rows as FacilityRecord[];
}

export async function getFacilityById(id: number): Promise<FacilityRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, location FROM facilities WHERE id = ?",
    [id],
  );

  const facilities = rows as FacilityRecord[];
  return facilities[0] ?? null;
}

export async function createFacility(facility: FacilityInput): Promise<FacilityRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "INSERT INTO facilities (name, location) VALUES (?, ?)",
    [facility.name, facility.location],
  );

  return getFacilityById(result.insertId);
}

export async function updateFacility(
  id: number,
  facility: FacilityInput,
): Promise<FacilityRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "UPDATE facilities SET name = ?, location = ? WHERE id = ?",
    [facility.name, facility.location, id],
  );

  return result.affectedRows > 0 ? getFacilityById(id) : null;
}

export async function deleteFacility(id: number): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM facilities WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

export const users = {
  list: listUsers,
  getById: getUserById,
  getByUsername: getUserByUsername,
  create: createUser,
  update: updateUser,
  remove: deleteUser,
};

export const assignments = {
  list: listAssignments,
  getById: getAssignmentById,
  create: createAssignment,
  update: updateAssignment,
  updateStatus: updateAssignmentStatus,
  updateFeedback: updateAssignmentFeedback,
  remove: deleteAssignment,
};

export const facilities = {
  list: listFacilities,
  getById: getFacilityById,
  create: createFacility,
  update: updateFacility,
  remove: deleteFacility,
};

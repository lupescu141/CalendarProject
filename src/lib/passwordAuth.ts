import crypto, { type ScryptOptions } from "node:crypto";

import * as database from "./mysql";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

const SCRYPT_OPTIONS: ScryptOptions = {
  N: 1 << 15,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function scryptAsync(
  password: string | Buffer,
  salt: string | Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });
}

export interface StoredPasswordParts {
  salt: Buffer;
  key: Buffer;
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Invalid password");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);

  return [
    "scrypt",
    "v=1",
    `N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p}`,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export function parseStoredPassword(value: string | null | undefined): StoredPasswordParts | null {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split("$");
  if (parts.length !== 5) {
    return null;
  }

  const [algorithm, version, parameters, saltHex, keyHex] = parts;

  if (algorithm !== "scrypt" || version !== "v=1") {
    return null;
  }

  if (parameters !== "N=32768,r=8,p=1") {
    return null;
  }

  if (!/^[0-9a-fA-F]+$/.test(saltHex) || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    return null;
  }

  if (saltHex.length !== SALT_LENGTH * 2 || keyHex.length !== KEY_LENGTH * 2) {
    return null;
  }

  return {
    salt: Buffer.from(saltHex, "hex"),
    key: Buffer.from(keyHex, "hex"),
  };
}

export async function verifyPassword(
  password: string,
  storedPassword: string | null | undefined,
): Promise<boolean> {
  const parsed = parseStoredPassword(storedPassword);
  if (!parsed) {
    return false;
  }

  const derivedKey = await scryptAsync(password, parsed.salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return crypto.timingSafeEqual(parsed.key, derivedKey);
}

export async function createUser(user: database.UserInput): Promise<database.UserRecord | null> {
  const password = await hashPassword(user.password);

  return database.users.create({
    ...user,
    password,
  });
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<Omit<database.UserRecord, "password"> | null> {
  const user = await database.users.getByUsername(username);

  if (!user || !(await verifyPassword(password, user.password ?? null))) {
    return null;
  }

  const { password: storedPassword, ...publicUser } = user;
  void storedPassword;

  return publicUser;
}

export default {
  hashPassword,
  parseStoredPassword,
  verifyPassword,
  createUser,
  authenticateUser,
};

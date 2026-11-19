"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.parseStoredPassword = parseStoredPassword;
exports.verifyPassword = verifyPassword;
exports.createUser = createUser;
exports.authenticateUser = authenticateUser;
const node_crypto_1 = __importDefault(require("node:crypto"));
const database = __importStar(require("./mysql"));
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
    N: 1 << 15,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
};
function scryptAsync(password, salt, keyLength, options) {
    return new Promise((resolve, reject) => {
        node_crypto_1.default.scrypt(password, salt, keyLength, options, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(Buffer.from(derivedKey));
        });
    });
}
async function hashPassword(password) {
    if (typeof password !== "string" || password.length === 0) {
        throw new Error("Invalid password");
    }
    const salt = node_crypto_1.default.randomBytes(SALT_LENGTH);
    const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return [
        "scrypt",
        "v=1",
        `N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p}`,
        salt.toString("hex"),
        derivedKey.toString("hex"),
    ].join("$");
}
function parseStoredPassword(value) {
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
async function verifyPassword(password, storedPassword) {
    const parsed = parseStoredPassword(storedPassword);
    if (!parsed) {
        return false;
    }
    const derivedKey = await scryptAsync(password, parsed.salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return node_crypto_1.default.timingSafeEqual(parsed.key, derivedKey);
}
async function createUser(user) {
    const password = await hashPassword(user.password);
    return database.users.create({
        ...user,
        password,
    });
}
async function authenticateUser(email, password) {
    const user = await database.users.getByEmail(email);
    if (!user || !(await verifyPassword(password, user.password ?? null))) {
        return null;
    }
    const { password: storedPassword, ...publicUser } = user;
    void storedPassword;
    return publicUser;
}
exports.default = {
    hashPassword,
    parseStoredPassword,
    verifyPassword,
    createUser,
    authenticateUser,
};

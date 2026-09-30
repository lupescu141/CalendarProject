import { createContext, use, type PropsWithChildren } from "react";

import type { UserRecord } from "./lib/adminApi";
import { signIn as authenticate, type SignInCredentials } from "./lib/auth";
import { useStorageState } from "./useStorageState";

const AuthContext = createContext<{
  signIn: (credentials: SignInCredentials) => Promise<UserRecord>;
  signOut: () => void;
  currentUser: UserRecord | null;
  session?: string | null;
  isLoading: boolean;
} | null>(null);

function getSessionUser(session: string | null): UserRecord | null {
  if (!session) return null;

  try {
    const user: unknown = JSON.parse(session);
    if (typeof user === "object" && user !== null && "id" in user && typeof user.id === "number") {
      return user as UserRecord;
    }
  } catch {
    return null;
  }

  return null;
}

// Use this hook to access the user info.
export function useSession() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useSession must be wrapped in a <SessionProvider />");
  }

  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState("session");
  const currentUser = getSessionUser(session);

  return (
    <AuthContext.Provider
      value={{
        signIn: async (credentials) => {
          const user = await authenticate(credentials);
          setSession(JSON.stringify(user));
          return user;
        },
        signOut: () => {
          setSession(null);
        },
        currentUser,
        session,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

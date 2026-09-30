import { apiRequest, type UserRecord } from "./adminApi";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpDetails extends SignInCredentials {
  firstname: string;
  surname: string;
  username: string;
  facility: string;
}

export async function signIn(credentials: SignInCredentials): Promise<UserRecord> {
  const email = credentials.email.trim();
  if (!email || !credentials.password) {
    throw new Error("Email and password are required");
  }

  return apiRequest<UserRecord>("/auth/sign-in", {
    body: JSON.stringify({ email, password: credentials.password }),
    method: "POST",
  });
}

export async function signUp(details: SignUpDetails): Promise<UserRecord> {
  const firstname = details.firstname.trim();
  const surname = details.surname.trim();
  const username = details.username.trim();
  const facility = details.facility.trim();
  const email = details.email.trim();

  if (!firstname || !surname || !username || !facility || !email || !details.password) {
    throw new Error("All sign-up fields are required");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }

  return apiRequest<UserRecord>("/auth/sign-up", {
    body: JSON.stringify({ firstname, surname, username, facility, email, password: details.password }),
    method: "POST",
  });
}

export default { signIn, signUp };
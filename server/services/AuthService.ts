import type { AuthStatus } from "~/domain";

export class AuthService {
  validate(username: string, password: string): AuthStatus | undefined {
    const expectedUsername = process.env.APP_USERNAME;
    const expectedPassword = process.env.APP_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
      return undefined;
    }

    if (username === expectedUsername && password === expectedPassword) {
      return { authenticated: true, username };
    }

    return undefined;
  }
}

export type PasswordHasher = Readonly<{
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}>;

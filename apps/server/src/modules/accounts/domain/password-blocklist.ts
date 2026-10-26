// Minimal offline baseline; deployments can extend it with a reviewed local breached-password list.
const blocked = new Set([
  'passwordpassword',
  'passwordpassword1',
  'password123456789',
  '123456789012345',
  '1234567890123456',
  '12345678901234567890',
  'qwertyuiopasdfgh',
  'qwertyuiopasdfghjkl',
  'letmeinletmein123',
  'correcthorsebatterystaple',
  'iloveyouiloveyou',
  'adminadminadmin',
  'aaaaaaaaaaaaaaa',
  '111111111111111',
  '000000000000000',
  'abcdefghijklmnop',
]);

export function isCommonPassword(password: string): boolean {
  return blocked.has(password.toLowerCase());
}

import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const load = (path: string) => Bun.file(resolve(root, path));

type Rule = {
  type: string;
  parameters?: {
    require_code_owner_review?: boolean;
    dismiss_stale_reviews_on_push?: boolean;
    required_approving_review_count?: number;
    required_review_thread_resolution?: boolean;
    strict_required_status_checks_policy?: boolean;
    required_status_checks?: { context: string; integration_id: number }[];
  };
};
type Policy = {
  target: string;
  enforcement: string;
  conditions: { ref_name: { include: string[]; exclude: string[] } };
  bypass_actors: { actor_id: number; actor_type: string; bypass_mode: string }[];
  rules: Rule[];
};

test('owner exception applies only to review and cannot bypass branch integrity or CI', async () => {
  const review: Policy = await load('.github/rulesets/codeowner-review.json').json();
  const integrity: Policy = await load('.github/rulesets/main-integrity.json').json();

  for (const policy of [review, integrity]) {
    expect(policy.target).toBe('branch');
    expect(policy.enforcement).toBe('active');
    expect(policy.conditions.ref_name).toEqual({ include: ['~DEFAULT_BRANCH'], exclude: [] });
  }

  expect(review.bypass_actors).toEqual([
    { actor_id: 61637710, actor_type: 'User', bypass_mode: 'pull_request' },
  ]);
  expect(review.rules.map((rule) => rule.type)).toEqual(['pull_request']);
  expect(review.rules[0]?.parameters).toMatchObject({
    require_code_owner_review: true,
    dismiss_stale_reviews_on_push: true,
    required_approving_review_count: 1,
  });
  expect(integrity.bypass_actors).toEqual([]);
  for (const required of ['deletion', 'non_fast_forward', 'required_status_checks'])
    expect(integrity.rules.some((rule) => rule.type === required)).toBe(true);
  expect(integrity.rules.find((rule) => rule.type === 'pull_request')?.parameters).toMatchObject({
    required_review_thread_resolution: true,
    required_approving_review_count: 0,
  });
});

test('required checks match the actual CI jobs and untrusted PRs receive read-only permissions', async () => {
  const policy: Policy = await load('.github/rulesets/main-integrity.json').json();
  const ci = Bun.YAML.parse(await load('.github/workflows/ci.yml').text()) as {
    on: { push: { branches: string[] }; pull_request: unknown; pull_request_target?: unknown };
    permissions: Record<string, string>;
    jobs: { verify: unknown; browser: { strategy: { matrix: { project: string[] } } } };
  };
  const status = policy.rules.find((rule) => rule.type === 'required_status_checks')?.parameters;

  expect(ci.permissions).toEqual({ contents: 'read' });
  expect(Object.hasOwn(ci.on, 'pull_request')).toBe(true);
  expect(Object.hasOwn(ci.on, 'pull_request_target')).toBe(false);
  expect(ci.on.push.branches).toEqual(['main']);
  expect(ci.jobs.verify).toBeDefined();
  expect(status?.strict_required_status_checks_policy).toBe(true);
  expect(status?.required_status_checks).toEqual([
    { context: 'verify', integration_id: 15368 },
    ...ci.jobs.browser.strategy.matrix.project.map((project) => ({
      context: `browser (${project})`,
      integration_id: 15368,
    })),
  ]);
});

test('every path including governance is owned by the configured maintainer', async () => {
  const owners = (await load('.github/CODEOWNERS').text())
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  expect(owners).toEqual(['* @jaovito']);
});

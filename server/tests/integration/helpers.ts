import request from 'supertest';
import type { Express } from 'express';
import { CATEGORIES } from '@borrowbox/shared';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { clearOutbox, getOutbox } from '../../src/services/email.service';

export const app: Express = createApp();
export const PASSWORD = 'Sup3rSecret!pass';
export const API = '/api/v1';

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  for (const [i, c] of CATEGORIES.entries()) await prisma.category.create({ data: { slug: c.slug, label: c.label, sortOrder: i } });
  clearOutbox();
}

export function tokenFromEmail(to: string, param = 'token'): string {
  const mail = [...getOutbox()].reverse().find((m) => m.to === to.toLowerCase());
  const m = mail?.text.match(new RegExp(`${param}=([A-Za-z0-9_%-]+)`));
  if (!m?.[1]) throw new Error(`No email token found for ${to}`);
  return decodeURIComponent(m[1]);
}

export interface TestUser {
  id: string;
  email: string;
  csrf: string;
  agent: ReturnType<typeof request.agent>;
  get: (path: string) => request.Test;
  post: (path: string, body?: object) => request.Test;
  patch: (path: string, body?: object) => request.Test;
  del: (path: string, body?: object) => request.Test;
}

export function wrap(agent: ReturnType<typeof request.agent>, csrf: string, id: string, email: string): TestUser {
  const h = (t: request.Test) => t.set('X-CSRF-Token', csrf);
  return {
    id, email, csrf, agent,
    get: (p) => agent.get(API + p),
    post: (p, b) => h(agent.post(API + p)).send(b ?? {}),
    patch: (p, b) => h(agent.patch(API + p)).send(b ?? {}),
    del: (p, b) => h(agent.delete(API + p)).send(b ?? {}),
  };
}

/** Registers, verifies (optional) and logs in a fresh user through the real API. */
export async function makeUser(name: string, opts: { verify?: boolean } = {}): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}@example.com`;
  const reg = await request(app).post(`${API}/auth/register`).send({ name, email, password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true });
  if (reg.status !== 202) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  if (opts.verify !== false) {
    const v = await request(app).post(`${API}/auth/verify-email`).send({ token: tokenFromEmail(email) });
    if (v.status !== 200) throw new Error(`verify failed ${JSON.stringify(v.body)}`);
  }
  return login(email);
}

export async function login(email: string, password = PASSWORD): Promise<TestUser> {
  const agent = request.agent(app);
  const res = await agent.post(`${API}/auth/login`).send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return wrap(agent, res.body.data.csrfToken, res.body.data.user.id, email);
}

export const futureDate = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const itemPayload = (over: Record<string, unknown> = {}) => ({
  title: 'Cordless drill',
  description: 'A reliable cordless drill with two batteries and a charger.',
  category: 'tools-diy',
  condition: 'GOOD',
  community: 'Imphal West',
  city: 'Imphal',
  pickupInstructions: 'Ring the bell twice.',
  ...over,
});

export async function makeItem(owner: TestUser, over: Record<string, unknown> = {}) {
  const res = await owner.post('/items', itemPayload(over));
  if (res.status !== 201) throw new Error(`item failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; title: string };
}

export const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
export { prisma, request, getOutbox, clearOutbox };

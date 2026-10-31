import { Prisma } from '@prisma/client';
import type { CreateItemInput, ItemDetail, ItemQuery, ItemSummary, MyItem, UpdateItemInput } from '@borrowbox/shared';
import { LIMITS, distanceKm, todayUtc } from '@borrowbox/shared';
import { prisma } from '../../config/prisma';
import { Errors } from '../../utils/errors';
import { deleteImage, storeImage, validateImage } from '../../services/storage.service';
import { notify } from '../../services/notification.service';
import { toPublicUser } from '../users/user.mapper';
import { itemInclude, toDetail, toSummary } from './item.mapper';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

function distanceSql(lat: number, lng: number) {
  return Prisma.sql`(CASE WHEN i."latitude" IS NULL OR i."longitude" IS NULL THEN NULL ELSE
    6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(i."latitude" - ${lat}::float8) / 2), 2) +
      COS(RADIANS(${lat}::float8)) * COS(RADIANS(i."latitude")) *
      POWER(SIN(RADIANS(i."longitude" - ${lng}::float8) / 2), 2)
    )) END)`;
}

/** Public discovery. All input is parameterised through Prisma.sql. */
export async function listItems(query: ItemQuery, viewerId?: string) {
  const { q, category, condition, community, city, from, to, lat, lng, radiusKm, page, pageSize, ownerId } = query;
  if ((from && !to) || (!from && to)) {
    throw Errors.validation({ from: 'Provide both a start and an end date.' });
  }
  if (from && to && to < from) throw Errors.validation({ to: 'End date must be on or after the start date.' });
  if ((lat === undefined) !== (lng === undefined)) {
    throw Errors.validation({ lat: 'Provide both lat and lng.' });
  }
  if (radiusKm !== undefined && lat === undefined) {
    throw Errors.validation({ radiusKm: 'A distance filter needs your location.' });
  }

  const hasCoords = lat !== undefined && lng !== undefined;
  const dist = hasCoords ? distanceSql(lat, lng) : Prisma.sql`NULL::float8`;
  const where: Prisma.Sql[] = [Prisma.sql`i."status" = 'AVAILABLE'`, Prisma.sql`u."accountStatus" = 'ACTIVE'`];

  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(
      Prisma.sql`(i."title" ILIKE ${like} OR i."description" ILIKE ${like} OR c."label" ILIKE ${like})`,
    );
  }
  if (category) where.push(Prisma.sql`i."categorySlug" = ${category}`);
  if (condition) where.push(Prisma.sql`i."condition" = ${condition}::"Condition"`);
  if (community) where.push(Prisma.sql`i."community" ILIKE ${escapeLike(community)}`);
  if (city) where.push(Prisma.sql`i."city" ILIKE ${escapeLike(city)}`);
  if (ownerId) where.push(Prisma.sql`i."ownerId" = ${ownerId}::uuid`);
  if (from && to) {
    where.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM "BorrowRequest" r
      WHERE r."itemId" = i."id" AND r."status" = 'APPROVED'
        AND daterange(r."startDate", r."endDate", '[]') && daterange(${from}::date, ${to}::date, '[]'))`);
  }
  if (hasCoords && radiusKm !== undefined) {
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
    where.push(Prisma.sql`i."latitude" BETWEEN ${lat - dLat}::float8 AND ${lat + dLat}::float8`);
    where.push(Prisma.sql`i."longitude" BETWEEN ${lng - dLng}::float8 AND ${lng + dLng}::float8`);
    where.push(Prisma.sql`${dist} <= ${radiusKm}::float8`);
  }
  const whereSql = Prisma.join(where, ' AND ');

  let order = Prisma.sql`i."createdAt" DESC, i."id"`;
  if (query.sort === 'relevance' && q) {
    const prefix = `${escapeLike(q)}%`;
    const like = `%${escapeLike(q)}%`;
    order = Prisma.sql`(CASE WHEN i."title" ILIKE ${prefix} THEN 3 WHEN i."title" ILIKE ${like} THEN 2 WHEN c."label" ILIKE ${like} THEN 1 ELSE 0 END) DESC, i."createdAt" DESC, i."id"`;
  } else if (query.sort === 'distance' && hasCoords) {
    order = Prisma.sql`${dist} ASC NULLS LAST, i."createdAt" DESC, i."id"`;
  }

  const offset = (page - 1) * pageSize;
  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<{ id: string; distance: number | null }[]>`
      SELECT i."id", ${dist} AS distance
      FROM "Item" i
      JOIN "User" u ON u."id" = i."ownerId"
      JOIN "Category" c ON c."slug" = i."categorySlug"
      WHERE ${whereSql}
      ORDER BY ${order}
      LIMIT ${pageSize} OFFSET ${offset}`,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Item" i
      JOIN "User" u ON u."id" = i."ownerId"
      JOIN "Category" c ON c."slug" = i."categorySlug"
      WHERE ${whereSql}`,
  ]);

  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? await prisma.item.findMany({ where: { id: { in: ids } }, include: itemInclude(viewerId) })
    : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const data: ItemSummary[] = rows
    .map((r) => {
      const row = byId.get(r.id);
      return row ? toSummary(row as never, r.distance) : null;
    })
    .filter((x): x is ItemSummary => x !== null);

  return { data, total: Number(totalRows[0]?.count ?? 0) };
}

async function viewerCoords(viewerId?: string) {
  if (!viewerId) return null;
  const u = await prisma.user.findUnique({ where: { id: viewerId }, select: { latitude: true, longitude: true } });
  return u?.latitude != null && u.longitude != null ? { lat: u.latitude, lng: u.longitude } : null;
}

export async function getItem(itemId: string, viewerId?: string): Promise<ItemDetail> {
  const row = await prisma.item.findUnique({
    where: { id: itemId },
    include: { ...itemInclude(viewerId), owner: { select: { id: true, name: true, profileImageUrl: true, accountStatus: true } } },
  });
  const isOwner = Boolean(viewerId) && row?.ownerId === viewerId;
  if (!row) throw Errors.notFound('Item');
  const publiclyVisible = (row.status === 'AVAILABLE' || row.status === 'UNAVAILABLE') && row.owner.accountStatus === 'ACTIVE';
  if (!publiclyVisible && !isOwner) throw Errors.notFound('Item');

  const today = new Date(`${todayUtc()}T00:00:00.000Z`);
  const [owner, booked, myRequest, coords] = await Promise.all([
    toPublicUser(row.ownerId),
    prisma.borrowRequest.findMany({
      where: { itemId, status: 'APPROVED', endDate: { gte: today } },
      select: { startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    }),
    viewerId
      ? prisma.borrowRequest.findFirst({
          where: { itemId, borrowerId: viewerId, status: { in: ['PENDING', 'APPROVED'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true },
        })
      : null,
    viewerCoords(viewerId),
  ]);

  const approvedBorrower = myRequest?.status === 'APPROVED';
  const km =
    coords && row.latitude != null && row.longitude != null
      ? distanceKm(coords.lat, coords.lng, row.latitude, row.longitude)
      : null;

  return toDetail(row as never, km, {
    owner,
    isOwner,
    bookedRanges: booked.map((b) => ({
      startDate: b.startDate.toISOString().slice(0, 10),
      endDate: b.endDate.toISOString().slice(0, 10),
    })),
    myActiveRequest: myRequest ? { id: myRequest.id, status: myRequest.status } : null,
    // Pickup details are only revealed to the owner and to a borrower with an approved request.
    pickupInstructions: isOwner || approvedBorrower ? row.pickupInstructions : null,
  });
}

export async function createItem(ownerId: string, input: CreateItemInput): Promise<ItemDetail> {
  const { category, latitude, longitude, ...rest } = input;
  if ((latitude == null) !== (longitude == null)) {
    throw Errors.validation({ latitude: 'Provide both latitude and longitude, or neither.' });
  }
  const item = await prisma.item.create({
    data: { ...rest, categorySlug: category, latitude: latitude ?? null, longitude: longitude ?? null, ownerId },
    select: { id: true },
  });
  return getItem(item.id, ownerId);
}

async function ownedItem(itemId: string, userId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  // 404 (not 403) so non-owners cannot probe for hidden/archived listings.
  if (!item || item.ownerId !== userId) throw Errors.notFound('Item');
  return item;
}

export async function updateItem(itemId: string, userId: string, input: UpdateItemInput): Promise<ItemDetail> {
  const item = await ownedItem(itemId, userId);
  const { category, status, latitude, longitude, ...rest } = input;

  if (status && (item.status === 'ARCHIVED' || item.status === 'HIDDEN')) {
    throw Errors.invalidState(
      item.status === 'HIDDEN' ? 'This listing was hidden by moderators.' : 'Reactivate this listing before changing its availability.',
    );
  }
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw Errors.validation({ latitude: 'Provide both latitude and longitude, or neither.' });
  }
  await prisma.item.update({
    where: { id: itemId },
    data: {
      ...rest,
      ...(category ? { categorySlug: category } : {}),
      ...(status ? { status } : {}),
      ...(latitude !== undefined ? { latitude, longitude } : {}),
    },
  });
  return getItem(itemId, userId);
}

export async function archiveItem(itemId: string, userId: string) {
  const item = await ownedItem(itemId, userId);
  if (item.status === 'ARCHIVED') return;
  const active = await prisma.borrowRequest.count({ where: { itemId, status: 'APPROVED' } });
  if (active > 0) {
    throw Errors.invalidState('This item has an approved borrowing in progress. Finish it before archiving.');
  }
  await prisma.$transaction(async (tx) => {
    const pending = await tx.borrowRequest.findMany({
      where: { itemId, status: 'PENDING' },
      select: { id: true, borrowerId: true },
    });
    await tx.borrowRequest.updateMany({
      where: { itemId, status: 'PENDING' },
      data: { status: 'DECLINED', decisionAt: new Date(), cancellationReason: 'Listing was archived by the owner' },
    });
    for (const r of pending) {
      await notify(tx, {
        recipientId: r.borrowerId,
        type: 'REQUEST_DECLINED',
        title: 'Request declined',
        body: `The listing "${item.title}" is no longer available.`,
        entityType: 'request',
        entityId: r.id,
        dedupeKey: `req-declined:${r.id}`,
      });
    }
    await tx.item.update({ where: { id: itemId }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
  });
}

export async function reactivateItem(itemId: string, userId: string) {
  const item = await ownedItem(itemId, userId);
  if (item.status === 'HIDDEN') throw Errors.invalidState('This listing was hidden by moderators and cannot be reactivated.');
  if (item.status !== 'ARCHIVED') throw Errors.invalidState('Only archived listings can be reactivated.');
  await prisma.item.update({ where: { id: itemId }, data: { status: 'AVAILABLE', archivedAt: null } });
}

export async function listMine(userId: string, opts: { q?: string; status?: string; page: number; pageSize: number }) {
  const today = new Date(`${todayUtc()}T00:00:00.000Z`);
  const where: Prisma.ItemWhereInput = {
    ownerId: userId,
    ...(opts.status && ['AVAILABLE', 'UNAVAILABLE', 'ARCHIVED', 'HIDDEN'].includes(opts.status)
      ? { status: opts.status as 'AVAILABLE' }
      : {}),
    ...(opts.q ? { title: { contains: opts.q, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        ...itemInclude(userId),
        requests: { where: { status: { in: ['PENDING', 'APPROVED'] } }, select: { status: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.item.count({ where }),
  ]);
  const data: MyItem[] = rows.map((r) => ({
    ...toSummary(r as never, null),
    activeReservation: r.requests.some((x) => x.status === 'APPROVED' && x.endDate >= today),
    pendingRequests: r.requests.filter((x) => x.status === 'PENDING').length,
  }));
  return { data, total };
}

export async function similarItems(itemId: string, viewerId?: string): Promise<ItemSummary[]> {
  const base = await prisma.item.findUnique({ where: { id: itemId }, select: { categorySlug: true, community: true } });
  if (!base) throw Errors.notFound('Item');
  const rows = await prisma.item.findMany({
    where: {
      id: { not: itemId },
      status: 'AVAILABLE',
      owner: { accountStatus: 'ACTIVE' },
      OR: [{ categorySlug: base.categorySlug }, { community: base.community }],
    },
    include: itemInclude(viewerId),
    orderBy: [{ createdAt: 'desc' }],
    take: 12,
  });
  // Same category first, then same community.
  rows.sort((a, b) => Number(b.categorySlug === base.categorySlug) - Number(a.categorySlug === base.categorySlug));
  return rows.slice(0, 4).map((r) => toSummary(r as never, null));
}

export async function addImages(itemId: string, userId: string, files: { buffer: Buffer; size: number; originalname?: string }[]) {
  const item = await ownedItem(itemId, userId);
  if (files.length === 0) throw Errors.badRequest('Choose at least one image to upload.');
  const existing = await prisma.itemImage.count({ where: { itemId } });
  if (existing + files.length > LIMITS.MAX_IMAGES) {
    throw Errors.validation({ images: `A listing can have at most ${LIMITS.MAX_IMAGES} images.` });
  }
  files.forEach((f) => validateImage(f)); // validate everything before storing anything

  const stored: { url: string; storageKey: string }[] = [];
  try {
    for (const f of files) stored.push(await storeImage(f));
    const last = await prisma.itemImage.aggregate({ where: { itemId }, _max: { sortOrder: true } });
    let order = (last._max.sortOrder ?? -1) + 1;
    await prisma.itemImage.createMany({
      data: stored.map((s) => ({ itemId, url: s.url, storageKey: s.storageKey, altText: item.title, sortOrder: order++ })),
    });
  } catch (err) {
    await Promise.all(stored.map((s) => deleteImage(s.storageKey)));
    throw err;
  }
  return getItem(itemId, userId);
}

export async function removeImage(itemId: string, imageId: string, userId: string) {
  await ownedItem(itemId, userId);
  const image = await prisma.itemImage.findFirst({ where: { id: imageId, itemId } });
  if (!image) throw Errors.notFound('Image');
  await prisma.itemImage.delete({ where: { id: imageId } });
  await deleteImage(image.storageKey);
  return getItem(itemId, userId);
}

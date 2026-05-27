import { z } from "zod";
import type postgres from "postgres";

import { pg } from "@/db/client";

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

const birthYearMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const birthYearMonthSchema = z
  .string()
  .regex(birthYearMonthPattern, "birthYearMonth must be YYYY-MM")
  .refine((value) => value <= currentYearMonth(), "birthYearMonth cannot be in the future");

const childGenderSchema = z.enum(["boy", "girl"]).default("boy");

const childNameSchema = z
  .string()
  .trim()
  .max(40)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const nullableTextSchema = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

export const userChildInputSchema = z.object({
  birthYearMonth: birthYearMonthSchema,
  gender: childGenderSchema,
  name: childNameSchema
});

export const userHomeLocationInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .default("home"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressText: nullableTextSchema.optional()
});

export const updateMyProfileSchema = z
  .object({
    children: z.array(userChildInputSchema).max(12).optional(),
    homeLocation: userHomeLocationInputSchema.nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export type UserChildInput = z.infer<typeof userChildInputSchema>;
export type UserHomeLocationInput = z.infer<typeof userHomeLocationInputSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export type MyProfileChild = {
  id: string;
  birthYearMonth: string;
  gender: z.infer<typeof childGenderSchema>;
  name: string | null;
  sortOrder: number;
};

export type MyProfileHomeLocation = {
  label: string;
  lat: number;
  lng: number;
  addressText: string | null;
};

export type MyProfile = {
  children: MyProfileChild[];
  homeLocation: MyProfileHomeLocation | null;
};

type ChildRow = MyProfileChild;
type HomeLocationRow = MyProfileHomeLocation;

export async function getMyProfile(userId: string, executor: SqlExecutor = pg): Promise<MyProfile> {
  const [childrenRows, homeRows] = await Promise.all([
    executor<ChildRow[]>`
      select
        id::text as id,
        birth_year_month as "birthYearMonth",
        gender,
        name,
        sort_order as "sortOrder"
      from user_children
      where user_id = ${userId}
      order by sort_order asc, created_at asc
    `,
    executor<HomeLocationRow[]>`
      select
        label,
        lat,
        lng,
        address_text as "addressText"
      from user_home_locations
      where user_id = ${userId}
      limit 1
    `
  ]);

  return {
    children: childrenRows.map(childFromRow),
    homeLocation: homeRows[0] ? homeLocationFromRow(homeRows[0]) : null
  };
}

export async function updateMyProfile(userId: string, input: UpdateMyProfileInput, executor?: SqlExecutor) {
  if (executor) {
    await writeMyProfile(userId, input, executor);
    return getMyProfile(userId, executor);
  }

  return pg.begin(async (tx) => {
    await writeMyProfile(userId, input, tx);
    return getMyProfile(userId, tx);
  });
}

async function writeMyProfile(userId: string, input: UpdateMyProfileInput, executor: SqlExecutor) {
  if (input.children !== undefined) {
    await replaceUserChildren(userId, input.children, executor);
  }

  if (input.homeLocation !== undefined) {
    await replaceUserHomeLocation(userId, input.homeLocation, executor);
  }
}

async function replaceUserChildren(userId: string, children: UserChildInput[], executor: SqlExecutor) {
  await executor`
    delete from user_children
    where user_id = ${userId}
  `;

  if (children.length === 0) {
    return;
  }

  const rows = children.map((child, index) => ({
    birth_year_month: child.birthYearMonth,
    gender: child.gender,
    name: child.name ?? null,
    sort_order: index
  }));

  await executor`
    insert into user_children (user_id, birth_year_month, gender, name, sort_order)
    select ${userId}, child.birth_year_month, child.gender, child.name, child.sort_order
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as child(birth_year_month text, gender text, name text, sort_order integer)
  `;
}

async function replaceUserHomeLocation(userId: string, homeLocation: UserHomeLocationInput | null, executor: SqlExecutor) {
  if (homeLocation === null) {
    await executor`
      delete from user_home_locations
      where user_id = ${userId}
    `;
    return;
  }

  await executor`
    insert into user_home_locations (user_id, label, lat, lng, address_text)
    values (
      ${userId},
      ${homeLocation.label},
      ${homeLocation.lat},
      ${homeLocation.lng},
      ${homeLocation.addressText ?? null}
    )
    on conflict (user_id) do update
      set label = excluded.label,
          lat = excluded.lat,
          lng = excluded.lng,
          address_text = excluded.address_text,
          updated_at = now()
  `;
}

function childFromRow(row: ChildRow): MyProfileChild {
  return {
    id: row.id,
    birthYearMonth: row.birthYearMonth,
    gender: row.gender,
    name: row.name ?? null,
    sortOrder: Number(row.sortOrder)
  };
}

function homeLocationFromRow(row: HomeLocationRow): MyProfileHomeLocation {
  return {
    label: row.label,
    lat: Number(row.lat),
    lng: Number(row.lng),
    addressText: row.addressText ?? null
  };
}

function currentYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

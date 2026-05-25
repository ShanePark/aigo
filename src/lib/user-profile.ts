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

const nullableTextSchema = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

export const userChildInputSchema = z.object({
  birthYearMonth: birthYearMonthSchema,
  gender: childGenderSchema
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

export const searchPreferenceModeSchema = z.enum(["soft", "required"]);

export const userSearchPreferencesInputSchema = z
  .object({
    preferIndoor: z.boolean().optional(),
    preferParking: z.boolean().optional(),
    preferStroller: z.boolean().optional(),
    preferSandPlay: z.boolean().optional(),
    preferNursing: z.boolean().optional(),
    preferBabyChair: z.boolean().optional(),
    preferenceMode: searchPreferenceModeSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one search preference is required");

export const updateMyProfileSchema = z
  .object({
    children: z.array(userChildInputSchema).max(12).optional(),
    homeLocation: userHomeLocationInputSchema.nullable().optional(),
    searchPreferences: userSearchPreferencesInputSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export type UserChildInput = z.infer<typeof userChildInputSchema>;
export type UserHomeLocationInput = z.infer<typeof userHomeLocationInputSchema>;
export type UserSearchPreferencesInput = z.infer<typeof userSearchPreferencesInputSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export type MyProfileChild = {
  id: string;
  birthYearMonth: string;
  gender: z.infer<typeof childGenderSchema>;
  sortOrder: number;
};

export type MyProfileHomeLocation = {
  label: string;
  lat: number;
  lng: number;
  addressText: string | null;
};

export type MyProfileSearchPreferences = {
  preferIndoor: boolean;
  preferParking: boolean;
  preferStroller: boolean;
  preferSandPlay: boolean;
  preferNursing: boolean;
  preferBabyChair: boolean;
  preferenceMode: "soft" | "required";
};

export type MyProfile = {
  children: MyProfileChild[];
  homeLocation: MyProfileHomeLocation | null;
  searchPreferences: MyProfileSearchPreferences;
};

type ChildRow = MyProfileChild;
type HomeLocationRow = MyProfileHomeLocation;
type SearchPreferencesRow = MyProfileSearchPreferences;

export async function getMyProfile(userId: string, executor: SqlExecutor = pg): Promise<MyProfile> {
  const [childrenRows, homeRows, searchPreferenceRows] = await Promise.all([
    executor<ChildRow[]>`
      select
        id::text as id,
        birth_year_month as "birthYearMonth",
        gender,
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
    `,
    executor<SearchPreferencesRow[]>`
      select
        prefer_indoor as "preferIndoor",
        prefer_parking as "preferParking",
        prefer_stroller as "preferStroller",
        prefer_sand_play as "preferSandPlay",
        prefer_nursing as "preferNursing",
        prefer_baby_chair as "preferBabyChair",
        preference_mode as "preferenceMode"
      from user_search_preferences
      where user_id = ${userId}
      limit 1
    `
  ]);

  return {
    children: childrenRows.map(childFromRow),
    homeLocation: homeRows[0] ? homeLocationFromRow(homeRows[0]) : null,
    searchPreferences: searchPreferenceRows[0]
      ? searchPreferencesFromRow(searchPreferenceRows[0])
      : defaultSearchPreferences()
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

  if (input.searchPreferences !== undefined) {
    await upsertUserSearchPreferences(userId, input.searchPreferences, executor);
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
    sort_order: index
  }));

  await executor`
    insert into user_children (user_id, birth_year_month, gender, sort_order)
    select ${userId}, child.birth_year_month, child.gender, child.sort_order
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as child(birth_year_month text, gender text, sort_order integer)
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

async function upsertUserSearchPreferences(userId: string, input: UserSearchPreferencesInput, executor: SqlExecutor) {
  await executor`
    insert into user_search_preferences (
      user_id,
      prefer_indoor,
      prefer_parking,
      prefer_stroller,
      prefer_sand_play,
      prefer_nursing,
      prefer_baby_chair,
      preference_mode
    )
    values (
      ${userId},
      ${input.preferIndoor ?? false},
      ${input.preferParking ?? false},
      ${input.preferStroller ?? false},
      ${input.preferSandPlay ?? false},
      ${input.preferNursing ?? false},
      ${input.preferBabyChair ?? false},
      ${input.preferenceMode ?? "soft"}
    )
    on conflict (user_id) do update
      set prefer_indoor = coalesce(${input.preferIndoor ?? null}, user_search_preferences.prefer_indoor),
          prefer_parking = coalesce(${input.preferParking ?? null}, user_search_preferences.prefer_parking),
          prefer_stroller = coalesce(${input.preferStroller ?? null}, user_search_preferences.prefer_stroller),
          prefer_sand_play = coalesce(${input.preferSandPlay ?? null}, user_search_preferences.prefer_sand_play),
          prefer_nursing = coalesce(${input.preferNursing ?? null}, user_search_preferences.prefer_nursing),
          prefer_baby_chair = coalesce(${input.preferBabyChair ?? null}, user_search_preferences.prefer_baby_chair),
          preference_mode = coalesce(${input.preferenceMode ?? null}, user_search_preferences.preference_mode),
          updated_at = now()
  `;
}

function childFromRow(row: ChildRow): MyProfileChild {
  return {
    id: row.id,
    birthYearMonth: row.birthYearMonth,
    gender: row.gender,
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

function searchPreferencesFromRow(row: SearchPreferencesRow): MyProfileSearchPreferences {
  return {
    preferIndoor: Boolean(row.preferIndoor),
    preferParking: Boolean(row.preferParking),
    preferStroller: Boolean(row.preferStroller),
    preferSandPlay: Boolean(row.preferSandPlay),
    preferNursing: Boolean(row.preferNursing),
    preferBabyChair: Boolean(row.preferBabyChair),
    preferenceMode: row.preferenceMode
  };
}

function defaultSearchPreferences(): MyProfileSearchPreferences {
  return {
    preferIndoor: false,
    preferParking: false,
    preferStroller: false,
    preferSandPlay: false,
    preferNursing: false,
    preferBabyChair: false,
    preferenceMode: "soft"
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

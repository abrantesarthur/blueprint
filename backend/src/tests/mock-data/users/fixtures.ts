import type { RequiredKeys } from "@blueprint/type-utils";

import type { NewUser } from "../../../db";
import type { MockUser } from "./types";

/** Default values merged with fixtures before seeding. */
export const defaults: Omit<NewUser, RequiredKeys<MockUser>> = {};

/** Interface defining available user fixture names. */
export interface UserFixtures {
  /** Regular user A - user role. */
  carlosSilvaAB: MockUser;
  /** Regular user B - user role. */
  mariaSantosB: MockUser;
  /** Regular user C - user role. */
  joaoOliveiraBCD: MockUser;
  /** Regular user D - user role. */
  pedroOliveira: MockUser;
  /** Admin user A - admin role. */
  anaCostaAdmin: MockUser;
  /** Admin user B - admin role (for rate limit isolation tests). */
  lucasFerreiraAdmin: MockUser;
}

/** User fixtures for testing. */
export const fixtures: UserFixtures = {
  carlosSilvaAB: {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "user-a@test.com",
    firstName: "Carlos",
    lastName: "Silva",
    phone: "+5511999999901",
    role: "user",
  },
  mariaSantosB: {
    id: "550e8400-e29b-41d4-a716-446655440002",
    email: "user-b@test.com",
    firstName: "Maria",
    lastName: "Santos",
    phone: "+5511999999902",
    role: "user",
  },
  joaoOliveiraBCD: {
    id: "550e8400-e29b-41d4-a716-446655440023",
    email: "user-c@test.com",
    firstName: "Joao",
    lastName: "Oliveira",
    phone: "+5512999999904",
    role: "user",
  },
  pedroOliveira: {
    id: "550e8400-e29b-41d4-a716-446655440003",
    email: "user-d@test.com",
    firstName: "Pedro",
    lastName: "Oliveira",
    phone: "+5511999999903",
    role: "user",
  },
  anaCostaAdmin: {
    id: "550e8400-e29b-41d4-a716-446655440004",
    email: "admin@test.com",
    firstName: "Ana",
    lastName: "Costa",
    phone: "+5511999999904",
    role: "admin",
  },
  lucasFerreiraAdmin: {
    id: "550e8400-e29b-41d4-a716-446655440005",
    email: "admin-b@test.com",
    firstName: "Lucas",
    lastName: "Ferreira",
    phone: "+5511999999905",
    role: "admin",
  },
};

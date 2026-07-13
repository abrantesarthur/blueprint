import type { RequiredKeys } from "@blueprint/type-utils";

import type { NewUser } from "../../../db";
import type { MockUser } from "./types";

/** Default values merged with fixtures before seeding. */
export const defaults: Omit<NewUser, RequiredKeys<MockUser>> = {};

/** Interface defining available user fixture names. */
export interface UserFixtures {
  /** Regular user A. */
  carlosSilvaAB: MockUser;
  /** Regular user B. */
  mariaSantosB: MockUser;
  /** Regular user C - has no email. */
  joaoOliveiraBCD: MockUser;
  /** Regular user D - shares the "Oliveira" last name with user C. */
  pedroOliveira: MockUser;
  /** Regular user E. */
  anaCostaAdmin: MockUser;
  /** Regular user F (for rate limit isolation tests). */
  lucasFerreiraAdmin: MockUser;
}

/** User fixtures for testing. */
export const fixtures: UserFixtures = {
  carlosSilvaAB: {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "user-a@test.com",
    firstName: "Carlos",
    lastName: "Silva",
  },
  mariaSantosB: {
    id: "550e8400-e29b-41d4-a716-446655440002",
    email: "user-b@test.com",
    firstName: "Maria",
    lastName: "Santos",
  },
  joaoOliveiraBCD: {
    id: "550e8400-e29b-41d4-a716-446655440023",
    email: null,
    firstName: "Joao",
    lastName: "Oliveira",
  },
  pedroOliveira: {
    id: "550e8400-e29b-41d4-a716-446655440003",
    email: "user-d@test.com",
    firstName: "Pedro",
    lastName: "Oliveira",
  },
  anaCostaAdmin: {
    id: "550e8400-e29b-41d4-a716-446655440004",
    email: "user-e@test.com",
    firstName: "Ana",
    lastName: "Costa",
  },
  lucasFerreiraAdmin: {
    id: "550e8400-e29b-41d4-a716-446655440005",
    email: "user-f@test.com",
    firstName: "Lucas",
    lastName: "Ferreira",
  },
};

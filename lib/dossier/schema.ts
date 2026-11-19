import { z } from "zod";

/** Bornes de sécurité : la route dossier est publique en démo. */
const short = (max: number) => z.string().max(max);
const list = (maxItems: number, maxLength: number) =>
  z.array(z.string().max(maxLength)).max(maxItems);

export const DossierFactsSchema = z
  .object({
    consents: z.object({ ai: z.boolean() }),
    profile: z.object({
      code: short(8),
      domains: z
        .array(
          z.object({
            id: short(80),
            label: short(80),
            score: z.number().min(0).max(1),
            confirmed: z.boolean(),
          }),
        )
        .max(30),
      traits: z
        .array(
          z.object({
            label: short(80),
            value: short(80),
            confidence: z.number().min(0).max(1),
          }),
        )
        .max(10),
      strengths: list(10, 120),
      unknowns: list(10, 120),
    }),
    directions: z
      .array(
        z.object({
          id: short(80),
          title: short(100),
          jobs: z
            .array(
              z.object({
                code: short(20),
                label: short(160),
                level: short(60),
                competences: list(8, 220),
                savoirEtre: list(8, 160),
                friction: list(5, 160),
              }),
            )
            .max(6),
          evidence: z
            .array(
              z.object({
                id: short(160),
                text: short(300),
              }),
            )
            .max(5),
          watchout: short(400).optional(),
        }),
      )
      .max(3),
    trainings: z
      .array(
        z.object({
          id: short(120),
          title: short(180),
          level: short(80),
          duration: short(40),
          establishments: list(6, 180),
          jobs: list(10, 180),
          debouches: list(10, 180),
          prerequisites: list(10, 220),
          alternance: z.boolean(),
          cost: short(120).optional(),
          why: short(400),
        }),
      )
      .max(10),
    offers: z
      .array(
        z.object({
          id: short(120),
          title: short(180),
          company: short(180),
          city: short(100),
          jobCode: short(20).optional(),
          jobLabel: short(180).optional(),
          contract: short(80).optional(),
          salary: short(100).optional(),
          contact: short(180).optional(),
          url: short(500).optional(),
          competences: list(8, 220).optional(),
        }),
      )
      .max(16),
    cvTarget: z.object({
      offerId: short(120).optional(),
      jobCode: short(20).optional(),
      jobLabel: short(180),
      romeLabel: short(180).optional(),
      company: short(180).optional(),
      city: short(100).optional(),
      contract: short(80).optional(),
      salary: short(100).optional(),
      contact: short(180).optional(),
      url: short(500).optional(),
      competences: list(10, 220),
      savoirEtre: list(10, 180).optional(),
    }),
    softSkills: list(30, 80),
    user: z.object({
      age: z.number().int().min(14).max(99),
      studiesLevel: short(80),
      status: short(80),
      experience: z
        .array(
          z.object({
            id: short(160),
            title: short(220),
            proof: short(220).optional(),
            competences: list(8, 220).optional(),
            source: short(20),
          }),
        )
        .max(10),
      mobilityKm: z.number().min(0).max(200),
      city: short(100),
      contracts: list(8, 60),
      availability: short(100),
      alternance: z.boolean(),
      driverLicense: z.boolean(),
    }),
  })
  .strict();

export const DossierRequestSchema = z
  .object({
    facts: DossierFactsSchema,
  })
  .strict();

export type DossierFactsInput = z.infer<typeof DossierFactsSchema>;

import { describe, expect, it } from "vitest";
import {
  FIRST_EXPERIENCE_ASK,
  MAX_EXPERIENCE_ASKS,
  shouldAskExperience,
  type ExperienceAskInput,
} from "./experienceAsk";

const base: ExperienceAskInput = {
  direction: "right",
  isCreuser: false,
  pending: false,
  rightInterests: FIRST_EXPERIENCE_ASK,
  experienceAsks: 0,
  interviewsCount: 0,
  domainMean: 0.8,
  domainConfirmed: false,
};

describe("question « Tu l'as déjà fait ? »", () => {
  it("ne tombe pas sur les premiers oui", () => {
    expect(shouldAskExperience({ ...base, rightInterests: 3 })).toBe(false);
  });

  it("tombe sur un domaine qui monte après quelques oui", () => {
    expect(shouldAskExperience(base)).toBe(true);
    expect(shouldAskExperience({ ...base, domainConfirmed: true })).toBe(true);
  });

  it("ignore un domaine encore trop faible", () => {
    expect(shouldAskExperience({ ...base, domainMean: 0.45 })).toBe(false);
  });

  it("ne se superpose pas à une confirmation ou à une carte creuser", () => {
    expect(shouldAskExperience({ ...base, pending: true })).toBe(false);
    expect(shouldAskExperience({ ...base, isCreuser: true })).toBe(false);
  });

  it("s'arrête après 3 questions ou 2 entretiens", () => {
    expect(
      shouldAskExperience({ ...base, experienceAsks: MAX_EXPERIENCE_ASKS }),
    ).toBe(false);
    expect(shouldAskExperience({ ...base, interviewsCount: 2 })).toBe(false);
  });

  it("espace les questions suivantes", () => {
    const afterOne = {
      ...base,
      experienceAsks: 1,
      rightInterests: FIRST_EXPERIENCE_ASK + 5,
    };
    expect(shouldAskExperience(afterOne)).toBe(true);
    expect(
      shouldAskExperience({ ...afterOne, rightInterests: afterOne.rightInterests - 1 }),
    ).toBe(false);
  });

  it("ne pose jamais la question sur un non", () => {
    expect(shouldAskExperience({ ...base, direction: "left" })).toBe(false);
  });
});

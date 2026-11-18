import rawJobs from "../data/rome/jobs-featured.json";
import type { Job } from "./types";

/**
 * Sous-ensemble ROME 4.0 v62 : métiers accessibles sans diplôme long,
 * sélectionnés pour couvrir les 30 centres d'intérêt.
 * Le dump complet (1 923 métiers) est dans data/rome/jobs.json.
 */
export const JOBS = rawJobs as unknown as Job[];

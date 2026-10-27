export {
  PatientMatchingService,
  patientMatchingService,
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  normalizeMiddleName,
  compareMiddleNames,
  normalizePhoneNumber,
  comparePhoneNumbers,
  normalizeSSN,
  compareDates,
  NMN_MARKER,
} from "./patient-matching-service";

export type {
  PatientIdentifier,
  MatchResult,
  MatchDetails,
  DuplicateCandidate,
} from "./patient-matching-service";

export { default as mpiRoutes } from "./mpi-routes";

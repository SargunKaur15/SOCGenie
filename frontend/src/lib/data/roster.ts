export const SEED_ANALYST_NAMES: readonly string[] = [
  "A. Sharma",
  "J. Mehta",
  "R. Fernandes",
  "K. Iyer",
];

export const UNASSIGNED_LABEL = "Unassigned";

export function normaliseAssignee(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null) return null;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function assigneeLabel(
  assignedTo: string | null | undefined,
  currentUserName: string | null | undefined
): string {
  const owner = normaliseAssignee(assignedTo);

  if (owner === null) return UNASSIGNED_LABEL;

  const me = normaliseAssignee(currentUserName);

  return me !== null && owner === me
    ? `${owner} (You)`
    : owner;
}
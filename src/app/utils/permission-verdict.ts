/**
 * How the permission-comparison verdict is worded.
 *
 * The comparison runs the same query as a second identity, so the other identity may see more results
 * than the signed-in one *or* fewer. The wording has to say which, because a subtraction rendered
 * straight into the sentence reads as "sees -3 more document(s)" whenever the second identity sees
 * less, which is the commoner direction and the whole point of the panel.
 *
 * A pure function rather than a template expression: it is the part with a decision in it, and it is
 * testable without standing up the component.
 */

/**
 * The sentence under "Permission filtering detected".
 *
 * @param username the identity that was compared against the signed-in one
 * @param compareCount how many results that identity saw
 * @param mainCount how many the signed-in identity saw
 */
export function permissionVerdict(username: string, compareCount: number, mainCount: number): string {
  const difference = Math.abs(compareCount - mainCount);
  const documents = `${difference} document${difference === 1 ? '' : 's'}`;

  if (compareCount > mainCount) {
    return `${username} sees ${documents} more than you for this query.`;
  }
  if (compareCount < mainCount) {
    return `${username} sees ${documents} fewer than you for this query.`;
  }
  // Reachable only if a caller asks for a verdict on equal counts, which the panel does not do: it
  // renders its "same visible result count" branch instead. Worded rather than left to a subtraction.
  return `${username} sees the same number of documents as you for this query.`;
}

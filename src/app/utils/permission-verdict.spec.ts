import { permissionVerdict } from './permission-verdict';

describe('permission-verdict', () => {

  it('saysFewerRatherThanNegativeMore', () => {
    // The defect: the panel subtracted and interpolated, so a restricted identity read as
    // "sees -3 more document(s)".
    const verdict = permissionVerdict('reader', 2, 5);

    expect(verdict).not.toContain('-');
    expect(verdict).toContain('3 documents fewer');
    expect(verdict).toBe('reader sees 3 documents fewer than you for this query.');
  });

  it('saysMoreWhenTheOtherIdentitySeesMore', () => {
    expect(permissionVerdict('admin', 9, 4)).toBe('admin sees 5 documents more than you for this query.');
  });

  it('singularisesOneDocument', () => {
    // "1 document(s)" was the other half of the wording that made the panel look unfinished.
    expect(permissionVerdict('reader', 4, 5)).toBe('reader sees 1 document fewer than you for this query.');
    expect(permissionVerdict('admin', 5, 4)).toBe('admin sees 1 document more than you for this query.');
  });

  it('wordsEqualCountsRatherThanSayingZeroMore', () => {
    expect(permissionVerdict('reader', 5, 5))
      .toBe('reader sees the same number of documents as you for this query.');
  });
});

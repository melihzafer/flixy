import {
  HandleSchema,
  LanguageCodeSchema,
  RegionCodeSchema,
  UserIdSchema,
  UserProfileSchema,
} from '../user';

describe('UserProfile schema', () => {
  it('accepts a valid profile', () => {
    const result = UserProfileSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000000',
      handle: null,
      displayName: 'Melih',
      avatarUrl: null,
      region: 'TR',
      language: 'tr',
      isAnonymous: false,
      createdAt: '2026-04-26T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid region codes', () => {
    expect(RegionCodeSchema.safeParse('Turkey').success).toBe(false);
    expect(RegionCodeSchema.safeParse('tr').success).toBe(false);
    expect(RegionCodeSchema.safeParse('TR').success).toBe(true);
  });

  it('accepts local-first user ids', () => {
    expect(UserIdSchema.safeParse('anon').success).toBe(true);
    expect(UserIdSchema.safeParse('user-qa@flixy.app').success).toBe(true);
    expect(
      UserProfileSchema.safeParse({
        id: 'anon',
        handle: null,
        displayName: 'Anonymous',
        avatarUrl: null,
        region: 'US',
        language: 'en',
        isAnonymous: true,
        createdAt: '2026-06-20T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('only allows the seven launch languages', () => {
    expect(LanguageCodeSchema.safeParse('en').success).toBe(true);
    expect(LanguageCodeSchema.safeParse('tr').success).toBe(true);
    expect(LanguageCodeSchema.safeParse('jp').success).toBe(false);
  });

  it('enforces handle format', () => {
    expect(HandleSchema.safeParse('me').success).toBe(false); // too short
    expect(HandleSchema.safeParse('a'.repeat(21)).success).toBe(false); // too long
    expect(HandleSchema.safeParse('Melih').success).toBe(false); // uppercase
    expect(HandleSchema.safeParse('me_lih').success).toBe(true);
    expect(HandleSchema.safeParse('me-lih').success).toBe(false); // dash
  });
});

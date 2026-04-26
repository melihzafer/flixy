import {
  ONBOARDING,
  OnboardingGenresInputSchema,
  OnboardingServicesInputSchema,
} from '../onboarding';

describe('onboarding schemas', () => {
  it('requires at least one service', () => {
    expect(OnboardingServicesInputSchema.safeParse({ selectedServices: [] }).success).toBe(false);
    expect(OnboardingServicesInputSchema.safeParse({ selectedServices: ['netflix'] }).success).toBe(
      true,
    );
  });

  it('enforces genre min/max bounds', () => {
    const tooFew = OnboardingGenresInputSchema.safeParse({ selectedGenres: ['drama'] });
    expect(tooFew.success).toBe(false);

    const justRight = OnboardingGenresInputSchema.safeParse({
      selectedGenres: ['drama', 'comedy', 'sci_fi'],
    });
    expect(justRight.success).toBe(true);

    const tooMany = OnboardingGenresInputSchema.safeParse({
      selectedGenres: Array.from({ length: ONBOARDING.MAX_GENRES + 1 }, (_, i) => `g_${i}`),
    });
    expect(tooMany.success).toBe(false);
  });

  it('rejects invalid id formats', () => {
    expect(
      OnboardingServicesInputSchema.safeParse({ selectedServices: ['Netflix!'] }).success,
    ).toBe(false);
  });
});

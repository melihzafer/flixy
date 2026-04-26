import { SignInInputSchema, SignUpInputSchema, UpdatePasswordInputSchema } from '../auth';

describe('auth schemas', () => {
  it('accepts a valid sign-up payload and lower-cases the email', () => {
    const out = SignUpInputSchema.parse({
      email: '  Foo@Example.COM ',
      password: 'hunter22!',
    });
    expect(out.email).toBe('foo@example.com');
  });

  it('rejects a too-short password on sign-up', () => {
    expect(() => SignUpInputSchema.parse({ email: 'a@b.co', password: 'short' })).toThrow();
  });

  it('rejects empty password on sign-in', () => {
    expect(() => SignInInputSchema.parse({ email: 'a@b.co', password: '' })).toThrow();
  });

  it('flags mismatched passwords on update', () => {
    expect(() =>
      UpdatePasswordInputSchema.parse({ password: 'hunter22!', confirmPassword: 'nope1234' }),
    ).toThrow(/do not match/i);
  });
});

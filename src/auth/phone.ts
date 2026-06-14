// Phone-OTP login — ubiquitous in Bangladesh. Two steps: issue an OTP to a
// +880 number, then verify the code to establish a session.

import { api } from '@/api/client';
import { type Result, ok } from '@/api/errors';
import { formatPhoneBd } from '@/i18n/formatters';

import { establishSessionFromTokens } from './session-helpers';

interface OtpVerifyResponse {
  accessToken: string;
  refreshToken: string;
}

/** Issue an OTP to the given Bangladeshi mobile number. */
export async function issuePhoneOtp(rawPhone: string): Promise<Result<void>> {
  const phone = formatPhoneBd(rawPhone);
  const res = await api.post('/api/v1/auth/phone/otp/issue', { phone });
  if (!res.ok) return res;
  return ok(undefined);
}

/** Verify the OTP and establish a session. */
export async function verifyPhoneOtp(
  rawPhone: string,
  code: string,
): Promise<Result<void>> {
  const phone = formatPhoneBd(rawPhone);
  const res = await api.post<OtpVerifyResponse>('/api/v1/auth/phone/otp/verify', {
    phone,
    code,
  });
  if (!res.ok) return res;
  await establishSessionFromTokens(res.value.accessToken, res.value.refreshToken);
  return ok(undefined);
}

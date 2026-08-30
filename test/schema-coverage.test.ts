import { describe, expect, it } from 'vitest';
import type {
  EmailAttachment,
  SendEmailHtmlParams,
  SendEmailPayload,
  SendEmailTemplateIdParams,
  SendEmailTemplateSlugParams,
  SendEmailTextParams,
} from '../src/types.js';
import type { components } from '../src/generated/schema.js';

/**
 * Field-level drift guard.
 *
 * spec-coverage.test.ts checks that every *operation* in the spec has an SDK
 * method. That misses a whole class of drift: an operation that exists but has
 * grown a field the SDK cannot set. `region` went missing from this SDK for
 * weeks that way, and `stream` did the same — it was in SendEmailDto, absent
 * from SendEmailParams, and every guard stayed green because the operation was
 * present. See GP-54.
 *
 * Most types here are aliases of the generated schema, so they cannot drift by
 * construction. The exposure is the hand-written ones: the send params, split
 * into four variants so exactly one content source can be required, and
 * EmailAttachment. Those are the ones checked below.
 *
 * These assertions fail at COMPILE time, not at runtime — `npm run typecheck`
 * is where a missing field shows up. The runtime test exists so the file is
 * visible in the suite and the failure has somewhere to be explained.
 */

type Schemas = components['schemas'];

/** Keys reachable through any of the four send-params variants. */
type AllSendParamKeys =
  | keyof SendEmailHtmlParams
  | keyof SendEmailTextParams
  | keyof SendEmailTemplateIdParams
  | keyof SendEmailTemplateSlugParams;

/** Schema fields a caller cannot set through the SDK. Must be never. */
type SendFieldsMissingFromSdk = Exclude<keyof SendEmailPayload, AllSendParamKeys>;

/** Attachment fields a caller cannot set. Must be never. */
type AttachmentFieldsMissingFromSdk = Exclude<
  keyof Schemas['EmailAttachmentDto'],
  keyof EmailAttachment
>;

/**
 * Resolves to the type itself when T is never, and to a loud marker type
 * otherwise — so the compiler names the offending field in the error rather
 * than just saying two types are incompatible.
 */
type AssertNever<T, _Hint extends string> = [T] extends [never] ? true : { missing: T };

const sendFieldsCovered: AssertNever<
  SendFieldsMissingFromSdk,
  'SendEmailDto has a field the SDK params cannot set — add it to SendEmailBase'
> = true;

const attachmentFieldsCovered: AssertNever<
  AttachmentFieldsMissingFromSdk,
  'EmailAttachmentDto has a field EmailAttachment cannot set'
> = true;

describe('schema coverage (field level)', () => {
  it('exposes every field of the send and attachment schemas', () => {
    // The real check ran at compile time. If a field went missing, typecheck
    // already failed and this file never got here.
    expect(sendFieldsCovered).toBe(true);
    expect(attachmentFieldsCovered).toBe(true);
  });
});

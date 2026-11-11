# Yidun text moderation: troubleshooting guide

Problems I hit (or deliberately reproduced) while integrating NetEase Yidun text moderation into this API.
Each entry follows **symptom → how to investigate → cause → fix**.

Quick tool: `npm run yidun:check -- "some text"` sends one real request using the credentials in `.env`
and prints the verdict, the time taken, or Yidun's error code and message.

> First rule: Yidun returns **HTTP 200 even when the call failed**. Always read the `code` and `msg`
> fields in the response body. Checking only the HTTP status hides every authentication and parameter error.

---

## 1. Every request fails with `code: 410` (signature verification failed)

**Investigate**
1. Log the exact string that is hashed (with the secretKey masked) and compare it with the rule:
   parameter names sorted in ascending ASCII order, concatenated as `key1value1key2value2`, then the secretKey.
2. Run the worked example from the docs through `genSignature` (`foo=1, bar=2, foo_bar=3, baz=4`
   with the documented secretKey must give `730b0588690874dde18fa58cb1301787`). This is a unit test in `tests/signature.test.ts`.
3. Check that the parameters that were signed are exactly the parameters that were sent.

**Common causes**
- Joining with `=` and `&` like a query string instead of plain `keyvalue` pairs
- Including `signature` itself in the signed string
- Signing before adding a parameter (e.g. adding `version` after computing the signature)
- Hashing a non-UTF-8 encoding, so Chinese content gives a different MD5
- Using the secretKey of a different product than the `secretId` being sent

**Fix in this project**: `src/moderation/yidunClient.ts` builds the full parameter map first, then signs it,
and the test `Should POST a signed form-urlencoded request` re-computes the signature from what was actually sent.

## 2. `code: 400`, "请求缺少参数 secretId", even though secretId is set

**Investigate**: open the request in DevTools / Apifox and look at the `Content-Type` header and the raw body.

**Cause**: the body was sent as JSON. Yidun only reads `application/x-www-form-urlencoded`.
I reproduced this with `curl` — the `msg` even hints to check the content-type.

**Fix**: send `new URLSearchParams(params).toString()` with the form content type.

## 3. `code: 401`, "未经授权，请检查 secretId 或者 businessId"

**Investigate**: compare `secretId` and `businessId` character by character with the console
(智能审核后台 → 产品业务管理). Check whether the trial has expired.

**Causes**: wrong or swapped IDs, leading/trailing spaces from copy-paste into `.env`, expired trial.
(Reproduced with fake credentials: HTTP 200, body `code: 401`.)

## 4. Requests time out from Sydney, but work fine for teammates in China

**Investigate**: measure each phase with curl:

```bash
curl -s -o /dev/null -w 'connect=%{time_connect} tls=%{time_appconnect} total=%{time_total}\n' \
  -X POST https://as.dun.163.com/v5/text/check
```

Measured from Sydney: connect ≈ 0.13s, TLS done ≈ 0.43s, total ≈ 0.6s. The first call after start-up
(cold DNS + TLS) went over 1s.

**Cause**: Yidun's suggested timeout (200ms–1s) assumes a server in mainland China. Cross-border round trips
plus a fresh TLS handshake use most of that budget before the request is even sent.

**Fix**: default timeout raised to 3s and made configurable with `YIDUN_TIMEOUT_MS`.
In production the better fix is to deploy close to the API and reuse connections (keep-alive).

## 5. What should happen when Yidun is down or slow?

**Decision**: this project **fails open** — on timeout, network error or a non-200 code, it logs a warning
with the `dataId` and lets the task be saved (`failOpen()` in `src/moderation/index.ts`).

**Trade-off**: users are never blocked by a third-party outage, but unchecked content can be saved during that window.
A platform with strict compliance requirements should **fail closed** instead (refuse, or queue the content
for later review). Yidun's offline detection results or callbacks can then catch anything that slipped through.

## 6. A task was accepted but comes back with `"flagged": true`

**Not a bug.** `suggestion: 1` means *suspicious*. Yidun's docs recommend not deleting suspicious content
outright but limiting it (e.g. visible only to its author) until the offline/human review result arrives.
This API saves the task and marks it `flagged`. `suggestion: 2` (reject) returns **422** and nothing is saved.

## 7. The moderation service is called for invalid or missing tasks

**Symptom**: trial quota (`code: 413`, 8000 requests for self-service trials) used up faster than expected.

**Fix**: the routes validate the title locally and check that the task exists (404) **before** calling Yidun,
and PATCH only calls Yidun when the title is actually changing. Each of these has a test asserting the moderator was not called.

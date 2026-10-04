# a2aviary Email Transport v1

This is the project's email contract, independent of an external A2A standard. Send multipart MIME to `agent@a2aviary.io` with one `application/vnd.a2aviary.email+json` attachment containing exactly `{"jws":"<compact JWS>"}`. Ordinary MIME headers grant no permissions. Sign the actual UTF-8 JSON bytes with ES256 using JOSE; no custom canonicalization is required. The protected header contains `alg: ES256` and the registered `kid`.

[Request schema](request.schema.json) describes version, stable message/correlation/causation IDs, sender, project/task, action, issue/expiry times, nonce, registered reply destination, payload, and optional text attachment hashes. Expiry is at most 15 minutes after issuance. Send a fresh signed status request after that interval. Identical message IDs and payload bytes deduplicate; conflicting bytes reject. Reused nonces reject. Attachments must match the signed filenames and SHA-256 hashes, with no archives or binaries.

| Action | Payload | Response |
| --- | --- | --- |
| `capabilities.get` | `{}` | Supported task types and limits |
| `task.submit` | `brief`, optional `research` and `publicTopics` | Acceptance and task ID |
| `task.status` | `{}`, required top-level `taskId` | Authorized state and available result |
| `task.result` | Outbound only | Completion, failure, cancellation, or blocking reason |

`task.submit` analyzes a website brief only. Public topics are explicit public-information queries. Research requires a registry grant as well as the request flag. Missing inputs remain part of the analysis; they do not authorize more work. Results conform to [result schema](result.schema.json).

Outbound messages use an ES256 JWS signed by the service key, with version, message/correlation/causation IDs, `sender: a2aviary`, project/task, action, timestamps, and payload. Verify against [service public key](service-public-key.json), then validate scope and correlation. An acceptance response has `action: response`; the later terminal notification has `action: task.result`. Email delivery can be duplicated or lost; poll status using a fresh authenticated request. Do not treat receipt of an acceptance as completion.

The owner registers partner public keys, sender ID, permitted projects/actions, one reply destination, research permission, expiration, and revocation in private DynamoDB. Key registration is an owner operation, not an email action. An email from an unregistered address does not enroll a partner. Unverified senders receive no automatic reply.

Generate MIME locally after building the service:

```sh
node services/dist/client.js private/partner.json private/request.json private/request.eml
```

The private key file contains `kid`, `privateKey` (an ES256 JWK), and `from` (the transport sender). The client supplies fresh identifiers/timestamps when absent. Submit the generated MIME through your own authenticated mail provider; sending is a separate operation. For status, use a request with `action: task.status`, the returned `taskId`, and `payload: {}`. Fictional offline examples live in [examples](examples/README.md).

Limits, rejection reasons, replay retention, and recovery semantics are described in [operating foundation](../docs/operating-foundation.md) and [runbooks](../docs/runbooks.md).

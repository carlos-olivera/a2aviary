# Initial release verification

Date: 2026-10-03. This record distinguishes configured source, deployed resources, verified behavior, and blockers. It will be completed with deployment and end-to-end evidence before the release is declared operational.

| Area | Current evidence |
| --- | --- |
| Website infrastructure | Deployed private S3/OAC CloudFront, ACM, apex aliases, and CI role |
| Source checks | Website asset checks/build; service TypeScript/build and 14 behavioral tests; four synthesized infrastructure security assertions pass |
| Email/runtime | Configured; first deployment rolled back because of duplicate CDK-created MAIL FROM records; corrected before retry |
| Repository | Four original commits preserved locally; public publication pending |
| Autonomy | Real Agents inference, signed email path, persistence, and reply not yet verified |
| GitHub App/protection | Prepared implementation; registration/installation not yet verified; development disabled |

## Known tooling finding

The pinned current CDK library bundles `brace-expansion` 5.0.9 with a reported denial-of-service advisory. npm overrides do not replace this vendored dependency. Service dependency audit reports zero advisories. CDK is used only in the owner-controlled build/deployment path, with trusted configuration. A CDK update removing the bundled advisory remains required; this is not recorded as a clean infrastructure audit.

## Evidence handling

Private deploy logs, CloudFormation outputs, MIME, results, owner contacts, credentials, screenshots of private controls, and operational details stay in `.local/` or private AWS resources. Public evidence contains sanitized resource/workflow identifiers, test outcomes, and fictional task results only. No measured monthly cost is claimed from a launch smoke test.

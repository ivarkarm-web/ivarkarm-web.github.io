# Pionier quality baseline

This branch is for reliability, product coherence, and production-readiness work. Changes must preserve the existing handpan-first interaction and be verified by automated checks before merge.

## Priority order
1. Remove the remote runtime core-fetch and string-patching boot dependency.
2. Fix automated tests to describe the current app rather than a retired interface.
3. Add browser regression checks for note input, instrument switching, controls, and mobile layout.
4. Verify CI and deployment from the exact tested commit.

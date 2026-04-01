---
name: verify
description: Run full validation (build,lint, format check, license headers) to validate changes before committing.  IMPORTANT - Proactively invoke this skill after completing any code changes (new features, bug fixes, refactors) before reporting completion to the user.
---

Run the project's full validation suite to check that changes are ready for CI:

```bash
yarn check:all
```

On failure:

1. Report which checks failed and the specific errors
2. Auto-fix by invoking the `/fix` skill
3. Re-run `yarn check:all` to confirm everything passes

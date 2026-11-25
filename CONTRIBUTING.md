# Contributing to Ikibondo

Two people build Ikibondo: **Gad Anaclet Irumva** (GitHub `irumvag`) and **Gentille Tumukunde**.
Every commit credits both of them.

## Commit rule: always credit the other person

The author writes the commit; the other teammate goes in a `Co-Authored-By` line at the end.

Gad's commits end with:

```
Co-Authored-By: Gentille Tumukunde <tumukundegentille001@gmail.com>
```

Gentille's commits end with:

```
Co-Authored-By: Gad Anaclet Irumva <148103394+irumvag@users.noreply.github.com>
```

(the `noreply` address links the credit to Gad's GitHub account).

No other co-author lines: in particular no AI or tool attribution.

To get the line automatically, set a commit template once in your clone:

```bash
# Gentille
git config commit.template .github/commit-templates/gentille.txt
# Gad
git config commit.template .github/commit-templates/gad.txt
```

`git commit` (without `-m`) then opens your editor with the line already filled in.

### Message format

```
type(scope): what changed, in plain words

Why it changed and anything a reviewer should check (optional, wrap at ~72 chars).

Co-Authored-By: <the other teammate>
```

- **type**: `feat` (new behaviour), `fix` (bug), `chore` (tooling, seed, deps), `docs`, `test`, `refactor`
- **scope**: `auth`, `children`, `health-records`, `vaccinations`, `chw`, `nurse`, `supervisor`, `parent`,
  `admin`, `insights`, `ml`, `dhis2`, `web`, `mobile`, `seed`, `core`

## Branches and who approves

```
dev  ──PR──▶  staging  ──PR──▶  main
daily work    test server       production
```

- **`dev`**: daily work. Commit here directly or through short pull requests. CI must pass.
- **`staging`**: changes reach it only by a pull request from `dev`. **Gentille approves it.**
- **`main`**: changes reach it only by a pull request from `staging`, after the change was checked on the
  staging server. **Gentille approves it.**
- GitHub does not let anyone approve their own pull request. When Gentille opens one, Gad reviews it.
- Only these three branches exist. Don't push other long-lived branches; delete short PR branches once merged.

Branch protection (repository Settings → Branches, done by the repository owner): require a pull request
with one approval and a green CI for `staging` and `main`.

## Before every commit

```bash
# backend
cd backend && pytest
# web
cd frontend && npx tsc --noEmit && npm run lint && npm test
# mobile (if you touched it)
cd mobile && flutter analyze --no-fatal-infos && flutter test
```

Changing a page or form? Run the browser flows too (see `docs/handover.md`, "Run it locally").

## Never commit

- `.env` files, keys, certificates or real passwords
- Model binaries (`*.pkl`, `*.joblib`): restore them with `python ml/scripts/fetch_models.py`
- Real children's data: test only with `seed_data`, which uses fictional camps
- Media uploads

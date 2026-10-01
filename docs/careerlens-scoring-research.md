# CareerLens: evidence-based GitHub assessment

Research date: 2026-10-01. Sources are primary documentation and research, checked on that date. This document proposes a methodology; it does not assert that every recommendation is already implemented.

## What can be rated reliably

CareerLens should assess observable practices in a disclosed sample of public repositories. It should not present its score as a validated measure of a person's engineering ability, employability, productivity, or security assurance. A repeatable algorithm improves consistency; empirical calibration is still required to claim predictive accuracy. No universal GitHub developer rating was established by the sources reviewed.

The SPACE research framework treats developer productivity as multidimensional and explicitly rejects reducing it to individual activity or a single metric. Consequently, repository counts, commit counts, and contribution streaks should be context, not points for productivity. [Microsoft Research: SPACE](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/)

GitHub describes starring as bookmarking repositories. CareerLens should therefore keep stars, followers, and forks outside the quality formula. They can describe public attention, but do not establish correctness. [GitHub: starring API](https://github.com/github/docs/blob/main/content/rest/activity/starring.md)

## Relevant assessment systems

OpenSSF Scorecard evaluates automated repository security practices, with individual checks, risk weights, and remediation. Its aggregate represents security posture, not a developer ranking. CareerLens can borrow the principle of inspectable checks and actionable findings, but its custom overall score must not be branded an OpenSSF score or certification. [OpenSSF Scorecard](https://scorecard.dev/)

Scorecard documents material detection limitations: CI and SAST tools may be missed; a low result need not demonstrate risk. Some branch-protection settings require an administrator token. Its maintenance guidance recognizes that stable utilities may not need frequent changes. These qualifications support separating unavailable evidence from failed checks and avoiding a universal commit-frequency target. [Scorecard check definitions](https://github.com/ossf/scorecard/blob/main/docs/checks.md)

The OpenSSF Best Practices badge adds practices that require human claims and justification: documented testing instructions, tests accompanying functionality, and compiler warnings or linting where applicable. Its criteria allow N/A in specified cases. File-name detection alone cannot establish compliance with these requirements. [OpenSSF Best Practices criteria](https://www.bestpractices.dev/en/criteria)

## Proposed dimensions

The following is a CareerLens design proposal, not externally validated weighting. Publish the actual implemented points, check definitions, thresholds, and rubric version in the application. Avoid double counting the same evidence across dimensions.

| Dimension                         | Useful evidence                                                                                    | Limits to communicate                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| README usefulness                 | Purpose, setup, usage examples, support and contribution entry points                              | Presence, length, headings, and keywords do not prove instructions work                                         |
| Change clarity                    | Human-authored commit subjects with meaningful intent, inspectable commit links                    | Messages cannot establish implementation quality or the account owner's authorship of all repository changes    |
| Code-maintenance practices        | Test files, lint/type-check configuration, ecosystem-specific build configuration                  | These are practice indicators, not a source-code audit or measured test coverage                                |
| Documentation and collaboration   | Contribution guidance, examples, architecture/API documentation, license information               | Hosted or organization-wide guidance may exist outside the fetched tree                                         |
| Automation and security practices | Workflow configuration, observed run conclusions, security policy, dependency-update configuration | A workflow file is not a successful test run; a successful run does not prove comprehensive testing or security |

GitHub's README guidance emphasizes explaining purpose, usefulness, getting started, support, and maintainers. It recognizes READMEs in `.github`, root, and `docs`, in that order, and recommends moving longer material into separate documentation. These are better targets than rewarding README size. [GitHub: README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)

For multilingual repositories, normalize Unicode and recognize common headings and commands across supported languages, including Arabic. Disclose supported languages. Never treat unrecognized English keywords as proof that non-English documentation lacks useful instructions. Prefer structural evidence and explicit examples; unsupported semantic checks should be unknown. Benchmark any text heuristic with multilingual fixtures and human review. These are proposed fairness controls, not guarantees of semantic understanding.

## Evidence states and arithmetic

Each check should expose its identifier, rubric version, weight, state, rationale, source URL, and observation time. Use these states:

- **Met / partial:** evidence supports the stated, narrow criterion; partial points require an explicit rule.
- **Not detected / unmet:** a successful, sufficiently complete inspection did not find the supported pattern. Say "not detected" for heuristics rather than making a universal absence claim.
- **Unknown:** request failure, insufficient permissions, rate limit, truncated listing, unavailable content, unsupported language, or insufficient sample.
- **Not applicable:** a documented applicability rule excludes the check. Do not infer N/A simply because evidence is missing.

Proposed arithmetic for applicable checks: let `w_i` be the maximum points, `x_i` the observed fraction from 0 to 1, `A` all applicable checks, `O` observed checks, and `U` unknown checks. N/A checks are outside `A`.

```text
observed score = 100 × sum(w_i × x_i, i in O) / sum(w_i, i in O)
evidence coverage = 100 × sum(w_i, i in O) / sum(w_i, i in A)
lower bound = 100 × sum(w_i × x_i, i in O) / sum(w_i, i in A)
upper bound = 100 × [sum(w_i × x_i, i in O) + sum(w_i, i in U)] / sum(w_i, i in A)
```

Suppress an observed score when its denominator is zero. Display coverage beside every headline score; a high score with low coverage is provisional. The bounds show only what unresolved checks could do under this rubric. They are **not statistical confidence intervals**, do not quantify heuristic error, and do not account for unexamined repositories or hidden private work. Avoid presenting deterministic rounding as precision beyond the evidence.

Prefer repository-level results and an explicitly labeled sample aggregate. Average sampled repositories equally unless another weighting policy is justified and visible. Keep repository-selection coverage separate from within-repository evidence coverage. Numeric confidence is not the same as accuracy.

## GitHub collection constraints

| API fact verified in official documentation                                                                                                                                                                                                                                                                 | Implication for CareerLens                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public user repositories are paginated; default page size is 30, maximum 100, with selectable sort order. [Repository API](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user)                                                                                                        | A single page is not a complete portfolio. Record fetched/listed/eligible/inspected counts and selection policy.                                                |
| Commit listing supports a branch or SHA, author filtering, and pagination. [Commit API](https://docs.github.com/en/rest/commits/commits#list-commits)                                                                                                                                                       | A recent default-branch sample is not lifetime activity. Repository commits can include other contributors; do not attribute all messages to the profile owner. |
| Recursive trees can be truncated at 100,000 entries or 7 MB. [Tree API](https://docs.github.com/en/rest/git/trees#get-a-tree)                                                                                                                                                                               | Preserve `truncated`; positive matches remain evidence, but absence in an incomplete tree is unknown.                                                           |
| Directory contents are capped at 1,000 entries; files over 1 MB have restricted response formats, and files over 100 MB are unsupported. Object responses for 1–100 MB files have empty content and `encoding: none`. [Contents API](https://docs.github.com/en/rest/repos/contents#get-repository-content) | Empty response content may mean unsupported retrieval, not an empty README. Validate encoding and size; mark uninspected content unknown.                       |
| Check runs are associated with a Git reference and have paginated results. [Checks API](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference)                                                                                                                                    | Associate observations with the inspected revision. A successful check may be unrelated to tests.                                                               |
| Workflow runs expose status/conclusion and branch, event, and head-SHA filters. [Actions API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository)                                                                                                                    | Distinguish configuration, queued/in-progress work, completed failure, and completed success. GitHub Actions history alone misses external CI.                  |

Unauthenticated REST requests share an IP-based budget of 60 per hour. Typical authenticated user requests have a 5,000-per-hour budget, with method-specific exceptions; secondary limits also apply. Inspect response rate headers, respect reset/retry timing, and never embed an application secret in browser code. [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

GitHub recommends serial requests, pagination through returned links, and conditional requests. Authenticated `304` responses can avoid primary-limit consumption. A `404` can represent inaccessible private resources rather than absence. Preserve failure reasons rather than converting every failure to an empty result. [GitHub API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)

## Sampling and reproducibility

These are implementation recommendations derived from the collection constraints:

1. Declare a fixed request budget and deterministic sample policy. A recent-push sample favors active projects; a star-ranked sample favors popular ones. Neither represents the whole profile without qualification.
2. State whether forks, archived projects, templates, empty projects, profile repositories, and organization repositories were excluded. Exclusions are scope choices, not negative evidence about the person.
3. Resolve and retain a default-branch commit SHA when possible, then inspect files and CI against that SHA. Record the request time, sampled repository IDs, commit counts, omissions, and rubric version.
4. Detect bots and generated/merge commits explicitly before message-quality heuristics. Do not reward sheer count, a specific commit convention, or English-only action words.
5. Bound requests, response sizes, pagination, and retries. Cancel stale searches and keep partial evidence visible. A network outage must change coverage, not silently turn passed checks into failed ones.
6. For deeper future analysis, parse ecosystem manifests and actual source with language-aware analyzers in an isolated backend. Never execute arbitrary fetched project code in the browser or app server simply to obtain a score.

## Validation needed before accuracy claims

Build a versioned, consent-respecting fixture set spanning languages, ecosystems, project sizes, educational repositories, mature stable tools, monorepos, generated code, external CI, and missing/error responses. Have independent reviewers label the narrowly defined checks, measure detection precision and recall per check, and investigate disagreement. Test weight sensitivity and publish known blind spots. A benchmark must distinguish detecting a practice from predicting software quality or human performance; the latter requires separate evidence.

Regression tests should establish deterministic results, bounded arithmetic, no NaN on empty samples, correct unknown/N/A handling, honest truncation behavior, multilingual handling, bot exclusion, and no score increase from adding stars or duplicate commits. These are correctness tests for the custom rubric, not proof of real-world predictive validity.

## Implemented v2 boundary

The current implementation uses custom weights: README 20, commit-message quality 15, code-maintenance practices 20, documentation 20, automation/stewardship 25. It pools earned and assessed check weights across selected repositories (so repositories with less observed evidence have less influence), displays independent category percentages, and withholds scores below 60% weighted coverage. These weights and the cutoff are product choices requiring calibration, not thresholds prescribed by these sources.

It inspects up to six recently pushed eligible repositories from one page of at most 100. Content sampling is deterministic across sorted paths, not statistically representative. It reads at most one README, two documentation files, three source files, 30 user-attributed commits, and 10 GitHub Actions runs per repository. Documentation that exists but is outside the read sample prevents a negative absence finding. Runs are reduced to the newest observed run per workflow; unresolved outcomes keep the outcome check unknown. No actual tests, linters, security scanners or builds are executed. No branch-protection, PR-review or external CI verification is implemented.

The aggregation model supports explicit N/A checks, but automatic checks currently use observed or unknown results rather than inferring that a practice is inapplicable from missing public evidence. The displayed range measures unresolved checks only; it does not measure hidden work, sampling error, heuristic error or developer ability. Tests validate arithmetic and collection behavior, not empirical predictive accuracy.

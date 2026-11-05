# Interview walkthrough

## AI test drafting

In this personal project, a local model drafts the behavior to exercise. The renderer converts its two allowed choices into a Playwright test using shared page objects and a disposable workspace. The eval checks a healthy baseline, a controlled regression, stable selectors, and cleanup.

A completion draft scored 3/4. It clicked Complete, but its assertion only checked whether the title remained visible. It passed even when the browser received a response that said the task was open. The worked revision asserted Completed and scored 4/4. The candidate stayed in the review folder. A person still needs to review the test and confirm the exact evaluated recipe before promotion.

This demonstrates how a green test can miss the behavior it claims to cover. The controlled regression gives the reviewer evidence that the revised assertion detects the failure.

# AI drafts and evals

Ollama proposes a small recipe from a sanitized change description or diff. A JSON schema limits its choices to a create, complete, or delete journey and one observation. A deterministic renderer supplies the task title, Playwright page objects, and workspace fixture. This supports the existing task journeys. A change that needs a new action or assertion still requires a person to extend the test code. See the [Ollama structured output documentation](https://docs.ollama.com/capabilities/structured-outputs).

## Run an example

Start a fresh disposable [Compose stack](../../README.md#run-the-full-app-locally) on port 8080 and install Chromium with `npx --no-install playwright install chromium`. Use Node 22.23.1 and Ollama 0.40.11 on loopback port 11434. Use `ollama serve` if the local server is stopped. Install `llama3.2:latest` with `ollama pull llama3.2:latest` if it is missing. The CLI checks the installed digest `a80c4f17acd55265feec403c7aef86be0c25983ab279d83f3bcd3abbcb5b8b72` and rejects remote model entries. [Ollama model reference](https://ollama.com/library/llama3.2)

```sh
npm run test:ai -- generate tests/ai-evals/example-change.txt
REVIEW_ID='<id printed by generate>'
npm run test:ai -- eval "$REVIEW_ID" complete
```

Generation writes `recipe.json` and a readable `draft.spec.js` into `.local/ai-evals/review/$REVIEW_ID/`. It does not run a test or add one to the main suite. The eval runs only when requested. It saves the per-run Playwright JSON under `.local/ai-evals/runs/` and appends scores to `.local/ai-evals/scores.jsonl`. An incomplete score exits with status 1.

| Criterion | One point when |
| --- | --- |
| Runs | The test passes against the healthy stack. |
| Intended behavior | The independently selected regression reaches the browser and fails the corresponding assertion. |
| Stable selectors | The renderer uses the existing role and label based page objects. The model cannot supply selectors. |
| Cleanup | The API confirms both synthetic workspaces are gone after the baseline and regression runs. |

## Worked revision

The complete [worked example](worked-example.md) includes the actual model recipe, rendered draft, observed scores, and full revised candidate.

The example requires the task to switch to Completed and stay visible. The local model returned `{"journey":"complete","observation":"visible"}`. The generated test clicked Complete and asserted that the row was still visible. It passed against the healthy app and also passed when the eval rewrote the PATCH response to report `completed: false`. Both workspaces were deleted. The draft scored **3/4** because it missed the regression.

The worked revision changed `observation` to `completed` in `recipe.json`. It rendered this final assertion.

```js
await expect(tasks.row(title).getByText('Completed', { exact: true }), 'intent:completed').toBeVisible();
```

The revision passed the baseline, failed that assertion under the controlled regression, and confirmed both workspaces were gone. It scored **4/4**. The promotion preview was verified, and the revision remains outside the main suite.

## Human review gate

After editing `recipe.json`, run the eval again for the same intended behavior. A score of 4/4 qualifies a draft for review. Check the selector stability, data isolation, flake risk, and whether the assertion covers the critical journey. Review whether the case adds coverage beyond the existing suite.

```sh
npm run test:ai -- eval "$REVIEW_ID" complete
npm run test:ai -- promote "$REVIEW_ID" --dry-run
```

If you approve the exact candidate, run `npm run test:ai -- promote "$REVIEW_ID"` in a terminal and type the full confirmation phrase it prints. It checks the evaluated recipe digest and creates one new file without overwriting an existing test. Run the main browser suite after promotion and review the Git diff before committing.

Use synthetic change text and strip credentials, customer data, and internal URLs before sending it to the model. The CLI rejects common secret markers. Recipe fields are enums, so source text cannot enter the generated test. The renderer uses a fixed synthetic title and blocks browser traffic outside the configured local origin. The eval uses only the disposable app on loopback and the existing fixture for cleanup.

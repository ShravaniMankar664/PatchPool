import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";

const rpcUrl = process.env.PATCHPOOL_E2E_RPC_URL ?? "http://127.0.0.1:18545";
const screenshotOptions = { style: "nextjs-portal { display: none !important; }" };

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json() as { result?: unknown; error?: { message?: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `${method} failed`);
  return payload.result;
}

async function useInjectedLocalWallet(page: Page) {
  await page.addInitScript(({ endpoint }) => {
    let selectedIndex = 0;
    const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
    let requestId = 1;
    async function send(method: string, params: unknown[] = []) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: requestId++, method, params }),
      });
      const payload = await response.json();
      if (payload.error) throw Object.assign(new Error(payload.error.message), payload.error);
      return payload.result;
    }
    const provider = {
      isMetaMask: true,
      request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts") {
          const accounts = await send("eth_accounts") as string[];
          return accounts[selectedIndex] ? [accounts[selectedIndex]] : [];
        }
        if (method === "eth_chainId") return send("eth_chainId");
        if (method === "wallet_requestPermissions") {
          const permissions = params[0] as Record<string, unknown> | undefined;
          if (!permissions || Object.keys(permissions).some((name) => name !== "eth_accounts")) {
            throw new Error("Local E2E wallet only grants the eth_accounts permission");
          }
          return [{ parentCapability: "eth_accounts", caveats: [] }];
        }
        if (method === "wallet_switchEthereumChain") {
          const requested = (params[0] as { chainId?: string } | undefined)?.chainId;
          if (requested !== "0x7a69") throw new Error("Local E2E wallet only supports chain 31337");
          return null;
        }
        return send(method, params);
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      },
      removeListener: (event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, (handlers.get(event) ?? []).filter((item) => item !== handler));
      },
      emit: (event: string, ...args: unknown[]) => (handlers.get(event) ?? []).forEach((handler) => handler(...args)),
    };
    Object.defineProperty(window, "ethereum", { configurable: false, value: provider });
    Object.defineProperty(window, "__patchPoolTestWallet", {
      value: {
        accounts: () => send("eth_accounts"),
        select: async (index: number) => {
          selectedIndex = index;
          const accounts = await send("eth_accounts") as string[];
          provider.emit("accountsChanged", accounts[index] ? [accounts[index]] : []);
          return accounts[index];
        },
      },
    });
  }, { endpoint: rpcUrl });
}

function localDateInput(secondsFromNow: number): string {
  const date = new Date(Date.now() + secondsFromNow * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function createLocalBounty(page: Page, input: { title: string; description: string; reward: string; reviewer: string; submissionIn: number; settlementIn: number; verifyDraftBack?: boolean }) {
  await page.locator("#task-title").fill(input.title);
  await page.locator("#task-description").fill(input.description);
  await page.getByRole("button", { name: "Continue to reward" }).click();
  await page.locator("#reward").fill(input.reward);
  await page.locator("#reviewer").fill(input.reviewer);
  await page.locator("#submission-deadline").fill(localDateInput(input.submissionIn));
  await page.locator("#settlement-deadline").fill(localDateInput(input.settlementIn));
  if (input.verifyDraftBack) {
    await page.getByRole("button", { name: "← Back to task details" }).click();
    await expect(page.locator("#task-title")).toHaveValue(input.title);
    await expect(page.locator("#task-description")).toHaveValue(input.description);
    await page.getByRole("button", { name: "Continue to reward" }).click();
  }
  await page.getByRole("button", { name: "Review bounty" }).click();
  await expect(page.locator(".terms-summary")).toContainText(input.title);
  await expect(page.locator(".terms-summary")).toContainText(input.reward);
  if (input.verifyDraftBack) {
    await page.locator("#create").screenshot({ path: "/tmp/patchpool-create-review-desktop.png" });
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator("#create").screenshot({ path: "/tmp/patchpool-create-review-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole("button", { name: "Create & fund bounty" }).click();
}

async function selectAccount(page: Page, index: number) {
  await page.evaluate(async (accountIndex) => {
    const wallet = (window as unknown as { __patchPoolTestWallet: { select: (value: number) => Promise<string> } }).__patchPoolTestWallet;
    return wallet.select(accountIndex);
  }, index);
}

async function openBountyDetails(card: Locator) {
  const details = card.locator("details.bounty-card-details");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
  await expect(details).toHaveAttribute("open", "");
}

async function captureViewportAt(page: Page, selector: string, path: string, topInset: number) {
  await page.evaluate(({ target, inset }) => {
    const element = document.querySelector(target);
    if (!element) throw new Error(`Cannot capture missing section ${target}`);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, element.getBoundingClientRect().top + window.scrollY - inset));
  }, { target: selector, inset: topInset });
  await page.screenshot({ path, ...screenshotOptions });
}

test("funds, submits, reviews, pays the bound recipient, and refunds an expired open bounty", async ({ page }) => {
  const requestBodies: Buffer[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedLocalRequests: string[] = [];
  const localResponses: string[] = [];
  page.on("request", (request) => {
    const body = request.postDataBuffer();
    if (body) requestBodies.push(body);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith("http://127.0.0.1:")) failedLocalRequests.push(`${request.url()} · ${request.failure()?.errorText ?? "failed"}`);
  });
  page.on("response", (response) => {
    if (response.url().startsWith("http://127.0.0.1:") && response.status() >= 400) {
      localResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  await useInjectedLocalWallet(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Be part of the first funded fix." })).toBeVisible();
  await expect(page.getByText("No active bounties are available yet.")).toBeVisible();
  await captureViewportAt(page, "#bounties", "/tmp/patchpool-marketplace-desktop-empty.png", 96);
  await page.setViewportSize({ width: 390, height: 844 });
  await captureViewportAt(page, "#bounties", "/tmp/patchpool-marketplace-mobile-empty.png", 145);
  await page.setViewportSize({ width: 1440, height: 900 });

  const accounts = await page.evaluate(async () => {
    const wallet = (window as unknown as { __patchPoolTestWallet: { accounts: () => Promise<string[]> } }).__patchPoolTestWallet;
    return wallet.accounts();
  });
  expect(accounts.length).toBeGreaterThanOrEqual(5);

  await page.getByRole("button", { name: /^Connect / }).first().click();
  await expect(page.getByText(/Local E2E · NOT MST/i).first()).toBeVisible();

  await createLocalBounty(page, {
    title: "Fix token balance rounding",
    description: "Balances must round down consistently; include a regression test.",
    reward: "0.25",
    reviewer: accounts[1],
    submissionIn: 180,
    settlementIn: 300,
    verifyDraftBack: true,
  });
  await expect(page.getByText("Confirmed bounty ID: #1")).toBeVisible();
  const firstBounty = page.locator("article.stat-card").filter({ hasText: "BOUNTY #1" });
  await openBountyDetails(firstBounty);
  await expect(firstBounty.getByText("Fix token balance rounding")).toBeVisible();
  await expect(firstBounty.getByText(/The creator and contributors cannot submit work for this bounty/)).toBeVisible();
  await expect(firstBounty.getByText("Individual · one sponsor")).toBeVisible();
  await expect(firstBounty.getByText(/Terms locked: The contract records the task digest/)).toBeVisible();
  await expect(firstBounty.getByText("Funded 0.25 local ETH")).toBeVisible();
  await selectAccount(page, 1);
  await openBountyDetails(firstBounty);
  await expect(firstBounty.getByRole("button", { name: "Add contribution" })).toBeDisabled();
  await expect(firstBounty.getByText("The assigned reviewer cannot fund this bounty.")).toBeVisible();
  await selectAccount(page, 4);
  await openBountyDetails(firstBounty);
  await firstBounty.getByLabel("Add to this shared bounty (local ETH)").fill("0.15");
  await firstBounty.getByRole("button", { name: "Add contribution" }).click();
  await expect(page.getByText(/Contribute to bounty #1: Confirmed on-chain/)).toBeVisible();
  await expect(firstBounty.locator(".form-grid > div").filter({ hasText: "TOTAL ESCROWED POOL" }).locator("strong")).toHaveText("0.4 local ETH");
  await expect(firstBounty.locator(".form-grid > div").filter({ hasText: "THIS WALLET CONTRIBUTED" }).locator("strong")).toHaveText("0.15 local ETH");
  await expect(firstBounty.getByText("Shared · 2 contributors")).toBeVisible();
  await expect(firstBounty.getByText(/added 0.15 local ETH · pool 0.4 local ETH/)).toBeVisible();
  await page.locator("#bounty-search").fill("rounding");
  await page.locator("#bounty-status").selectOption("0");
  await expect(firstBounty).toBeVisible();
  await page.locator("#bounty-status").selectOption("2");
  await expect(firstBounty).toHaveCount(0);
  await page.locator("#bounty-status").selectOption("all");
  await page.locator("#bounty-search").fill("");

  await selectAccount(page, 2);
  await page.goto("/contributor?bounty=1&action=submit");
  await selectAccount(page, 2);
  await expect(page.getByRole("heading", { name: /Submit to Fix token balance rounding/ })).toBeVisible();
  await expect(page.locator(".role-action-context").getByText(/Balances must round down consistently/)).toBeVisible();
  await page.locator("#workspace-commit-1").fill("1234567890abcdef1234567890abcdef12345678");
  const evidenceText = "PatchPool E2E evidence: all regression checks passed.";
  const evidenceDigest = `0x${createHash("sha256").update(evidenceText).digest("hex")}`;
  await page.locator("#workspace-evidence-hash-1").fill(evidenceDigest);
  await page.locator("#workspace-payee-1").fill(accounts[3]);
  await page.getByRole("button", { name: "Review submission" }).click();
  await expect(page.getByText(/CHECK BEFORE WALLET CONFIRMATION/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm and submit" }).click();
  await expect(page.getByText(/Confirmed on-chain\. The workspace has refreshed/)).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/patchpool-contributor-submit-confirmed-desktop.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/patchpool-contributor-submit-confirmed-mobile.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "View my submissions" }).click();
  await expect(page.getByRole("heading", { name: "Find the fix worth shipping." })).toBeVisible();
  await expect(page.getByText("LOCAL E2E · NOT MST ACTIVITY")).toBeVisible();
  await page.getByRole("tab", { name: /My submissions/ }).click();
  const contributorSubmission = page.locator("article.role-work-card").filter({ hasText: "BOUNTY #1" });
  await expect(contributorSubmission).toBeVisible();
  await expect(contributorSubmission.getByText("Awaiting review")).toBeVisible();
  await contributorSubmission.locator(".role-submission-detail summary").click();
  await expect(contributorSubmission.getByText("Evidence files are off-chain.")).toBeVisible();
  for (const width of [1280, 1024, 768, 360]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `contributor workspace overflow at ${width}px`).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "/tmp/patchpool-contributor-workspace-desktop.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/patchpool-contributor-workspace-mobile.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/reviewer");
  await selectAccount(page, 1);
  await expect(page.getByRole("heading", { name: "Review work with the full context." })).toBeVisible();
  const reviewerSubmission = page.locator("article.role-work-card").filter({ hasText: "BOUNTY #1" });
  await expect(reviewerSubmission).toBeVisible();
  await expect(reviewerSubmission.getByText("Compare task requirements and submitted evidence")).toBeVisible();
  await reviewerSubmission.locator(".role-submission-detail summary").click();
  await reviewerSubmission.getByRole("button", { name: "Inspect and decide" }).click();
  await expect(page.getByRole("heading", { name: /Submission #1 · Fix token balance rounding/ })).toBeVisible();
  await expect(page.getByText(/does not prove the evidence is truthful/)).toBeVisible();
  await page.getByRole("button", { name: "Choose rejection" }).click();
  await expect(page.getByText(/This submission becomes rejected/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByText(/Confirmed on-chain\. The workspace has refreshed/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/patchpool-reviewer-decision-confirmed-desktop.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/patchpool-reviewer-decision-confirmed-mobile.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const width of [1280, 1024, 768, 360]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `reviewer workspace overflow at ${width}px`).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "/tmp/patchpool-reviewer-workspace-desktop.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/patchpool-reviewer-workspace-mobile.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await selectAccount(page, 2);
  await openBountyDetails(firstBounty);

  const evidenceCheck = firstBounty.locator('input[type="file"][id^="evidence-check-"]');
  const requestCountBeforeLocalHashing = requestBodies.length;
  await evidenceCheck.setInputFiles({ name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from(evidenceText) });
  await expect(firstBounty.getByRole("status").filter({ hasText: "MATCH" })).toBeVisible();
  await expect(firstBounty.getByText(/mismatch detects changed bytes, not whether the evidence is truthful/i)).toBeVisible();
  await evidenceCheck.setInputFiles({ name: "tampered-evidence.txt", mimeType: "text/plain", buffer: Buffer.from(`${evidenceText} changed`) });
  await expect(firstBounty.getByRole("status").filter({ hasText: "MISMATCH" })).toBeVisible();
  const requestBytesAfterLocalHashing = Buffer.concat(requestBodies.slice(requestCountBeforeLocalHashing));
  expect(requestBytesAfterLocalHashing.includes(Buffer.from(evidenceText))).toBe(false);

  await page.goto("/contributor?bounty=1&action=submit");
  await selectAccount(page, 2);
  await page.locator("#workspace-commit-1").fill("abcdef1234567890abcdef1234567890abcdef12");
  await page.locator("#workspace-evidence-hash-1").fill(evidenceDigest);
  await page.locator("#workspace-payee-1").fill(accounts[3]);
  await page.getByRole("button", { name: "Review submission" }).click();
  await page.getByRole("button", { name: "Confirm and submit" }).click();
  await expect(page.getByText(/Confirmed on-chain\. The workspace has refreshed/)).toBeVisible();

  await page.goto("/reviewer?bounty=1&submission=2");
  await selectAccount(page, 1);
  await expect(page.getByRole("heading", { name: /Submission #2 · Fix token balance rounding/ })).toBeVisible();
  await page.getByRole("button", { name: "Choose approval" }).click();
  await expect(page.getByText(/Reward release remains a separate transaction/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(page.getByText(/Confirmed on-chain\. The workspace has refreshed/)).toBeVisible();
  await page.goto("/");
  await selectAccount(page, 1);
  await openBountyDetails(firstBounty);
  await expect(firstBounty.getByText("Approved", { exact: true })).toBeVisible();
  await expect(firstBounty.getByText("Submission #2 approved")).toBeVisible();
  await expect(firstBounty.getByText("Reward: 0.4 local ETH →")).toBeVisible();

  const beforePayeeBalance = BigInt(await rpc("eth_getBalance", [accounts[3], "latest"]) as string);
  await selectAccount(page, 4);
  await openBountyDetails(firstBounty);
  await firstBounty.getByRole("button", { name: "Release reward" }).click();
  await expect(page.getByText(/Release bounty #1: Confirmed on-chain/)).toBeVisible();
  await expect(firstBounty.getByText("Paid", { exact: true })).toBeVisible();
  await expect(firstBounty.getByText("Reward released: 0.4 local ETH")).toBeVisible();
  const afterPayeeBalance = BigInt(await rpc("eth_getBalance", [accounts[3], "latest"]) as string);
  expect(afterPayeeBalance - beforePayeeBalance).toBe(BigInt("400000000000000000"));
  await page.locator("#bounty-status").selectOption("2");
  await expect(firstBounty).toBeVisible();
  await page.locator("#bounty-status").selectOption("all");

  await selectAccount(page, 0);
  await createLocalBounty(page, {
    title: "Refund untouched expired bounty",
    description: "This second bounty intentionally receives no submission.",
    reward: "0.1",
    reviewer: accounts[1],
    submissionIn: 60,
    settlementIn: 120,
  });
  await expect(page.getByText("Confirmed bounty ID: #2")).toBeVisible();
  const secondBounty = page.locator("article.stat-card").filter({ hasText: "BOUNTY #2" });
  await openBountyDetails(secondBounty);
  await selectAccount(page, 4);
  await openBountyDetails(secondBounty);
  await secondBounty.getByLabel("Add to this shared bounty (local ETH)").fill("0.05");
  await secondBounty.getByRole("button", { name: "Add contribution" }).click();
  await expect(page.getByText(/Contribute to bounty #2: Confirmed on-chain/)).toBeVisible();
  await expect(secondBounty.locator(".form-grid > div").filter({ hasText: "THIS WALLET CONTRIBUTED" }).locator("strong")).toHaveText("0.05 local ETH");
  await selectAccount(page, 0);
  await openBountyDetails(secondBounty);
  await expect(secondBounty.getByText("Open", { exact: true })).toBeVisible();

  await rpc("evm_increaseTime", [8 * 24 * 60 * 60]);
  await rpc("evm_mine");
  await page.reload();
  await expect(page.getByText(/Local E2E · NOT MST/i).first()).toBeVisible();
  const refreshedSecondBounty = page.locator("article.stat-card").filter({ hasText: "BOUNTY #2" });
  await openBountyDetails(refreshedSecondBounty);
  await expect(refreshedSecondBounty.getByText("Open", { exact: true })).toBeVisible();
  await expect(refreshedSecondBounty.getByRole("button", { name: "Claim my expired contribution" })).toBeVisible();

  await selectAccount(page, 2);
  await page.reload();
  // The injected test provider is recreated on navigation, so reselect the
  // contributor after reload before asserting address-specific eligibility.
  await selectAccount(page, 2);
  const developerView = page.locator("article.stat-card").filter({ hasText: "BOUNTY #2" });
  await openBountyDetails(developerView);
  await expect(developerView.getByRole("button", { name: "Claim my expired contribution" })).toHaveCount(0);
  await selectAccount(page, 0);
  const sponsorView = page.locator("article.stat-card").filter({ hasText: "BOUNTY #2" });
  await openBountyDetails(sponsorView);
  await sponsorView.getByRole("button", { name: "Claim my expired contribution" }).click();
  await expect(page.getByText(/Refund contribution for bounty #2: Confirmed on-chain/)).toBeVisible();
  await expect(sponsorView.getByText("Refunding", { exact: true })).toBeVisible();
  await expect(sponsorView.getByText("0.05 local ETH", { exact: true })).toBeVisible();
  await expect(sponsorView.getByText(/claimed 0.1 local ETH/)).toBeVisible();
  await selectAccount(page, 4);
  await openBountyDetails(sponsorView);
  await sponsorView.getByRole("button", { name: "Claim my expired contribution" }).click();
  await expect(page.getByText(/Refund contribution for bounty #2: Confirmed on-chain/)).toBeVisible();
  await expect(sponsorView.getByText("Refunded", { exact: true })).toBeVisible();
  await expect(sponsorView.getByText(/claimed 0.05 local ETH/)).toBeVisible();
  await expect(sponsorView.getByText("Refunded 0.15 local ETH")).toBeVisible();

  expect(pageErrors, "browser page errors").toEqual([]);
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(failedLocalRequests, "failed local requests").toEqual([]);
  expect(localResponses, "local HTTP error responses").toEqual([]);
});

// Runs after the lifecycle test and reads its real local on-chain bounty in a fresh, wallet-free page.
test("public bounty information is readable before wallet connection", async ({ page }) => {
  const rpcMethods: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedLocalRequests: string[] = [];
  const localResponses: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(rpcUrl) || !request.postData()) return;
    try {
      const payload = request.postDataJSON() as { method?: string } | Array<{ method?: string }>;
      for (const item of Array.isArray(payload) ? payload : [payload]) {
        if (item.method) rpcMethods.push(item.method);
      }
    } catch {
      pageErrors.push("Could not inspect local read-only RPC request");
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith("http://127.0.0.1:") && request.failure()?.errorText !== "net::ERR_ABORTED") failedLocalRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.url().startsWith("http://127.0.0.1:") && response.status() >= 400) {
      localResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Connect / }).first()).toBeVisible();
  const firstBounty = page.locator("article.stat-card").filter({ hasText: "BOUNTY #1" });
  await expect(firstBounty).toBeVisible();
  await expect(firstBounty.getByText("Fix token balance rounding")).toBeVisible();
  await expect(firstBounty.getByText("Balances must round down consistently; include a regression test.")).toBeVisible();
  await expect(firstBounty.locator(".bounty-card-reward strong")).toHaveText("0.4 local ETH");
  await expect(firstBounty.locator(".bounty-card-details")).not.toHaveAttribute("open", "");
  await firstBounty.getByRole("link", { name: "View bounty details" }).click();
  await expect(page).toHaveURL(/\/bounties\/1$/);
  await expect(page.getByRole("heading", { name: "Fix token balance rounding" })).toBeVisible();
  await expect(page.locator(".detail-reward-panel > strong")).toHaveText("0.4 local ETH");
  await expect(page.getByRole("heading", { name: /Work submitted 2/ })).toBeVisible();
  await expect(page.locator(".detail-evidence-note").first()).toContainText("Evidence files are off-chain.");
  await page.screenshot({ path: "/tmp/patchpool-bounty-detail-desktop.png", fullPage: true, ...screenshotOptions });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/patchpool-bounty-detail-mobile.png", fullPage: true, ...screenshotOptions });
  await page.getByRole("link", { name: "Open action workspace" }).click();
  await expect(page).toHaveURL(/\?bounty=1#bounties$/);
  await expect(page.locator("#bounty-search")).toHaveValue("1");
  await expect(page.locator("article.bounty-card").filter({ hasText: "BOUNTY #1" }).locator("details.bounty-card-details")).toHaveAttribute("open", "");
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureViewportAt(page, "#bounties", "/tmp/patchpool-marketplace-desktop-local-records.png", 96);
  await page.locator("#bounty-sort").selectOption("reward-high");
  await expect(page.locator(".marketplace-list article").first()).toContainText("BOUNTY #1");
  await page.locator("#bounty-sort").selectOption("reward-low");
  await expect(page.locator(".marketplace-list article").first()).toContainText("BOUNTY #2");
  await page.locator("#bounty-sort").selectOption("newest");
  await page.locator("#bounty-search").fill("rounding");
  await expect(page.locator(".marketplace-list article")).toHaveCount(1);
  await captureViewportAt(page, "#bounties", "/tmp/patchpool-marketplace-search-filter.png", 96);
  await page.locator("#bounty-search").fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await captureViewportAt(page, "#bounties", "/tmp/patchpool-marketplace-mobile-local-records.png", 145);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByText(/connect a wallet for your workspace/i)).toBeVisible();
  expect(rpcMethods).toContain("eth_call");
  expect(rpcMethods.filter((method) => /^(eth_send|eth_sign|personal_sign|wallet_send)/.test(method))).toEqual([]);
  expect(pageErrors, "browser page errors").toEqual([]);
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(failedLocalRequests, "failed local requests").toEqual([]);
  expect(localResponses, "local HTTP error responses").toEqual([]);
});

test("marketplace distinguishes a local RPC failure from an empty registry and retries", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(rpcUrl, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "We couldn’t reach the bounty registry." })).toBeVisible({ timeout: 30_000 });
  await captureViewportAt(page, "#bounties", "/tmp/patchpool-marketplace-rpc-error.png", 96);
  await page.unroute(rpcUrl);
  await page.getByRole("button", { name: "Retry read" }).click();
  await expect(page.locator("article.bounty-card").first()).toBeVisible({ timeout: 30_000 });
});

test("local BridgeKey deployment tool shows compiled artifact and stays gated before wallet preflight", async ({ page }) => {
  const transactionMethods: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(rpcUrl) || !request.postData()) return;
    try {
      const payload = request.postDataJSON() as { method?: string } | Array<{ method?: string }>;
      for (const item of Array.isArray(payload) ? payload : [payload]) {
        if (item.method && /^(eth_send|eth_sign|personal_sign|wallet_send)/.test(item.method)) {
          transactionMethods.push(item.method);
        }
      }
    } catch {
      transactionMethods.push("unreadable-rpc-request");
    }
  });

  await page.goto("/deploy/testnet");
  await expect(page.getByRole("heading", { name: "Deploy PatchPool with BridgeKey" })).toBeVisible();
  await expect(page.getByText(/PatchPool · contracts\/PatchPool.sol · no constructor arguments/)).toBeVisible();
  await expect(page.getByText(/91562037/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Run deployment preflight" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Request BridgeKey deployment approval" })).toHaveCount(0);
  expect(transactionMethods).toEqual([]);
});

test("homepage hierarchy and layout hold at desktop and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Fund the fix\. Verify the work\. Release the reward\./ })).toBeVisible();
  await page.screenshot({ path: "/tmp/patchpool-desktop-hero.png", ...screenshotOptions });
  await expect(page.getByText("Security model and limitations", { exact: true })).toBeVisible();
  await page.getByText("Security model and limitations", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /What the contract guarantees/ })).toBeVisible();
  await expect(page.getByText(/Local E2E · NOT MST/i).first()).toBeVisible();
  await expect(page.getByText("Not a live bounty", { exact: true })).toBeVisible();
  await expect(page.locator(".protocol-count strong")).toHaveText(/^\d+$/);
  await expect(page.locator(".protocol-writes")).toContainText("Configured");
  await expect(page.locator(".protocol-writes")).toContainText("Local E2E cannot access Mainnet writes");
  await expect(page.getByText(/Mainnet writes are disabled by configuration/)).toHaveCount(0);
  await expect(page.locator("article.stat-card").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const [selector, filename] of [[".protocol-overview", "protocol"], ["#trail", "workflow"], ["#bounties", "marketplace"], ["#create", "create"], ["#collective", "shared-funding"], ["#trust", "trust"], [".site-footer", "footer"]]) {
    await captureViewportAt(page, selector, `/tmp/patchpool-desktop-${filename}.png`, 96);
  }
  await page.screenshot({ path: "/tmp/patchpool-desktop.png", fullPage: true, ...screenshotOptions });

  for (const width of [1280, 1024, 768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  // Navigate from a fresh document so browser scroll restoration from the
  // preceding desktop section captures cannot shift the mobile hero screenshot.
  await page.goto("about:blank");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Fund the fix\. Verify the work\. Release the reward\./ })).toBeVisible();
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0); });
  await page.waitForFunction(() => window.scrollY === 0);
  await expect(page.locator(".topbar")).toBeInViewport();
  await page.screenshot({ path: "/tmp/patchpool-mobile-home.png", ...screenshotOptions });
  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await menuButton.click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.locator(".topbar").screenshot({ path: "/tmp/patchpool-mobile-navigation.png", ...screenshotOptions });
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How it works" }).click();
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".protocol-count strong")).toHaveText(/^\d+$/);
  await expect(page.locator("article.stat-card").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: /Fund the fix\. Verify the work\. Release the reward\./ })).toBeVisible();
  for (const [selector, filename] of [["#bounties", "marketplace"], ["#create", "create"], ["#collective", "shared-funding"], ["#trust", "trust"]]) {
    await captureViewportAt(page, selector, `/tmp/patchpool-mobile-${filename}.png`, 145);
  }
  await page.screenshot({ path: "/tmp/patchpool-mobile.png", fullPage: true, ...screenshotOptions });
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.matches(":focus-visible"))).toBe(true);
});

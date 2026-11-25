import { LoginCancelledError } from "@oh-my-pi/pi-ai/error";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { openPath } from "@oh-my-pi/pi-coding-agent/utils/open";
import type { ChatGPTAccount, DriveAuthPresenter, DriveCore } from "./types";

const MANUAL_INPUT_PROMPT = "Paste the authorization code (or full redirect URL):";

/**
 * ChatGPT sign-in through OMP's extension UI: a notice with the full authorization URL (usable from
 * another machine) and the loopback `launchUrl` as a local shortcut, then a paste prompt for the
 * redirect URL, which wins whenever the loopback callback cannot reach this machine (SSH, containers,
 * remote hosts). The TUI also opens the browser, as OMP's own `/login openai-codex` does.
 */
export async function runDriveLogin(ctx: ExtensionContext, core: DriveCore, signal?: AbortSignal): Promise<ChatGPTAccount> {
 if (!ctx.hasUI) throw new Error("ChatGPT sign-in needs an interactive OMP session; run `/gdrive login` there.");

 const presenter: DriveAuthPresenter = {
  onAuth({ url, launchUrl, instructions }) {
   const lines = ["Open this URL in your browser to sign in to ChatGPT for Google Drive:", url];
   if (launchUrl && launchUrl !== url) lines.push(`Local shortcut (this machine only): ${launchUrl}`);
   if (instructions) lines.push(instructions);
   ctx.ui.notify(lines.join("\n"), "info");
   if (ctx.mode === "tui") openPath(url);
  },
  onProgress: message => ctx.ui.notify(message, "info"),
  async onManualCodeInput(inputSignal) {
   const value = await ctx.ui.input(MANUAL_INPUT_PROMPT, "http://localhost:1455/auth/callback?code=…", {
    ...(inputSignal ? { signal: inputSignal } : {}),
   });
   if (value === undefined) throw new LoginCancelledError();
   return value;
  },
  ...(signal ? { signal } : {}),
 };
 return core.login(presenter);
}

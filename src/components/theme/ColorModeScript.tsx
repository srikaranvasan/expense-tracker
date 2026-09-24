import { colorModeScriptSource } from "@/theme/color-mode";

/**
 * The no-flash script, rendered into `<head>`.
 *
 * A Server Component that emits one synchronous inline `<script>`. It must be inline and it
 * must not be deferred: the `dark` class has to be on `<html>` before the browser paints
 * anything, and both `async` and `defer` push execution past first paint.
 *
 * `dangerouslySetInnerHTML` is the only way React will emit raw script text. It is safe
 * here in the way that matters — the content is a constant built from module-level
 * constants in `src/theme/color-mode.ts`, with no request data, no user data and no props
 * reaching it, so there is nothing to inject. That is worth stating explicitly rather than
 * leaving a reader to check.
 *
 * Next's `<Script strategy="beforeInteractive">` is the more idiomatic choice and is wrong
 * here: it still loads as a separate resource in the App Router, which is a round trip
 * during which the page is already visible.
 */
export function ColorModeScript() {
  return <script dangerouslySetInnerHTML={{ __html: colorModeScriptSource() }} />;
}

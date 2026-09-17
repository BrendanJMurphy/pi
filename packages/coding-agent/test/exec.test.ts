import { describe, expect, it } from "vitest";
import { execCommand } from "../src/core/exec.ts";

function nodeArgs(script: string): string[] {
	return ["-e", script];
}

describe("execCommand", () => {
	it("returns stdout, stderr, and the exit code of a normal exit", async () => {
		const result = await execCommand(
			process.execPath,
			nodeArgs("process.stdout.write('out'); process.stderr.write('err'); process.exit(3)"),
			process.cwd(),
		);

		expect(result).toEqual({ stdout: "out", stderr: "err", code: 3, killed: false });
	});

	// Regression tests for signal-killed commands reporting success, found alongside
	// https://github.com/earendil-works/pi/issues/9577
	it.skipIf(process.platform === "win32")(
		"maps a command killed by an external signal to 128 + signal number",
		async () => {
			for (const { signal, code } of [
				{ signal: "SIGKILL", code: 128 + 9 },
				{ signal: "SIGTERM", code: 128 + 15 },
			]) {
				const result = await execCommand(
					process.execPath,
					nodeArgs(`process.stdout.write('before-kill'); process.kill(process.pid, '${signal}')`),
					process.cwd(),
				);

				expect(result).toEqual({ stdout: "before-kill", stderr: "", code, killed: false });
			}
		},
	);

	it.skipIf(process.platform === "win32")(
		"reports a non-zero exit code when a timeout kills the command",
		async () => {
			const result = await execCommand(process.execPath, nodeArgs("setInterval(() => {}, 1000)"), process.cwd(), {
				timeout: 50,
			});

			expect(result.killed).toBe(true);
			expect(result.code).toBe(128 + 15);
		},
	);
});

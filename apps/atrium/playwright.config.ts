import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.ATRIUM_SMOKE_PORT ?? 5050);
const host = process.env.ATRIUM_SMOKE_HOST ?? '127.0.0.1';
const baseURL = `http://${host}:${port}`;

export default defineConfig({
	testDir: './tests/smoke',
	fullyParallel: false,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	reporter: [['list']],
	use: {
		baseURL,
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: `npx vite dev --host ${host} --port ${port}`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});

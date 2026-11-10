.PHONY: up
up:
	cd frontend && pnpm install --frozen-lockfile && pnpm build
	docker compose up --build

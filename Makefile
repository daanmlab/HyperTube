.PHONY: up down logs api web db redis watch rebuild-api rebuild-web rebuild-worker fresh-rebuild

up:
	@docker compose up --build

down:
	@docker compose down

logs:
	@docker compose logs -f

watch:
	@docker compose watch

rebuild-api:
	@echo "🔄 Rebuilding backend service..."
	@docker compose up --build -d api

rebuild-web:
	@echo "🔄 Rebuilding frontend service..."
	@docker compose up --build -d web

rebuild-worker:
	@echo "🔄 Rebuilding worker service..."
	@docker compose up --build -d worker

fresh-rebuild:
	@echo "🧹 Fresh rebuild with new dependencies..."
	@docker compose down
	@docker compose build --no-cache
	@docker compose up -d

api:
	@docker compose exec api sh

web:
	@docker compose exec web sh

db:
	@docker compose exec db psql -U $$POSTGRES_USER $$POSTGRES_DB

redis:
	@docker compose exec redis redis-cli

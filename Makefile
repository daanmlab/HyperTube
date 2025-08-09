.PHONY: up down logs api web db redis

up:
@docker compose up --build

down:
@docker compose down

logs:
@docker compose logs -f

api:
@docker compose exec api sh

web:
@docker compose exec web sh

db:
@docker compose exec db psql -U $$POSTGRES_USER $$POSTGRES_DB

redis:
@docker compose exec redis redis-cli

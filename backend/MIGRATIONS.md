# Alembic Migrations Guide (IPL Fantasy)

This guide outlines the standard workflow for database schema changes and how to recover from common "revision out of sync" errors.

## 🚀 Standard Workflow
When you modify `backend/models.py`, follow these steps to update the database:

1. **Generate Revision**:
   ```bash
   docker compose exec backend alembic revision --autogenerate -m "describe your changes"
   ```
2. **Apply Migration**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

---

## 🛠️ Troubleshooting & Recovery
If you encounter errors like `Can't locate revision identified by 'xxxxxx'`, it means your database's `alembic_version` table is pointing to a migration file that no longer exists in `migrations/versions/`.

### 🚨 The "Revision Out of Sync" Fix
If you have accidentally deleted migration files or are in an inconsistent state:

1. **Clear the Version Record**:
   You need to drop the `alembic_version` table. Since it's SQLite in dev, run this from the project root:
   ```bash
   sqlite3 backend/database_dev.db "DROP TABLE IF EXISTS alembic_version;"
   ```
   *(If `sqlite3` is not on your path, you may need to install it or run it via a temporary container).*

2. **Regenerate Initial State**:
   Now that the DB thinks it has no migrations, regenerate a fresh one that captures the current state of `models.py`:
   ```bash
   docker compose exec backend alembic revision --autogenerate -m "Reset schema to current models"
   ```

3. **Stamp & Upgrade**:
   If the tables already exist in the DB (which they usually do in dev), you might need to "stamp" it so Alembic knows it's already up to date:
   ```bash
   docker compose exec backend alembic stamp head
   ```
   Or, if you want to be safe and just run the upgrade:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

---

## ⚠️ Critical Notes
- **Mutually Dependent Foreign Keys**: You might see a `SAWarning` about "unresolvable cycles". This is expected in this project due to complex relationships between `Tournaments`, `Leagues`, and `Matches`. Alembic handles this by skipping some FK constraints during sorting.
- **SQLite Limitations**: SQLite does not support `ALTER TABLE ... RENAME COLUMN` in older versions. If you hit this, you may need to use Alembic's `render_as_batch=True` configuration (already set in `env.py`).
- **Batch Mode & Named Constraints**: When adding foreign keys or constraints inside a `batch_alter_table` block (common for SQLite), you **MUST** provide an explicit name for the constraint (e.g., `batch_op.create_foreign_key('fk_name', ...)`). Leaving it as `None` will cause a `ValueError: Constraint must have a name` error in SQLite.
- **Production (Neon/Postgres)**: Always test migrations locally before pushing. Neon migrations should be run via the same `alembic upgrade head` command against the production `DATABASE_URL`.

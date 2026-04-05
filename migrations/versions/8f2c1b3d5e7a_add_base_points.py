"""Add base_points to users

Revision ID: 8f2c1b3d5e7a
Revises: 
Create Date: 2026-04-05 01:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f2c1b3d5e7a'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We use a batch operation for SQLite compatibility (though Neon/Postgres is fine too)
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('base_points', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('base_points')

"""Add is_auto_predicted to predictions

Revision ID: 8f2c1b3d5e7c
Revises: 8f2c1b3d5e7b
Create Date: 2026-04-16 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f2c1b3d5e7c'
down_revision: Union[str, None] = '8f2c1b3d5e7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch_alter_table for compatibility (especially if using SQLite)
    with op.batch_alter_table('predictions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_auto_predicted', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    with op.batch_alter_table('predictions', schema=None) as batch_op:
        batch_op.drop_column('is_auto_predicted')
